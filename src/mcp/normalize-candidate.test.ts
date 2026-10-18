import { describe, expect, it } from "vitest";
import { CandidateSchema, CostSchema, OriginSchema } from "@/contracts";
import {
  CandidateNormalizationError,
  normalizeCandidate,
  normalizeCandidates,
  NormalizedCandidateSchema,
  toLegacyCandidate,
} from "./normalize-candidate";

const mockOrigin = {
  mode: "mock" as const,
  source: "synthetic-fixture/catalog-v1",
  observedAt: "2026-10-17T20:00:00-03:00",
};

const realOrigin = {
  mode: "real" as const,
  source: "mcp:searchOffers",
  observedAt: "2026-10-17T20:15:00-03:00",
};

describe("normalização de candidatos (Tarefa 2)", () => {
  it("normaliza candidato completo com promoção, encargos confirmados, composição e origem real", () => {
    const normalized = normalizeCandidate(
      {
        itemId: " item-10 ",
        itemName: " Pizza Margherita Artesanal ",
        merchantId: " merchant-20 ",
        merchantName: " Forneria Sintética ",
        price: 54.9,
        promotionalPrice: 44.9,
        deliveryFee: 6.5,
        fees: 1.5,
        costStatus: "confirmed",
        rating: 4.8,
        deliveryTimeMinutes: 35,
        distanceKm: 2.3,
        curated: true,
        available: true,
        category: "pizza",
        composition: {
          ingredients: [" Massa de trigo ", "Molho de tomate", "Muçarela", "Manjericão", "massa de trigo"],
          allergens: [" Glúten ", "Leite", "glúten"],
        },
        origin: realOrigin,
        history: {
          merchantId: "merchant-20",
          timesOrdered: 4,
          lastOrderedAt: "2026-10-10T20:00:00-03:00",
          lastOrderId: "order-syn-1",
        },
      },
    );

    expect(NormalizedCandidateSchema.safeParse(normalized).success).toBe(true);
    expect(CostSchema.safeParse(normalized.cost).success).toBe(true);
    expect(OriginSchema.safeParse(normalized.origins[0]).success).toBe(true);

    expect(normalized.itemId).toBe("item-10");
    expect(normalized.itemName).toBe("Pizza Margherita Artesanal");
    expect(normalized.merchantId).toBe("merchant-20");
    expect(normalized.merchantName).toBe("Forneria Sintética");
    expect(normalized.regularUnitPrice).toEqual({ currency: "BRL", cents: 5490 });
    expect(normalized.unitPrice).toEqual({ currency: "BRL", cents: 4490 });
    expect(normalized.cost).toEqual({
      items: { currency: "BRL", cents: 4490 },
      delivery: { currency: "BRL", cents: 650 },
      fees: { currency: "BRL", cents: 150 },
      total: { currency: "BRL", cents: 5290 },
      status: "confirmed",
    });
    expect(normalized.origins).toEqual([realOrigin]);
    expect(normalized.composition).toEqual({
      ingredients: ["Massa de trigo", "Molho de tomate", "Muçarela", "Manjericão"],
      allergens: ["Glúten", "Leite"],
    });
    expect(normalized.history?.timesOrdered).toBe(4);
    expect(normalized.uncertainties).toEqual([]);
  });

  it("preserva ausências sem fabricar disponibilidade, composição, avaliação, histórico ou taxas", () => {
    const normalized = normalizeCandidate(
      {
        itemId: "item-min-1",
        itemName: "Prato Executivo Sintético",
        merchantId: "merchant-min-1",
        merchantName: "Restaurante Simples",
        price: 28.0,
      },
      { origin: mockOrigin },
    );

    expect(normalized.origins).toEqual([mockOrigin]);
    expect(normalized.promotionalPrice).toBeUndefined();
    expect(normalized.deliveryFee).toBeUndefined();
    expect(normalized.rating).toBeUndefined();
    expect(normalized.deliveryTimeMinutes).toBeUndefined();
    expect(normalized.distanceKm).toBeUndefined();
    expect(normalized.curated).toBeUndefined();
    expect(normalized.available).toBeUndefined();
    expect(normalized.composition).toBeUndefined();
    expect(normalized.history).toBeUndefined();

    expect(normalized.cost).toEqual({
      items: { currency: "BRL", cents: 2800 },
      status: "unknown",
    });
    expect(normalized.cost.delivery).toBeUndefined();
    expect(normalized.cost.fees).toBeUndefined();
    expect(normalized.cost.total).toBeUndefined();
    expect(normalized.uncertainties).toEqual([
      "Frete desconhecido",
      "Taxas desconhecidas",
      "Total não confirmado",
      "Composição completa não informada",
    ]);

    const legacy = toLegacyCandidate(normalized);
    expect(CandidateSchema.safeParse(legacy).success).toBe(true);
    expect(legacy).not.toHaveProperty("rating");
    expect(legacy).not.toHaveProperty("deliveryFee");
    expect(legacy).not.toHaveProperty("curated");
  });

  it("preserva frete grátis explícito e custo estimado quando taxas são conhecidas", () => {
    const normalized = normalizeCandidate(
      {
        itemId: "item-free-del",
        itemName: "Tigela de Açaí 500ml",
        merchantId: "merchant-acai",
        merchantName: "Açaí Sintético",
        price: 22.5,
        deliveryFee: 0,
        fees: 0,
        costStatus: "estimated",
      },
      { origin: mockOrigin },
    );

    expect(normalized.cost).toEqual({
      items: { currency: "BRL", cents: 2250 },
      delivery: { currency: "BRL", cents: 0 },
      fees: { currency: "BRL", cents: 0 },
      total: { currency: "BRL", cents: 2250 },
      status: "estimated",
    });
    expect(normalized.uncertainties).toContain("Custos estimados sujeitos a confirmação no iFood");
    expect(normalized.uncertainties).toContain("Composição completa não informada");
  });

  it("descarta objeto composition vazio sem fingir que ingredientes foram informados", () => {
    const normalized = normalizeCandidate(
      {
        itemId: "item-empty-comp",
        itemName: "Sanduíche Natural",
        merchantId: "merchant-sand",
        merchantName: "Lanches Sintéticos",
        price: 18.9,
        composition: {
          ingredients: [],
          allergens: [],
        },
      },
      { origin: mockOrigin },
    );

    expect(normalized.composition).toBeUndefined();
    expect(normalized.uncertainties).toContain("Composição completa não informada");
  });

  it("normaliza lote de candidatos associando histórico apenas ao estabelecimento correspondente", () => {
    const batch = normalizeCandidates(
      [
        {
          itemId: "i-1",
          itemName: "Burger Sintético 1",
          merchantId: "m-1",
          merchantName: "Loja 1",
          price: 25.0,
          deliveryFee: 5.0,
        },
        {
          itemId: "i-2",
          itemName: "Burger Sintético 2",
          merchantId: "m-2",
          merchantName: "Loja 2",
          price: 30.0,
        },
      ],
      {
        origin: mockOrigin,
        history: [{ merchantId: "m-1", timesOrdered: 2 }],
      },
    );

    expect(batch).toHaveLength(2);
    expect(batch[0].history).toEqual({ merchantId: "m-1", timesOrdered: 2 });
    expect(batch[1].history).toBeUndefined();
  });

  it("rejeita entradas inválidas em runtime (preços, notas, prazos, origem ausente, histórico divergente e campos extras)", () => {
    const validBase = {
      itemId: "i-1",
      itemName: "Prato Sintético",
      merchantId: "m-1",
      merchantName: "Loja Sintética",
      price: 25.0,
    };

    // Sem origem
    expect(() => normalizeCandidate(validBase)).toThrow(CandidateNormalizationError);

    // Preço inválido ou promoção maior que o preço base
    expect(() => normalizeCandidate({ ...validBase, price: -1 }, { origin: mockOrigin })).toThrow(
      CandidateNormalizationError,
    );
    expect(() => normalizeCandidate({ ...validBase, price: 19.999 }, { origin: mockOrigin })).toThrow(
      CandidateNormalizationError,
    );
    expect(() =>
      normalizeCandidate({ ...validBase, price: 20, promotionalPrice: 25 }, { origin: mockOrigin }),
    ).toThrow(CandidateNormalizationError);

    // Avaliação, prazo ou distância inválidos
    expect(() => normalizeCandidate({ ...validBase, rating: 5.1 }, { origin: mockOrigin })).toThrow(
      CandidateNormalizationError,
    );
    expect(() => normalizeCandidate({ ...validBase, rating: -0.1 }, { origin: mockOrigin })).toThrow(
      CandidateNormalizationError,
    );
    expect(() =>
      normalizeCandidate({ ...validBase, deliveryTimeMinutes: 0 }, { origin: mockOrigin }),
    ).toThrow(CandidateNormalizationError);
    expect(() =>
      normalizeCandidate({ ...validBase, distanceKm: -1 }, { origin: mockOrigin }),
    ).toThrow(CandidateNormalizationError);

    // Histórico pertencente a outro merchantId
    expect(() =>
      normalizeCandidate(
        {
          ...validBase,
          history: { merchantId: "m-outro", timesOrdered: 1 },
        },
        { origin: mockOrigin },
      ),
    ).toThrow(CandidateNormalizationError);

    // Campos desconhecidos ou privados (strictObject)
    expect(() =>
      normalizeCandidate(
        {
          ...validBase,
          subjectRef: "user-secret",
        },
        { origin: mockOrigin },
      ),
    ).toThrow(CandidateNormalizationError);
  });
});
