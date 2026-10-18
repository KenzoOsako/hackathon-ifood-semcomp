// Filtros rígidos de elegibilidade pré-ranking (Tarefa 3).
// Aplica restrições de alergia, política de composição ausente e teto rígido sobre o custo total com encargos.
// Nunca infere ingredientes pelo nome do prato nem relaxa limites rígidos por preferências flexíveis.
import { z } from "zod";
import {
  ConstraintsSchema,
  MoneySchema,
  type Constraints,
  type Money,
} from "@/contracts";
import {
  NormalizedCandidateSchema,
  type NormalizedCandidate,
} from "@/mcp/normalize-candidate";

export class EligibilityEvaluationError extends Error {
  readonly code = "INVALID_DATA" as const;

  constructor(message = "INVALID_DATA") {
    super(message);
    this.name = "EligibilityEvaluationError";
  }
}

export const ExclusionReasonCodeSchema = z.enum([
  "UNAVAILABLE_ITEM",
  "ALLERGY_INCOMPATIBLE",
  "MISSING_COMPOSITION_FOR_ALLERGY",
  "UNKNOWN_TOTAL_FOR_HARD_BUDGET",
  "EXCEEDS_HARD_BUDGET",
]);
export type ExclusionReasonCode = z.infer<typeof ExclusionReasonCodeSchema>;

export interface ExclusionReason {
  code: ExclusionReasonCode;
  message: string;
  allergy?: string;
  matchedTerm?: string;
  field?: "composition.allergens" | "composition.ingredients" | "cost.total" | "available";
  limit?: Money;
  total?: Money;
  missingComponents?: Array<"delivery" | "fees" | "total">;
}

export const PendingIssueCodeSchema = z.enum([
  "MISSING_DELIVERY_FEE",
  "MISSING_FEES",
  "UNKNOWN_TOTAL",
  "ESTIMATED_COST",
  "MISSING_COMPOSITION",
  "UNKNOWN_TOTAL_FOR_FLEXIBLE_BUDGET",
  "EXCEEDS_FLEXIBLE_BUDGET",
]);
export type PendingIssueCode = z.infer<typeof PendingIssueCodeSchema>;

export interface PendingIssue {
  code: PendingIssueCode;
  message: string;
  limit?: Money;
  total?: Money;
}

export interface EligibilityFlags {
  safeForAllergies: boolean;
  withinHardBudget: boolean | null;
  withinFlexibleBudget: boolean | null;
}

export interface CandidateEligibilityResult {
  candidate: NormalizedCandidate;
  eligible: boolean;
  exclusions: ExclusionReason[];
  pendingIssues: PendingIssue[];
  flags: EligibilityFlags;
}

export interface EligibilityEvaluationOptions {
  /**
   * Teto rígido previamente estabelecido na sessão.
   * Mesmo que `constraints.budget` traga uma preferência `flexible`, este teto rígido
   * permanece ativo e nunca é relaxado.
   */
  hardBudgetLimit?: Money;
  /**
   * Preferência flexível adicional de orçamento.
   * Nunca substitui nem amplia um teto rígido.
   */
  flexibleBudgetLimit?: Money;
}

export interface EligibilityFilterResult {
  eligible: CandidateEligibilityResult[];
  excluded: CandidateEligibilityResult[];
  all: CandidateEligibilityResult[];
  effectiveConstraints: Constraints;
  effectiveHardBudget?: Money;
  effectiveFlexibleBudget?: Money;
}

function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenizeWords(normalizedText: string): string[] {
  return normalizedText.split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Verifica se um termo de composição (ingrediente ou alérgeno declarado) corresponde
 * à alergia informada, sem jamais consultar o nome do prato.
 */
function matchesAllergyTerm(declaredTerm: string, allergy: string): boolean {
  const normTerm = foldText(declaredTerm);
  const normAllergy = foldText(allergy);
  if (!normTerm || !normAllergy) return false;
  if (normTerm === normAllergy) return true;

  const termWords = tokenizeWords(normTerm);
  const allergyWords = tokenizeWords(normAllergy);

  if (allergyWords.length === 1) {
    return termWords.includes(allergyWords[0]);
  }
  if (termWords.length === 1) {
    return allergyWords.includes(termWords[0]);
  }

  return normTerm.includes(normAllergy) || normAllergy.includes(normTerm);
}

function formatMoneyBrl(money: Money): string {
  return `R$ ${(money.cents / 100).toFixed(2).replace(".", ",")}`;
}

function resolveBudgetLimits(
  constraints: Constraints,
  options?: EligibilityEvaluationOptions,
): { hardLimit?: Money; flexibleLimit?: Money } {
  let hardLimit: Money | undefined;
  let flexibleLimit: Money | undefined;

  if (options?.hardBudgetLimit !== undefined) {
    const parsed = MoneySchema.safeParse(options.hardBudgetLimit);
    if (!parsed.success) {
      throw new EligibilityEvaluationError("hardBudgetLimit inválido.");
    }
    hardLimit = parsed.data;
  }

  if (options?.flexibleBudgetLimit !== undefined) {
    const parsed = MoneySchema.safeParse(options.flexibleBudgetLimit);
    if (!parsed.success) {
      throw new EligibilityEvaluationError("flexibleBudgetLimit inválido.");
    }
    flexibleLimit = parsed.data;
  }

  if (constraints.budget) {
    if (constraints.budget.kind === "hard") {
      hardLimit =
        hardLimit === undefined
          ? constraints.budget.limit
          : {
              currency: "BRL",
              cents: Math.min(hardLimit.cents, constraints.budget.limit.cents),
            };
    } else {
      flexibleLimit =
        flexibleLimit === undefined
          ? constraints.budget.limit
          : {
              currency: "BRL",
              cents: Math.min(flexibleLimit.cents, constraints.budget.limit.cents),
            };
    }
  }

  return { hardLimit, flexibleLimit };
}

/**
 * Combina restrições rígidas existentes com uma nova preferência flexível ou novas alergias,
 * garantindo que um limite rígido nunca seja removido ou ampliado por preferência flexível.
 */
export function applyFlexiblePreference(
  baseConstraints: Constraints,
  preference: {
    budgetLimit?: Money;
    additionalAllergies?: readonly string[];
  },
): { constraints: Constraints; hardBudgetLimit?: Money; flexibleBudgetLimit?: Money } {
  const parsedBase = ConstraintsSchema.safeParse(baseConstraints);
  if (!parsedBase.success) {
    throw new EligibilityEvaluationError("Constraints base inválidas.");
  }
  const base = parsedBase.data;

  let flexibleBudgetLimit: Money | undefined;
  if (preference.budgetLimit !== undefined) {
    const parsedLimit = MoneySchema.safeParse(preference.budgetLimit);
    if (!parsedLimit.success) {
      throw new EligibilityEvaluationError("Limite de preferência flexível inválido.");
    }
    flexibleBudgetLimit = parsedLimit.data;
  }

  const mergedAllergies = [...base.allergies];
  const seenAllergies = new Set(base.allergies.map(foldText));
  for (const rawAllergy of preference.additionalAllergies ?? []) {
    const trimmed = rawAllergy.trim();
    if (!trimmed) {
      throw new EligibilityEvaluationError("Alergia adicional não pode ser vazia.");
    }
    const key = foldText(trimmed);
    if (!seenAllergies.has(key)) {
      seenAllergies.add(key);
      mergedAllergies.push(trimmed);
    }
  }

  // Se a base já possui um orçamento rígido, ele é preservado em constraints.budget (kind: "hard").
  const nextBudget =
    base.budget?.kind === "hard"
      ? base.budget
      : flexibleBudgetLimit !== undefined
        ? { limit: flexibleBudgetLimit, kind: "flexible" as const }
        : base.budget;

  const constraints = ConstraintsSchema.parse({
    ...(nextBudget ? { budget: nextBudget } : {}),
    allergies: mergedAllergies,
    missingCompositionPolicy: "exclude-from-safe-claims",
  });

  return {
    constraints,
    hardBudgetLimit: base.budget?.kind === "hard" ? base.budget.limit : undefined,
    flexibleBudgetLimit,
  };
}

/**
 * Avalia a elegibilidade de um único candidato normalizado frente às restrições.
 */
export function evaluateCandidateEligibility(
  candidateInput: NormalizedCandidate,
  constraintsInput: Constraints,
  options?: EligibilityEvaluationOptions,
): CandidateEligibilityResult {
  const parsedCandidate = NormalizedCandidateSchema.safeParse(candidateInput);
  if (!parsedCandidate.success) {
    throw new EligibilityEvaluationError("Candidato inválido para avaliação de elegibilidade.");
  }
  const candidate = parsedCandidate.data;

  const parsedConstraints = ConstraintsSchema.safeParse(constraintsInput);
  if (!parsedConstraints.success) {
    throw new EligibilityEvaluationError("Constraints inválidas para avaliação de elegibilidade.");
  }
  const constraints = parsedConstraints.data;

  const { hardLimit, flexibleLimit } = resolveBudgetLimits(constraints, options);

  const exclusions: ExclusionReason[] = [];
  const pendingIssues: PendingIssue[] = [];

  // 1. Disponibilidade explícita
  if (candidate.available === false) {
    exclusions.push({
      code: "UNAVAILABLE_ITEM",
      field: "available",
      message: "Item explicitamente marcado como indisponível.",
    });
  }

  // 2. Pendências de custo e composição (independentes de exclusão)
  if (candidate.cost.delivery === undefined) {
    pendingIssues.push({
      code: "MISSING_DELIVERY_FEE",
      message: "Frete desconhecido.",
    });
  }
  if (candidate.cost.fees === undefined) {
    pendingIssues.push({
      code: "MISSING_FEES",
      message: "Taxas desconhecidas.",
    });
  }
  if (candidate.cost.status === "unknown" || candidate.cost.total === undefined) {
    pendingIssues.push({
      code: "UNKNOWN_TOTAL",
      message: "Total com encargos desconhecido.",
    });
  } else if (candidate.cost.status === "estimated") {
    pendingIssues.push({
      code: "ESTIMATED_COST",
      total: candidate.cost.total,
      message: `Total estimado em ${formatMoneyBrl(candidate.cost.total)} (sujeito a confirmação).`,
    });
  }

  const hasCompleteIngredients =
    candidate.composition?.ingredients !== undefined &&
    candidate.composition.ingredients.length > 0;

  if (!hasCompleteIngredients) {
    pendingIssues.push({
      code: "MISSING_COMPOSITION",
      message: "Composição completa de ingredientes não informada.",
    });
  }

  // 3. Avaliação de alergias (nunca usa o nome do prato; usa apenas composition)
  let hasAllergyConflict = false;
  if (constraints.allergies.length > 0) {
    const declaredAllergens = candidate.composition?.allergens ?? [];
    const declaredIngredients = candidate.composition?.ingredients ?? [];

    for (const allergy of constraints.allergies) {
      const matchedAllergen = declaredAllergens.find((term) => matchesAllergyTerm(term, allergy));
      if (matchedAllergen !== undefined) {
        hasAllergyConflict = true;
        exclusions.push({
          code: "ALLERGY_INCOMPATIBLE",
          allergy,
          matchedTerm: matchedAllergen,
          field: "composition.allergens",
          message: `Alérgeno incompatível com restrição "${allergy}": contém "${matchedAllergen}".`,
        });
        continue;
      }

      const matchedIngredient = declaredIngredients.find((term) =>
        matchesAllergyTerm(term, allergy),
      );
      if (matchedIngredient !== undefined) {
        hasAllergyConflict = true;
        exclusions.push({
          code: "ALLERGY_INCOMPATIBLE",
          allergy,
          matchedTerm: matchedIngredient,
          field: "composition.ingredients",
          message: `Ingrediente incompatível com restrição "${allergy}": contém "${matchedIngredient}".`,
        });
      }
    }

    if (!hasAllergyConflict && !hasCompleteIngredients) {
      exclusions.push({
        code: "MISSING_COMPOSITION_FOR_ALLERGY",
        allergy: constraints.allergies.join(", "),
        message:
          "Composição ausente ou incompleta não permite declarar segurança para as alergias informadas.",
      });
    }
  }

  // Composição ausente nunca permite alegar segurança alergênica.
  const safeForAllergies = hasCompleteIngredients && !hasAllergyConflict;

  // 4. Avaliação de teto rígido (hard budget) sobre o total com encargos necessários
  let withinHardBudget: boolean | null = null;
  if (hardLimit !== undefined) {
    const missingComponents: Array<"delivery" | "fees" | "total"> = [];
    if (candidate.cost.delivery === undefined) missingComponents.push("delivery");
    if (candidate.cost.fees === undefined) missingComponents.push("fees");
    if (candidate.cost.total === undefined || candidate.cost.status === "unknown") {
      missingComponents.push("total");
    }

    if (missingComponents.length > 0 || candidate.cost.total === undefined) {
      withinHardBudget = false;
      exclusions.push({
        code: "UNKNOWN_TOTAL_FOR_HARD_BUDGET",
        field: "cost.total",
        limit: hardLimit,
        missingComponents,
        message: `Total com encargos desconhecido não pode ser classificado dentro do teto rígido de ${formatMoneyBrl(hardLimit)}.`,
      });
    } else if (candidate.cost.total.cents > hardLimit.cents) {
      withinHardBudget = false;
      exclusions.push({
        code: "EXCEEDS_HARD_BUDGET",
        field: "cost.total",
        limit: hardLimit,
        total: candidate.cost.total,
        message: `Total de ${formatMoneyBrl(candidate.cost.total)} excede o teto rígido de ${formatMoneyBrl(hardLimit)}.`,
      });
    } else {
      withinHardBudget = true;
    }
  }

  // 5. Avaliação de preferência flexível de orçamento (não exclui, mas registra pendência)
  let withinFlexibleBudget: boolean | null = null;
  if (flexibleLimit !== undefined) {
    if (candidate.cost.total === undefined || candidate.cost.status === "unknown") {
      withinFlexibleBudget = false;
      pendingIssues.push({
        code: "UNKNOWN_TOTAL_FOR_FLEXIBLE_BUDGET",
        limit: flexibleLimit,
        message: `Total com encargos desconhecido para comparar com a preferência flexível de ${formatMoneyBrl(flexibleLimit)}.`,
      });
    } else if (candidate.cost.total.cents > flexibleLimit.cents) {
      withinFlexibleBudget = false;
      pendingIssues.push({
        code: "EXCEEDS_FLEXIBLE_BUDGET",
        limit: flexibleLimit,
        total: candidate.cost.total,
        message: `Total de ${formatMoneyBrl(candidate.cost.total)} acima da preferência flexível de ${formatMoneyBrl(flexibleLimit)}.`,
      });
    } else {
      withinFlexibleBudget = true;
    }
  }

  return {
    candidate,
    eligible: exclusions.length === 0,
    exclusions,
    pendingIssues,
    flags: {
      safeForAllergies,
      withinHardBudget,
      withinFlexibleBudget,
    },
  };
}

/**
 * Filtra uma lista de candidatos normalizados aplicando os filtros rígidos de elegibilidade
 * antes do ranking e preservando os motivos estruturados de exclusão e pendência.
 */
export function filterEligibleCandidates(
  candidates: readonly NormalizedCandidate[],
  constraintsInput: Constraints,
  options?: EligibilityEvaluationOptions,
): EligibilityFilterResult {
  if (!Array.isArray(candidates)) {
    throw new EligibilityEvaluationError("Lista de candidatos deve ser um array.");
  }

  const parsedConstraints = ConstraintsSchema.safeParse(constraintsInput);
  if (!parsedConstraints.success) {
    throw new EligibilityEvaluationError("Constraints inválidas.");
  }
  const effectiveConstraints = parsedConstraints.data;
  const { hardLimit, flexibleLimit } = resolveBudgetLimits(effectiveConstraints, options);

  const all = candidates.map((candidate) =>
    evaluateCandidateEligibility(candidate, effectiveConstraints, options),
  );

  return {
    eligible: all.filter((entry) => entry.eligible),
    excluded: all.filter((entry) => !entry.eligible),
    all,
    effectiveConstraints,
    ...(hardLimit !== undefined ? { effectiveHardBudget: hardLimit } : {}),
    ...(flexibleLimit !== undefined ? { effectiveFlexibleBudget: flexibleLimit } : {}),
  };
}
