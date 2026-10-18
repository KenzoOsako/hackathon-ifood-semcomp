// Fluxo de domínio para criação, revisão e aprovação local de propostas e filtragem de busca (K-1, K-4, K-5).
// Centraliza regras de negócio fora de src/agent/agent.ts e reutiliza os módulos de custos, elegibilidade, ranking e handoff.
import {
  CandidateSchema,
  ConstraintsSchema,
  HistoryEntrySchema,
  toPublicProposal,
  type Address,
  type Candidate,
  type CartProposal,
  type Constraints,
  type Cost,
  type Money,
  type Option,
  type Origin,
  type PublicProposal,
  type Recommendation,
} from "@/contracts";
import { ProposalError, type ProposalStore } from "@/agent/proposals";
import {
  brlToMoney,
  CostNormalizationError,
  normalizeCandidateCost,
  resolveItemUnitPrice,
} from "@/mcp/costs";
import {
  CandidateNormalizationError,
  normalizeCandidates,
  toLegacyCandidate,
} from "@/mcp/normalize-candidate";
import {
  EligibilityEvaluationError,
  filterEligibleCandidates,
  type EligibilityFilterResult,
} from "@/reco/eligibility";
import { rank } from "@/reco/rank";
import { rankEligibleFilterResult } from "@/reco/rank-eligible";
import {
  buildManualHandoffSummary,
  type HandoffPresentation,
  type ManualHandoffSummary,
} from "./handoff";

const DEFAULT_MOCK_ORIGIN: Origin = {
  mode: "mock",
  source: "fixtures/discovery.json",
  observedAt: "2026-10-17T00:00:00.000Z",
};

const PROPOSAL_TTL_MS = 5 * 60_000;

function formatMoneyBrl(money: Money): string {
  return `R$ ${(money.cents / 100).toFixed(2).replace(".", ",")}`;
}

export function buildProposalUnresolvedList(cost: Cost): string[] {
  const unresolved: string[] = [];
  if (cost.fees === undefined || cost.status === "unknown" || cost.total === undefined) {
    unresolved.push("Taxas e total não confirmados");
  }
  if (cost.delivery === undefined) {
    unresolved.push("Frete desconhecido");
  }
  if (cost.status === "estimated") {
    unresolved.push("Custos estimados sujeitos a confirmação no iFood");
  }
  return unresolved;
}

export interface BuildProposalFromCandidateInput {
  subjectRef: string;
  candidate: Candidate;
  address: Address;
  quantity?: number;
  expiresAt?: string;
  now?: number;
  mode?: "mock" | "real";
}

export interface BuildProposalFromCandidateResult {
  proposal: CartProposal;
  publicProposal: PublicProposal;
  presentation: HandoffPresentation;
  reply: string;
}

/**
 * Cria e envia para revisão (awaiting_approval) uma proposta local a partir de um candidato e endereço validados.
 * - Quando item, frete e taxas são conhecidos e confirmados, gera proposta com total confirmado e sem pendências (aprovável).
 * - Quando frete ou taxas estão ausentes, preserva status "unknown" e registra pendências explícitas (bloqueando aprovação).
 */
export function buildProposalFromCandidate(
  proposals: ProposalStore,
  input: BuildProposalFromCandidateInput,
): BuildProposalFromCandidateResult {
  const parsedCandidate = CandidateSchema.safeParse(input.candidate);
  if (!parsedCandidate.success) {
    throw new ProposalError("INVALID_DATA");
  }
  const candidate = parsedCandidate.data;
  const quantity = input.quantity ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new ProposalError("INVALID_DATA");
  }

  let unitPrice: Money;
  let cost: Cost;
  try {
    unitPrice = resolveItemUnitPrice({
      price: candidate.price,
      promotionalPrice: candidate.promotionalPrice,
    });
    cost = normalizeCandidateCost(candidate, {
      quantity,
      fees: candidate.fees,
      status: candidate.costStatus,
    });
  } catch (error) {
    if (error instanceof CostNormalizationError) {
      throw new ProposalError("INVALID_DATA");
    }
    throw error;
  }

  const unresolved = buildProposalUnresolvedList(cost);
  const nowMs = input.now ?? Date.now();
  const expiresAt = input.expiresAt ?? new Date(nowMs + PROPOSAL_TTL_MS).toISOString();

  const created = proposals.create(input.subjectRef, {
    merchantRef: candidate.merchantId,
    addressRef: input.address.addressId,
    items: [{ ref: candidate.itemId, quantity, unitPrice }],
    cost,
    unresolved,
    expiresAt,
  });

  const reviewed = proposals.review(created.id, input.subjectRef, created.version);
  const publicProposal = toPublicProposal(reviewed);

  const mode = input.mode ?? "mock";
  const presentation: HandoffPresentation = {
    mode,
    merchantName: candidate.merchantName,
    addressLabel: input.address.alias,
    itemNames: {
      [candidate.itemId]: candidate.itemName,
    },
  };

  const prefix = mode === "mock" ? "[Simulado] " : "";
  const deliveryText = cost.delivery ? formatMoneyBrl(cost.delivery) : "desconhecido";

  const reply =
    unresolved.length === 0 && cost.total !== undefined && cost.fees !== undefined
      ? `${prefix}Proposta local: ${quantity}× ${candidate.itemName}, ${candidate.merchantName}. Item ${formatMoneyBrl(cost.items)}; frete ${deliveryText}; taxas ${formatMoneyBrl(cost.fees)}; total confirmado ${formatMoneyBrl(cost.total)}. Endereço: ${input.address.alias}.\nPronta para aprovação explícita. Referência ${reviewed.id}, versão ${reviewed.version}. Digite “aprovar ${reviewed.id} v${reviewed.version}”, use o botão de aprovação ou digite “cancelar”. Nenhum carrinho remoto foi criado; a compra final é no iFood.`
      : `${prefix}Proposta local: ${quantity}× ${candidate.itemName}, ${candidate.merchantName}. Item ${formatMoneyBrl(cost.items)}; frete ${deliveryText}; taxas e total pendentes. Endereço: ${input.address.alias}.\nAprovação bloqueada até resolver as pendências. Referência ${reviewed.id}, versão ${reviewed.version}. Digite “cancelar” ou refaça a busca para editar. Nenhum carrinho remoto foi criado; a compra final é no iFood.`;

  return {
    proposal: reviewed,
    publicProposal,
    presentation,
    reply,
  };
}

export interface ApproveProposalWithHandoffInput {
  subjectRef: string;
  request: unknown;
  presentation?: HandoffPresentation;
  now?: number | string | Date;
}

export interface ApproveProposalWithHandoffResult {
  proposal: CartProposal;
  publicProposal: PublicProposal;
  handoff: ManualHandoffSummary;
  reply: string;
}

/**
 * Aprova uma proposta revisada no ProposalStore e gera o resumo manual copiável de continuidade no iFood.
 * Mantém o bloqueio atômico do ProposalStore caso o custo seja desconhecido ou existam pendências.
 */
export function approveProposalWithHandoff(
  proposals: ProposalStore,
  input: ApproveProposalWithHandoffInput,
): ApproveProposalWithHandoffResult {
  const approved = proposals.approve(input.subjectRef, input.request);
  const publicProposal = toPublicProposal(approved);
  const handoff = buildManualHandoffSummary({
    proposal: publicProposal,
    presentation: input.presentation ?? { mode: "mock" },
    now: input.now,
  });

  const reply = `Proposta local aprovada. Nenhum item foi adicionado e nenhum pedido foi enviado. Confira os itens e finalize a compra no iFood; transferência automática não está disponível nesta demo.\n\n${handoff.text}`;

  return {
    proposal: approved,
    publicProposal,
    handoff,
    reply,
  };
}

export interface EvaluateAndRankSearchInput {
  candidates: readonly unknown[];
  history: readonly unknown[];
  hardBudgetBrl?: number;
  allergies?: readonly string[];
  origin?: Origin;
}

export interface EvaluateAndRankSearchResult {
  options: Option[];
  recommendations: Recommendation[];
  eligibility: EligibilityFilterResult;
  constraints: Constraints;
}

/**
 * Normaliza candidatos e histórico, aplica filtros rígidos de elegibilidade (alergias, composição e teto rígido
 * sobre o custo total com frete e taxas) e produz tanto `options` (contrato do chat/UI) quanto `recommendations` (V2).
 */
export function evaluateAndRankSearchCandidates(
  input: EvaluateAndRankSearchInput,
): EvaluateAndRankSearchResult {
  try {
    const parsedCandidates = input.candidates.map((item) => CandidateSchema.parse(item));
    const parsedHistory = input.history.map((item) => HistoryEntrySchema.parse(item));
    const origin = input.origin ?? DEFAULT_MOCK_ORIGIN;

    const normalizedCandidates = normalizeCandidates(parsedCandidates, {
      origin,
      history: parsedHistory,
    });

    const hardLimit =
      input.hardBudgetBrl !== undefined ? brlToMoney(input.hardBudgetBrl) : undefined;

    const constraints = ConstraintsSchema.parse({
      ...(hardLimit ? { budget: { limit: hardLimit, kind: "hard" as const } } : {}),
      allergies: [...(input.allergies ?? [])],
      missingCompositionPolicy: "exclude-from-safe-claims",
    });

    const eligibility = filterEligibleCandidates(normalizedCandidates, constraints);
    const eligibleLegacyCandidates = eligibility.eligible.map((entry) =>
      toLegacyCandidate(entry.candidate),
    );

    const options = rank(eligibleLegacyCandidates, parsedHistory);
    const rankedEligible = rankEligibleFilterResult(eligibility, { uniqueMerchants: true });

    return {
      options,
      recommendations: rankedEligible.recommendations,
      eligibility,
      constraints,
    };
  } catch (error) {
    if (
      error instanceof CostNormalizationError ||
      error instanceof CandidateNormalizationError ||
      error instanceof EligibilityEvaluationError
    ) {
      throw new ProposalError("INVALID_DATA");
    }
    throw error;
  }
}

/**
 * Extrai termo de busca, teto rígido em BRL e restrições explícitas de alergia a partir do texto do usuário.
 */
export function parseSearchIntentFromText(
  rawText: string,
  normalizedText: string,
): {
  foodQuery: string;
  hardBudgetBrl?: number;
  allergies: string[];
} {
  const foodQuery =
    ["hamburguer", "pizza", "sushi", "acai", "lanche"].find((f) => normalizedText.includes(f)) ??
    (normalizedText.includes("fome") ? "hamburguer" : rawText);

  const budgetMatch = normalizedText.match(/ate\s*r?\$?\s*(\d+(?:[.,]\d{1,2})?)/)?.[1];
  const hardBudgetBrl = budgetMatch ? Number(budgetMatch.replace(",", ".")) : undefined;

  const allergies: string[] = [];
  const seen = new Set<string>();
  const addAllergy = (term: string) => {
    const clean = term.trim().toLowerCase();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    allergies.push(clean);
  };

  const allergyRegex = /\b(?:alergia\s+a|alergico\s+a|alergica\s+a|sem)\s+(gluten|leite|lactose|peixe|gergelim|amendoim|camarao|ovo|soja)\b/g;
  for (const match of normalizedText.matchAll(allergyRegex)) {
    const term = match[1];
    if (term === "lactose") {
      addAllergy("leite");
    } else {
      addAllergy(term);
    }
  }

  return {
    foodQuery,
    ...(hardBudgetBrl !== undefined ? { hardBudgetBrl } : {}),
    allergies,
  };
}
