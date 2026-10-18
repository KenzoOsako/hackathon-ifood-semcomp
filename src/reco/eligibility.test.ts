import { describe, expect, it } from "vitest";
import type { Constraints } from "@/contracts";
import { normalizeCandidate } from "@/mcp/normalize-candidate";
import {
  applyFlexiblePreference,
  EligibilityEvaluationError,
  evaluateCandidateEligibility,
  filterEligibleCandidates,
} from "./eligibility";

const mockOrigin = {
  mode: "mock" as const,
  source: "synthetic-fixture/eligibility",
  observedAt: "2026-10-17T20:30:00-03:00",
};

const money = (cents: number) => ({ currency: "BRL" as const, cents });

describe("filtros rígidos de elegibilidade (Tarefa 3)", () => {
  it("aprova candidato elegível com composição completa segura e total exato no limite do teto rígido", () => {
    // Item R$ 32,00 + Frete R$ 6,50 + Taxas R$ 1,50 = Total R$ 40,00 (4000 centavos)
    const candidate = normalizeCandidate(
      {
        itemId: "item-exact-40",
        itemName: "Poke de Salmão",
        merchantId: "m-poke",
        merchantName: "Poke Sintético",
        price: 32.0,
        deliveryFee: 6.5,
        fees: 1.5,
        costStatus: "confirmed",
        composition: {
          ingredients: ["Arroz japonês", "Salmão", "Pepino", "Manga", "Gergelim"],
          allergens: ["Peixe", "Gergelim"],
        },
      },
      { origin: mockOrigin },
    );

    const constraints: Constraints = {
      budget: { limit: money(4000), kind: "hard" },
      allergies: ["amendoim", "leite"],
      missingCompositionPolicy: "exclude-from-safe-claims",
    };

    const result = evaluateCandidateEligibility(candidate, constraints);
    expect(result.eligible).toBe(true);
    expect(result.exclusions).toEqual([]);
    expect(result.flags).toEqual({
      safeForAllergies: true,
      withinHardBudget: true,
      withinFlexibleBudget: null,
    });
  });

  it("exclui candidato quando o total com encargos excede o teto rígido por 1 centavo, mesmo se o item couber", () => {
    // Item R$ 32,00 (cabe em R$ 40,00), mas com frete R$ 6,50 + taxas R$ 1,51 = R$ 40,01 (4001 centavos)
    const candidate = normalizeCandidate(
      {
        itemId: "item-4001",
        itemName: "Prato Executivo",
        merchantId: "m-exec",
        merchantName: "Restaurante Central",
        price: 32.0,
        deliveryFee: 6.5,
        fees: 1.51,
        costStatus: "confirmed",
      },
      { origin: mockOrigin },
    );

    const constraints: Constraints = {
      budget: { limit: money(4000), kind: "hard" },
      allergies: [],
      missingCompositionPolicy: "exclude-from-safe-claims",
    };

    const result = evaluateCandidateEligibility(candidate, constraints);
    expect(result.eligible).toBe(false);
    expect(result.flags.withinHardBudget).toBe(false);
    expect(result.exclusions).toEqual([
      expect.objectContaining({
        code: "EXCEEDS_HARD_BUDGET",
        field: "cost.total",
        limit: money(4000),
        total: money(4001),
      }),
    ]);
  });

  it("exclui candidato com total desconhecido quando há teto rígido, mesmo com preço de item baixo", () => {
    const candidateMissingFees = normalizeCandidate(
      {
        itemId: "item-cheap-unknown",
        itemName: "Esfiha",
        merchantId: "m-esfiha",
        merchantName: "Esfiharia Sintética",
        price: 5.0,
        deliveryFee: 0,
        // fees ausente -> cost.status = "unknown" e total = undefined
      },
      { origin: mockOrigin },
    );

    const constraints: Constraints = {
      budget: { limit: money(5000), kind: "hard" },
      allergies: [],
      missingCompositionPolicy: "exclude-from-safe-claims",
    };

    const result = evaluateCandidateEligibility(candidateMissingFees, constraints);
    expect(result.eligible).toBe(false);
    expect(result.flags.withinHardBudget).toBe(false);
    expect(result.exclusions).toEqual([
      expect.objectContaining({
        code: "UNKNOWN_TOTAL_FOR_HARD_BUDGET",
        field: "cost.total",
        limit: money(5000),
        missingComponents: ["fees", "total"],
      }),
    ]);
    expect(result.pendingIssues.map((p) => p.code)).toContain("MISSING_FEES");
    expect(result.pendingIssues.map((p) => p.code)).toContain("UNKNOWN_TOTAL");
  });

  it("exclui candidato com alergia incompatível em allergens ou ingredients (insensível a acentos/caixa)", () => {
    const candidateWithAllergen = normalizeCandidate(
      {
        itemId: "item-pad-thai",
        itemName: "Macarrão Oriental",
        merchantId: "m-thai",
        merchantName: "Thai Sintético",
        price: 38.0,
        deliveryFee: 5.0,
        fees: 0,
        composition: {
          ingredients: ["Talharim de arroz", "Tofu", "Broto de feijão", "Farofa de amendoim torrado"],
          allergens: ["Soja"],
        },
      },
      { origin: mockOrigin },
    );

    const constraints: Constraints = {
      allergies: ["Amendoim"],
      missingCompositionPolicy: "exclude-from-safe-claims",
    };

    const result = evaluateCandidateEligibility(candidateWithAllergen, constraints);
    expect(result.eligible).toBe(false);
    expect(result.flags.safeForAllergies).toBe(false);
    expect(result.exclusions).toEqual([
      expect.objectContaining({
        code: "ALLERGY_INCOMPATIBLE",
        allergy: "Amendoim",
        matchedTerm: "Farofa de amendoim torrado",
        field: "composition.ingredients",
      }),
    ]);
  });

  it("não permite declarar segurança quando a composição está ausente e nunca infere ingredientes pelo nome do prato", () => {
    // Mesmo dizendo "Sem Amendoim e Sem Lactose" no nome do prato, sem composition é bloqueado!
    const candidateWithoutComposition = normalizeCandidate(
      {
        itemId: "item-no-comp",
        itemName: "Bowl Vegano Sem Amendoim e Sem Lactose",
        merchantId: "m-vegan",
        merchantName: "Vegano Sintético",
        price: 29.9,
        deliveryFee: 0,
        fees: 0,
      },
      { origin: mockOrigin },
    );

    // E um candidato onde o nome menciona "Camarão", mas a composição não foi informada:
    // o motivo deve ser MISSING_COMPOSITION_FOR_ALLERGY (não inferência pelo nome).
    const candidateNamedShrimpNoComp = normalizeCandidate(
      {
        itemId: "item-shrimp-name",
        itemName: "Risoto de Camarão",
        merchantId: "m-sea",
        merchantName: "Mar Sintético",
        price: 49.9,
        deliveryFee: 0,
        fees: 0,
      },
      { origin: mockOrigin },
    );

    const constraintsWithAllergy: Constraints = {
      allergies: ["amendoim", "camarão"],
      missingCompositionPolicy: "exclude-from-safe-claims",
    };

    const res1 = evaluateCandidateEligibility(candidateWithoutComposition, constraintsWithAllergy);
    expect(res1.eligible).toBe(false);
    expect(res1.flags.safeForAllergies).toBe(false);
    expect(res1.exclusions).toEqual([
      expect.objectContaining({
        code: "MISSING_COMPOSITION_FOR_ALLERGY",
      }),
    ]);

    const res2 = evaluateCandidateEligibility(candidateNamedShrimpNoComp, constraintsWithAllergy);
    expect(res2.eligible).toBe(false);
    expect(res2.flags.safeForAllergies).toBe(false);
    expect(res2.exclusions).toEqual([
      expect.objectContaining({
        code: "MISSING_COMPOSITION_FOR_ALLERGY",
      }),
    ]);

    // Mesmo quando o usuário não tem alergia declarada, composição ausente mantém safeForAllergies = false.
    const resNoAllergy = evaluateCandidateEligibility(candidateWithoutComposition, {
      allergies: [],
      missingCompositionPolicy: "exclude-from-safe-claims",
    });
    expect(resNoAllergy.eligible).toBe(true);
    expect(resNoAllergy.flags.safeForAllergies).toBe(false);
    expect(resNoAllergy.pendingIssues.map((p) => p.code)).toContain("MISSING_COMPOSITION");
  });

  it("garante que preferência flexível não altera nem relaxa limite rígido", () => {
    const baseHardConstraints: Constraints = {
      budget: { limit: money(3500), kind: "hard" },
      allergies: ["glúten"],
      missingCompositionPolicy: "exclude-from-safe-claims",
    };

    // Usuário expressa preferência flexível maior (R$ 50,00) durante refinamento
    const merged = applyFlexiblePreference(baseHardConstraints, {
      budgetLimit: money(5000),
      additionalAllergies: ["leite"],
    });

    // O orçamento em constraints continua sendo hard de R$ 35,00, e alergias foram acumuladas
    expect(merged.constraints.budget).toEqual({ limit: money(3500), kind: "hard" });
    expect(merged.hardBudgetLimit).toEqual(money(3500));
    expect(merged.flexibleBudgetLimit).toEqual(money(5000));
    expect(merged.constraints.allergies).toEqual(["glúten", "leite"]);

    // Candidato de R$ 40,00 (dentro do flexível de R$ 50, mas acima do rígido de R$ 35) deve ser excluído
    const candidate40 = normalizeCandidate(
      {
        itemId: "item-40",
        itemName: "Tapioca Recheada",
        merchantId: "m-tap",
        merchantName: "Tapiocaria",
        price: 35.0,
        deliveryFee: 5.0,
        fees: 0,
        composition: {
          ingredients: ["Goma de mandioca", "Frango desfiado", "Tomate"],
        },
      },
      { origin: mockOrigin },
    );

    const evalResult = evaluateCandidateEligibility(candidate40, merged.constraints, {
      hardBudgetLimit: merged.hardBudgetLimit,
      flexibleBudgetLimit: merged.flexibleBudgetLimit,
    });

    expect(evalResult.eligible).toBe(false);
    expect(evalResult.flags.withinHardBudget).toBe(false);
    expect(evalResult.exclusions.map((e) => e.code)).toContain("EXCEEDS_HARD_BUDGET");
  });

  it("mantém candidato elegível quando excede apenas orçamento flexível, registrando pendência estruturada", () => {
    const candidate = normalizeCandidate(
      {
        itemId: "item-flex",
        itemName: "Marmita Fit",
        merchantId: "m-fit",
        merchantName: "Fit Sintético",
        price: 32.0,
        deliveryFee: 5.0,
        fees: 0,
      },
      { origin: mockOrigin },
    );

    const flexibleConstraints: Constraints = {
      budget: { limit: money(3000), kind: "flexible" },
      allergies: [],
      missingCompositionPolicy: "exclude-from-safe-claims",
    };

    const result = evaluateCandidateEligibility(candidate, flexibleConstraints);
    expect(result.eligible).toBe(true);
    expect(result.flags.withinHardBudget).toBeNull();
    expect(result.flags.withinFlexibleBudget).toBe(false);
    expect(result.pendingIssues).toContainEqual(
      expect.objectContaining({
        code: "EXCEEDS_FLEXIBLE_BUDGET",
        limit: money(3000),
        total: money(3700),
      }),
    );
  });

  it("filtra lote separando elegíveis e excluídos e rejeita entradas inválidas em runtime", () => {
    const c1 = normalizeCandidate(
      {
        itemId: "i-ok",
        itemName: "Salada Completa",
        merchantId: "m-1",
        merchantName: "Verde",
        price: 25.0,
        deliveryFee: 5.0,
        fees: 0,
        composition: { ingredients: ["Alface", "Tomate", "Frango grelhado"] },
      },
      { origin: mockOrigin },
    );
    const c2 = normalizeCandidate(
      {
        itemId: "i-unavail",
        itemName: "Sopa do Dia",
        merchantId: "m-2",
        merchantName: "Sopas",
        price: 20.0,
        deliveryFee: 0,
        fees: 0,
        available: false,
        composition: { ingredients: ["Abóbora", "Água", "Sal"] },
      },
      { origin: mockOrigin },
    );

    const batchResult = filterEligibleCandidates([c1, c2], {
      budget: { limit: money(3000), kind: "hard" },
      allergies: ["amendoim"],
      missingCompositionPolicy: "exclude-from-safe-claims",
    });

    expect(batchResult.eligible).toHaveLength(1);
    expect(batchResult.eligible[0].candidate.itemId).toBe("i-ok");
    expect(batchResult.excluded).toHaveLength(1);
    expect(batchResult.excluded[0].candidate.itemId).toBe("i-unavail");
    expect(batchResult.excluded[0].exclusions[0].code).toBe("UNAVAILABLE_ITEM");

    expect(() =>
      filterEligibleCandidates("invalido" as unknown as [], {
        allergies: [],
        missingCompositionPolicy: "exclude-from-safe-claims",
      }),
    ).toThrow(EligibilityEvaluationError);
  });
});
