import { describe, expect, it } from "vitest";
import {
  RecommendationSchema,
  type AuthorizedContext,
  type Constraints,
} from "@/contracts";
import { normalizeCandidate } from "@/mcp/normalize-candidate";
import { filterEligibleCandidates } from "./eligibility";
import {
  rankEligibleCandidates,
  rankEligibleFilterResult,
  RankingError,
} from "./rank-eligible";

const catalogOrigin = {
  mode: "mock" as const,
  source: "synthetic-fixture/catalog",
  observedAt: "2026-10-17T20:00:00-03:00",
};

const memoryOrigin = {
  mode: "real" as const,
  source: "memory:user-preferences",
  observedAt: "2026-10-17T20:05:00-03:00",
};

const money = (cents: number) => ({ currency: "BRL" as const, cents });

const openConstraints: Constraints = {
  allergies: [],
  missingCompositionPolicy: "exclude-from-safe-claims",
};

describe("ranking determinístico com evidências (Tarefa 4)", () => {
  it("retorna até 3 opções sem completar artificialmente quando há 0, 1, 2 ou mais candidatos elegíveis", () => {
    const c1 = normalizeCandidate(
      {
        itemId: "i-1",
        itemName: "Opção 1",
        merchantId: "m-1",
        merchantName: "Loja 1",
        price: 25.0,
        deliveryFee: 5.0,
        fees: 0,
      },
      { origin: catalogOrigin },
    );
    const c2 = normalizeCandidate(
      {
        itemId: "i-2",
        itemName: "Opção 2",
        merchantId: "m-2",
        merchantName: "Loja 2",
        price: 28.0,
        deliveryFee: 5.0,
        fees: 0,
      },
      { origin: catalogOrigin },
    );

    expect(rankEligibleCandidates([], openConstraints).recommendations).toHaveLength(0);
    expect(rankEligibleCandidates([c1], openConstraints).recommendations).toHaveLength(1);
    expect(rankEligibleCandidates([c1, c2], openConstraints).recommendations).toHaveLength(2);

    const fiveCandidates = [1, 2, 3, 4, 5].map((n) =>
      normalizeCandidate(
        {
          itemId: `i-${n}`,
          itemName: `Prato ${n}`,
          merchantId: `m-${n}`,
          merchantName: `Loja ${n}`,
          price: 20 + n,
          deliveryFee: 4.0,
          fees: 0,
        },
        { origin: catalogOrigin },
      ),
    );

    const topThree = rankEligibleCandidates(fiveCandidates, openConstraints);
    expect(topThree.recommendations).toHaveLength(3);
    expect(topThree.recommendations.map((r) => r.ref)).toEqual(["i-1", "i-2", "i-3"]);
  });

  it("garante que candidato excluído nunca reaparece, inclusive se injetado manualmente na lista de elegíveis", () => {
    const safeCandidate = normalizeCandidate(
      {
        itemId: "i-safe",
        itemName: "Bowl de Frango",
        merchantId: "m-safe",
        merchantName: "Cozinha Segura",
        price: 30.0,
        deliveryFee: 5.0,
        fees: 0,
        composition: {
          ingredients: ["Arroz", "Frango", "Brócolis"],
        },
      },
      { origin: catalogOrigin },
    );

    const allergicCandidate = normalizeCandidate(
      {
        itemId: "i-peanut",
        itemName: "Frango Oriental",
        merchantId: "m-peanut",
        merchantName: "Cozinha Oriental",
        price: 15.0, // Mais barato, mas incompatível com alergia!
        deliveryFee: 0,
        fees: 0,
        composition: {
          ingredients: ["Frango", "Molho shoyu", "Amendoim"],
          allergens: ["Amendoim", "Soja"],
        },
      },
      { origin: catalogOrigin },
    );

    const constraints: Constraints = {
      budget: { limit: money(4000), kind: "hard" },
      allergies: ["amendoim"],
      missingCompositionPolicy: "exclude-from-safe-claims",
    };

    const filterResult = filterEligibleCandidates([safeCandidate, allergicCandidate], constraints);
    expect(filterResult.eligible).toHaveLength(1);
    expect(filterResult.excluded).toHaveLength(1);

    // Tentativa de adulterar filterResult.eligible reinserindo o candidato excluído:
    const tamperedFilterResult = {
      ...filterResult,
      eligible: [
        ...filterResult.eligible,
        {
          ...filterResult.excluded[0],
          eligible: true,
          exclusions: [],
        },
      ],
    };

    const ranked = rankEligibleFilterResult(tamperedFilterResult);
    expect(ranked.recommendations).toHaveLength(1);
    expect(ranked.recommendations[0].ref).toBe("i-safe");
    expect(ranked.excluded.map((e) => e.candidate.itemId)).toContain("i-peanut");
  });

  it("produz ordenação determinística, reproduzível e com desempate estável sem converter dados ausentes em zero", () => {
    // Candidato com frete/taxas desconhecidos e item R$ 25,00 NÃO deve vencer
    // candidato com total confirmado de R$ 30,00 (item R$ 25,00 + frete R$ 5,00 + taxas R$ 0,00).
    const unknownCostCandidate = normalizeCandidate(
      {
        itemId: "i-unknown",
        itemName: "Marmita Sem Taxa Informada",
        merchantId: "m-unknown",
        merchantName: "Loja Incerta",
        price: 25.0,
      },
      { origin: catalogOrigin },
    );

    const confirmedTieB = normalizeCandidate(
      {
        itemId: "i-b",
        itemName: "Marmita Confirmada B",
        merchantId: "m-b",
        merchantName: "Loja B",
        price: 25.0,
        deliveryFee: 5.0,
        fees: 0,
        rating: 4.7,
        deliveryTimeMinutes: 30,
      },
      { origin: catalogOrigin },
    );

    const confirmedTieA = normalizeCandidate(
      {
        itemId: "i-a",
        itemName: "Marmita Confirmada A",
        merchantId: "m-a",
        merchantName: "Loja A",
        price: 25.0,
        deliveryFee: 5.0,
        fees: 0,
        rating: 4.7,
        deliveryTimeMinutes: 30,
      },
      { origin: catalogOrigin },
    );

    const run1 = rankEligibleCandidates(
      [unknownCostCandidate, confirmedTieB, confirmedTieA],
      openConstraints,
    );
    const run2 = rankEligibleCandidates(
      [confirmedTieA, unknownCostCandidate, confirmedTieB],
      openConstraints,
    );

    expect(run1.recommendations.map((r) => r.ref)).toEqual(["i-a", "i-b", "i-unknown"]);
    expect(run2.recommendations).toEqual(run1.recommendations);

    for (const rec of run1.recommendations) {
      expect(RecommendationSchema.safeParse(rec).success).toBe(true);
    }
  });

  it("não trata histórico recente ausente como 'nunca pediu' nem frequência como 'favorito declarado'", () => {
    const withoutHistory = normalizeCandidate(
      {
        itemId: "i-no-hist",
        itemName: "Pizza Broto",
        merchantId: "m-no-hist",
        merchantName: "Pizzaria Alfa",
        price: 30.0,
        deliveryFee: 0,
        fees: 0,
      },
      { origin: catalogOrigin },
    );

    const withFrequentOrders = normalizeCandidate(
      {
        itemId: "i-freq",
        itemName: "Pizza Média",
        merchantId: "m-freq",
        merchantName: "Pizzaria Beta",
        price: 30.0,
        deliveryFee: 0,
        fees: 0,
        history: {
          merchantId: "m-freq",
          timesOrdered: 5,
        },
      },
      { origin: catalogOrigin },
    );

    const result = rankEligibleCandidates([withoutHistory, withFrequentOrders], openConstraints);
    expect(result.recommendations).toHaveLength(2);

    // O candidato com 5 pedidos no histórico recente desempata à frente do sem histórico:
    expect(result.recommendations[0].ref).toBe("i-freq");
    expect(result.recommendations[1].ref).toBe("i-no-hist");

    const freqTexts = result.recommendations[0].reasons.map((r) => r.text.toLowerCase());
    expect(freqTexts.some((t) => t.includes("5 pedidos registrados no histórico recente"))).toBe(
      true,
    );
    // Frequência observada nunca é chamada de favorito declarado
    expect(freqTexts.some((t) => t.includes("favorito"))).toBe(false);

    const noHistTexts = result.recommendations[1].reasons.map((r) => r.text.toLowerCase());
    // Ausência no histórico recente nunca diz que o usuário "nunca pediu" ou "ainda não pediu"
    expect(noHistTexts.some((t) => t.includes("nunca pediu"))).toBe(false);
    expect(noHistTexts.some((t) => t.includes("ainda não pediu"))).toBe(false);
    expect(noHistTexts.some((t) => t.includes("novidade"))).toBe(false);
  });

  it("vincula preferência declarada (basis='declared') à origem do contexto autorizado e ignora basis='observed' como favorito declarado", () => {
    const sushiCandidate = normalizeCandidate(
      {
        itemId: "i-sushi",
        itemName: "Combinado Salmão",
        merchantId: "m-sushi",
        merchantName: "Sushi Sintético",
        category: "sushi",
        price: 45.0,
        deliveryFee: 5.0,
        fees: 0,
      },
      { origin: catalogOrigin },
    );

    const burgerCandidate = normalizeCandidate(
      {
        itemId: "i-burger",
        itemName: "Smash Burger",
        merchantId: "m-burger",
        merchantName: "Burger Sintético",
        category: "hamburguer",
        price: 35.0,
        deliveryFee: 5.0,
        fees: 0,
      },
      { origin: catalogOrigin },
    );

    const authorizedContext: AuthorizedContext = {
      subjectRef: "subj-1",
      authorizedPurposes: ["recommendations"],
      origins: [memoryOrigin],
      preferences: [
        { value: "sushi", basis: "declared" },
        { value: "hamburguer", basis: "observed" },
      ],
      addresses: [],
    };

    const result = rankEligibleCandidates([burgerCandidate, sushiCandidate], openConstraints, {
      authorizedContext,
    });

    expect(result.recommendations[0].ref).toBe("i-sushi");
    const sushiRec = result.recommendations[0];
    expect(RecommendationSchema.safeParse(sushiRec).success).toBe(true);
    expect(sushiRec.origins).toEqual([catalogOrigin, memoryOrigin]);
    expect(sushiRec.evidence).toContainEqual({
      ref: "ev:i-sushi:preferences.declared",
      originIndex: 1,
      field: "preferences.declared",
    });
    expect(sushiRec.reasons).toContainEqual({
      text: 'Alinhado à preferência declarada pelo usuário ("sushi")',
      evidenceRef: "ev:i-sushi:preferences.declared",
    });

    // O candidato com preferência apenas "observed" não recebe razão de preferência declarada
    const burgerRec = result.recommendations[1];
    expect(burgerRec.evidence.some((e) => e.field === "preferences.declared")).toBe(false);
  });

  it("rejeita limites ou contextos inválidos em runtime", () => {
    expect(() => rankEligibleCandidates([], openConstraints, { limit: 0 })).toThrow(RankingError);
    expect(() => rankEligibleCandidates([], openConstraints, { limit: 4 })).toThrow(RankingError);
  });
});
