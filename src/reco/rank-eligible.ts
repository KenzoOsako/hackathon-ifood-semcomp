// Ranking determinístico com evidências e origens verificáveis (Tarefa 4).
// Consome a elegibilidade da Tarefa 3 e produz recomendações compatíveis com RecommendationSchema.
//
// Critérios determinísticos de ordenação (aplicados apenas a candidatos elegíveis):
// 1. Adequação à preferência flexível de orçamento (withinFlexibleBudget === true precede false).
// 2. Nível de certeza do custo total (confirmed > estimated > unknown). Ausências nunca viram zero.
// 3. Alinhamento com preferência explicitamente declarada (AuthorizedContext.preferences com basis="declared").
// 4. Menor custo comparável nos componentes conhecidos por ambos (total quando ambos têm total;
//    items+delivery quando ambos têm delivery; caso contrário subtotal de items).
// 5. Maior avaliação conhecida (rating presente precede ausente; maior nota vence).
// 6. Menor tempo de entrega conhecido (deliveryTimeMinutes presente precede ausente; menor prazo vence).
// 7. Maior frequência observada no histórico recente (timesOrdered > 0 precede ausente; não equivale a favorito declarado).
// 8. Desempate estável por merchantId (lexicográfico ascendente) e itemId (lexicográfico ascendente).
import {
  AuthorizedContextSchema,
  RecommendationSchema,
  type AuthorizedContext,
  type Constraints,
  type Money,
  type Origin,
  type Recommendation,
} from "@/contracts";
import type { NormalizedCandidate } from "@/mcp/normalize-candidate";
import {
  evaluateCandidateEligibility,
  filterEligibleCandidates,
  type CandidateEligibilityResult,
  type EligibilityEvaluationOptions,
  type EligibilityFilterResult,
} from "./eligibility";

export class RankingError extends Error {
  readonly code = "INVALID_DATA" as const;

  constructor(message = "INVALID_DATA") {
    super(message);
    this.name = "RankingError";
  }
}

export const MAX_RECOMMENDATIONS = 3;

export interface RankEligibleOptions extends EligibilityEvaluationOptions {
  /**
   * Quantidade máxima de recomendações retornadas (1 a 3, padrão 3).
   * Nunca preenche artificialmente a lista quando há menos candidatos elegíveis.
   */
  limit?: number;
  /**
   * Contexto autorizado opcional para verificar preferências declaradas (basis="declared").
   */
  authorizedContext?: AuthorizedContext;
  /**
   * Quando true, seleciona no máximo o melhor item elegível de cada estabelecimento.
   * Padrão: false (permite múltiplos itens elegíveis se necessário, respeitando a ordem).
   */
  uniqueMerchants?: boolean;
}

export interface RankedEligibleEntry {
  rank: number;
  recommendation: Recommendation;
  eligibility: CandidateEligibilityResult;
}

export interface RankEligibleResult {
  recommendations: Recommendation[];
  ranked: RankedEligibleEntry[];
  excluded: CandidateEligibilityResult[];
}

function formatMoneyBrl(money: Money): string {
  return `R$ ${(money.cents / 100).toFixed(2).replace(".", ",")}`;
}

function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function costStatusRank(status: NormalizedCandidate["cost"]["status"]): number {
  switch (status) {
    case "confirmed":
      return 0;
    case "estimated":
      return 1;
    case "unknown":
      return 2;
  }
}

function findMatchedDeclaredPreference(
  candidate: NormalizedCandidate,
  authorizedContext?: AuthorizedContext,
): { value: string; origin: Origin } | undefined {
  if (!authorizedContext) return undefined;
  if (!authorizedContext.authorizedPurposes.includes("recommendations")) {
    return undefined;
  }

  const searchable = foldText(
    [candidate.itemName, candidate.merchantName, candidate.category ?? ""].join(" "),
  );

  for (const pref of authorizedContext.preferences) {
    if (pref.basis !== "declared") continue;
    const normPref = foldText(pref.value);
    if (normPref && searchable.includes(normPref)) {
      return {
        value: pref.value,
        origin: authorizedContext.origins[0],
      };
    }
  }
  return undefined;
}

function compareComparableCost(a: NormalizedCandidate, b: NormalizedCandidate): number {
  if (a.cost.total !== undefined && b.cost.total !== undefined) {
    if (a.cost.total.cents !== b.cost.total.cents) {
      return a.cost.total.cents - b.cost.total.cents;
    }
  } else if (a.cost.delivery !== undefined && b.cost.delivery !== undefined) {
    const aPartial = a.cost.items.cents + a.cost.delivery.cents;
    const bPartial = b.cost.items.cents + b.cost.delivery.cents;
    if (aPartial !== bPartial) {
      return aPartial - bPartial;
    }
  }

  if (a.cost.items.cents !== b.cost.items.cents) {
    return a.cost.items.cents - b.cost.items.cents;
  }
  return 0;
}

function compareOptionalDesc(a: number | undefined, b: number | undefined): number {
  if (a !== undefined && b !== undefined) {
    if (a !== b) return b - a;
    return 0;
  }
  if (a !== undefined) return -1;
  if (b !== undefined) return 1;
  return 0;
}

function compareOptionalAsc(a: number | undefined, b: number | undefined): number {
  if (a !== undefined && b !== undefined) {
    if (a !== b) return a - b;
    return 0;
  }
  if (a !== undefined) return -1;
  if (b !== undefined) return 1;
  return 0;
}

function compareLexicographic(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Comparador determinístico entre dois candidatos elegíveis.
 */
export function compareEligibleCandidates(
  a: CandidateEligibilityResult,
  b: CandidateEligibilityResult,
  authorizedContext?: AuthorizedContext,
): number {
  // 1. Adequação ao orçamento flexível (quando aplicável)
  if (a.flags.withinFlexibleBudget !== b.flags.withinFlexibleBudget) {
    if (a.flags.withinFlexibleBudget === true) return -1;
    if (b.flags.withinFlexibleBudget === true) return 1;
  }

  // 2. Confirmação e completude do custo (confirmed > estimated > unknown)
  const statusDiff = costStatusRank(a.candidate.cost.status) - costStatusRank(b.candidate.cost.status);
  if (statusDiff !== 0) return statusDiff;

  // 3. Preferência explicitamente declarada pelo usuário (basis === "declared")
  const aDeclared = findMatchedDeclaredPreference(a.candidate, authorizedContext) !== undefined;
  const bDeclared = findMatchedDeclaredPreference(b.candidate, authorizedContext) !== undefined;
  if (aDeclared !== bDeclared) {
    return aDeclared ? -1 : 1;
  }

  // 4. Menor custo comparável sem tratar ausências como zero
  const costDiff = compareComparableCost(a.candidate, b.candidate);
  if (costDiff !== 0) return costDiff;

  // 5. Maior avaliação conhecida
  const ratingDiff = compareOptionalDesc(a.candidate.rating, b.candidate.rating);
  if (ratingDiff !== 0) return ratingDiff;

  // 6. Menor prazo de entrega conhecido
  const timeDiff = compareOptionalAsc(
    a.candidate.deliveryTimeMinutes,
    b.candidate.deliveryTimeMinutes,
  );
  if (timeDiff !== 0) return timeDiff;

  // 7. Frequência de pedidos observada no histórico recente (apenas > 0)
  const aOrders =
    a.candidate.history && a.candidate.history.timesOrdered > 0
      ? a.candidate.history.timesOrdered
      : undefined;
  const bOrders =
    b.candidate.history && b.candidate.history.timesOrdered > 0
      ? b.candidate.history.timesOrdered
      : undefined;
  const historyDiff = compareOptionalDesc(aOrders, bOrders);
  if (historyDiff !== 0) return historyDiff;

  // 8. Desempate estável por merchantId e itemId
  const merchantDiff = compareLexicographic(a.candidate.merchantId, b.candidate.merchantId);
  if (merchantDiff !== 0) return merchantDiff;

  return compareLexicographic(a.candidate.itemId, b.candidate.itemId);
}

function buildRecommendationFromEligible(
  entry: CandidateEligibilityResult,
  context: {
    effectiveConstraints?: Constraints;
    effectiveHardBudget?: Money;
    authorizedContext?: AuthorizedContext;
  },
): Recommendation {
  const { candidate } = entry;
  const origins: Origin[] = [...candidate.origins];
  const evidence: Recommendation["evidence"] = [];
  const reasons: Recommendation["reasons"] = [];

  const addEvidenceAndReason = (field: string, text: string, originIndex = 0) => {
    const evidenceRef = `ev:${candidate.itemId}:${field}`;
    if (!evidence.some((e) => e.ref === evidenceRef)) {
      evidence.push({
        ref: evidenceRef,
        originIndex,
        field,
      });
    }
    reasons.push({
      text,
      evidenceRef,
    });
  };

  // 1. Evidência de custo / preço (sempre presente via cost.total ou cost.items)
  if (candidate.cost.total !== undefined && candidate.cost.delivery !== undefined && candidate.cost.fees !== undefined) {
    const statusLabel = candidate.cost.status === "estimated" ? "estimado" : "confirmado";
    addEvidenceAndReason(
      "cost.total",
      `Total ${statusLabel} de ${formatMoneyBrl(candidate.cost.total)} (item ${formatMoneyBrl(candidate.cost.items)}, frete ${formatMoneyBrl(candidate.cost.delivery)}, taxas ${formatMoneyBrl(candidate.cost.fees)})`,
    );

    if (entry.flags.withinHardBudget === true && context.effectiveHardBudget !== undefined) {
      addEvidenceAndReason(
        "cost.total",
        `Dentro do teto rígido de ${formatMoneyBrl(context.effectiveHardBudget)} considerando frete e taxas`,
      );
    }
  } else {
    addEvidenceAndReason(
      "cost.items",
      `Item por ${formatMoneyBrl(candidate.cost.items)} (total pendente de encargos não informados)`,
    );
  }

  // 2. Promoção verificável
  if (
    candidate.promotionalPrice !== undefined &&
    candidate.unitPrice.cents < candidate.regularUnitPrice.cents
  ) {
    addEvidenceAndReason(
      "promotionalPrice",
      `Em promoção de ${formatMoneyBrl(candidate.regularUnitPrice)} por ${formatMoneyBrl(candidate.unitPrice)}`,
    );
  }

  // 3. Frete grátis explícito
  if (candidate.cost.delivery !== undefined && candidate.cost.delivery.cents === 0) {
    addEvidenceAndReason("cost.delivery", "Frete grátis informado explicitamente (R$ 0,00)");
  }

  // 4. Segurança verificada para alergias declaradas
  if (
    entry.flags.safeForAllergies &&
    context.effectiveConstraints &&
    context.effectiveConstraints.allergies.length > 0
  ) {
    addEvidenceAndReason(
      "composition.ingredients",
      `Composição verificada sem os alérgenos restritos (${context.effectiveConstraints.allergies.join(", ")})`,
    );
  }

  // 5. Preferência explicitamente declarada pelo usuário (distinta de histórico/frequência)
  const matchedDeclaredPref = findMatchedDeclaredPreference(candidate, context.authorizedContext);
  if (matchedDeclaredPref !== undefined) {
    let originIndex = origins.findIndex(
      (o) =>
        o.mode === matchedDeclaredPref.origin.mode &&
        o.source === matchedDeclaredPref.origin.source &&
        o.observedAt === matchedDeclaredPref.origin.observedAt,
    );
    if (originIndex === -1) {
      origins.push(matchedDeclaredPref.origin);
      originIndex = origins.length - 1;
    }
    addEvidenceAndReason(
      "preferences.declared",
      `Alinhado à preferência declarada pelo usuário ("${matchedDeclaredPref.value}")`,
      originIndex,
    );
  }

  // 6. Avaliação quando presente
  if (candidate.rating !== undefined) {
    addEvidenceAndReason(
      "rating",
      `Avaliação de ${candidate.rating.toFixed(1).replace(".", ",")} no catálogo`,
    );
  }

  // 7. Prazo de entrega quando presente
  if (candidate.deliveryTimeMinutes !== undefined) {
    addEvidenceAndReason(
      "deliveryTimeMinutes",
      `Entrega estimada em ${candidate.deliveryTimeMinutes} min`,
    );
  }

  // 8. Distância quando presente
  if (candidate.distanceKm !== undefined) {
    addEvidenceAndReason(
      "distanceKm",
      `Distância de ${candidate.distanceKm.toFixed(1).replace(".", ",")} km`,
    );
  }

  // 9. Curadoria quando presente
  if (candidate.curated === true) {
    addEvidenceAndReason("curated", "Item destacado pela curadoria do catálogo");
  }

  // 10. Histórico recente quando presente e > 0 (nunca rotulado como favorito declarado;
  //     ausência de histórico recente nunca gera razão dizendo que o usuário nunca pediu)
  if (candidate.history !== undefined && candidate.history.timesOrdered > 0) {
    const count = candidate.history.timesOrdered;
    addEvidenceAndReason(
      "history.timesOrdered",
      `Estabelecimento com ${count} ${count === 1 ? "pedido registrado" : "pedidos registrados"} no histórico recente consultado`,
    );
  }

  // Consolida incertezas sem duplicatas
  const uncertaintySet = new Set<string>();
  for (const u of candidate.uncertainties) {
    if (u.trim()) uncertaintySet.add(u.trim());
  }
  for (const issue of entry.pendingIssues) {
    if (issue.message.trim()) uncertaintySet.add(issue.message.trim());
  }

  return RecommendationSchema.parse({
    ref: candidate.itemId,
    merchantRef: candidate.merchantId,
    title: candidate.itemName,
    cost: candidate.cost,
    origins,
    evidence,
    reasons,
    uncertainties: [...uncertaintySet],
  });
}

function validateLimit(limit: number | undefined): number {
  const effective = limit ?? MAX_RECOMMENDATIONS;
  if (
    typeof effective !== "number" ||
    !Number.isSafeInteger(effective) ||
    effective < 1 ||
    effective > MAX_RECOMMENDATIONS
  ) {
    throw new RankingError(`Limite de recomendações deve ser inteiro entre 1 e ${MAX_RECOMMENDATIONS}.`);
  }
  return effective;
}

function validateAuthorizedContext(
  authorizedContext: AuthorizedContext | undefined,
): AuthorizedContext | undefined {
  if (authorizedContext === undefined) return undefined;
  const parsed = AuthorizedContextSchema.safeParse(authorizedContext);
  if (!parsed.success) {
    throw new RankingError("AuthorizedContext inválido para o ranking.");
  }
  return parsed.data;
}

/**
 * Ranqueia o resultado da filtragem de elegibilidade (Tarefa 3), garantindo que
 * candidatos excluídos nunca reapareçam e gerando até 3 recomendações com evidências.
 */
export function rankEligibleFilterResult(
  filterResult: EligibilityFilterResult,
  options?: RankEligibleOptions,
): RankEligibleResult {
  if (!filterResult || typeof filterResult !== "object" || !Array.isArray(filterResult.eligible)) {
    throw new RankingError("Resultado de elegibilidade inválido.");
  }

  const limit = validateLimit(options?.limit);
  const authorizedContext = validateAuthorizedContext(options?.authorizedContext);

  // Defesa em profundidade: revalida cada entrada e descarta qualquer item com eligible !== true
  // ou com motivos de exclusão presentes.
  const verifiedEligible: CandidateEligibilityResult[] = [];
  const excludedMap = new Map<string, CandidateEligibilityResult>();

  for (const ex of filterResult.excluded ?? []) {
    excludedMap.set(`${ex.candidate.merchantId}:${ex.candidate.itemId}`, ex);
  }

  for (const entry of filterResult.eligible) {
    const reevaluated = evaluateCandidateEligibility(
      entry.candidate,
      filterResult.effectiveConstraints,
      {
        hardBudgetLimit: options?.hardBudgetLimit ?? filterResult.effectiveHardBudget,
        flexibleBudgetLimit: options?.flexibleBudgetLimit ?? filterResult.effectiveFlexibleBudget,
      },
    );
    const key = `${reevaluated.candidate.merchantId}:${reevaluated.candidate.itemId}`;
    if (!reevaluated.eligible || reevaluated.exclusions.length > 0 || excludedMap.has(key)) {
      excludedMap.set(key, reevaluated);
    } else {
      verifiedEligible.push(reevaluated);
    }
  }

  const sorted = [...verifiedEligible].sort((a, b) =>
    compareEligibleCandidates(a, b, authorizedContext),
  );

  const selected: CandidateEligibilityResult[] = [];
  const seenMerchants = new Set<string>();

  for (const entry of sorted) {
    if (options?.uniqueMerchants) {
      if (seenMerchants.has(entry.candidate.merchantId)) continue;
      seenMerchants.add(entry.candidate.merchantId);
    }
    selected.push(entry);
    if (selected.length >= limit) break;
  }

  const ranked: RankedEligibleEntry[] = selected.map((eligibility, index) => ({
    rank: index + 1,
    eligibility,
    recommendation: buildRecommendationFromEligible(eligibility, {
      effectiveConstraints: filterResult.effectiveConstraints,
      effectiveHardBudget: options?.hardBudgetLimit ?? filterResult.effectiveHardBudget,
      authorizedContext,
    }),
  }));

  return {
    recommendations: ranked.map((r) => r.recommendation),
    ranked,
    excluded: [...excludedMap.values()],
  };
}

/**
 * Filtra candidatos normalizados pelas restrições rígidas (Tarefa 3) e executa o ranking
 * determinístico com geração de evidências (Tarefa 4).
 */
export function rankEligibleCandidates(
  candidates: readonly NormalizedCandidate[],
  constraints: Constraints,
  options?: RankEligibleOptions,
): RankEligibleResult {
  const filterResult = filterEligibleCandidates(candidates, constraints, {
    hardBudgetLimit: options?.hardBudgetLimit,
    flexibleBudgetLimit: options?.flexibleBudgetLimit,
  });
  return rankEligibleFilterResult(filterResult, options);
}
