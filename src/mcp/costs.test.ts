import { describe, expect, it } from "vitest";
import { CostSchema, MoneySchema } from "@/contracts";
import {
  brlToMoney,
  CostNormalizationError,
  normalizeCandidateCost,
  normalizeCost,
  normalizeItemsSubtotal,
  optionalBrlToMoney,
  resolveItemUnitPrice,
} from "./costs";

describe("normalização de custos em BRL (K-2)", () => {
  it("converte decimais válidos em BRL para centavos inteiros seguros", () => {
    expect(brlToMoney(0)).toEqual({ currency: "BRL", cents: 0 });
    expect(brlToMoney(-0)).toEqual({ currency: "BRL", cents: 0 });
    expect(brlToMoney(0.01)).toEqual({ currency: "BRL", cents: 1 });
    expect(brlToMoney(0.29)).toEqual({ currency: "BRL", cents: 29 });
    expect(brlToMoney(19.99)).toEqual({ currency: "BRL", cents: 1999 });
    expect(brlToMoney(32.9)).toEqual({ currency: "BRL", cents: 3290 });
    expect(brlToMoney(109.9)).toEqual({ currency: "BRL", cents: 10990 });
    expect(MoneySchema.safeParse(brlToMoney(32.9)).success).toBe(true);
  });

  it("preserva ausência em optionalBrlToMoney sem inventar zero", () => {
    expect(optionalBrlToMoney(undefined)).toBeUndefined();
    expect(optionalBrlToMoney(0)).toEqual({ currency: "BRL", cents: 0 });
  });

  it.each([
    -0.01,
    -10,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    0.001,
    10.999,
    19.995,
    1e-9,
    (Number.MAX_SAFE_INTEGER + 1) / 100,
    Number.MAX_VALUE,
  ])("rejeita valores negativos, não finitos, precisão inválida e overflow: %s", (invalid) => {
    expect(() => brlToMoney(invalid)).toThrow(CostNormalizationError);
  });

  it("aplica preço promocional válido e rejeita promoção maior que o preço base", () => {
    expect(resolveItemUnitPrice({ price: 45.9 })).toEqual({ currency: "BRL", cents: 4590 });
    expect(resolveItemUnitPrice({ price: 45.9, promotionalPrice: 34.9 })).toEqual({
      currency: "BRL",
      cents: 3490,
    });
    expect(resolveItemUnitPrice({ price: 25.0, promotionalPrice: 0 })).toEqual({
      currency: "BRL",
      cents: 0,
    });
    expect(() => resolveItemUnitPrice({ price: 30.0, promotionalPrice: 30.01 })).toThrow(
      CostNormalizationError,
    );
  });

  it("soma múltiplos itens com promoção e quantidade, rejeitando quantidades ou subtotais inválidos", () => {
    const subtotal = normalizeItemsSubtotal([
      { price: 40.0, promotionalPrice: 32.9, quantity: 2 },
      { price: 8.5, quantity: 1 },
    ]);
    expect(subtotal).toEqual({ currency: "BRL", cents: 7430 });

    expect(() => normalizeItemsSubtotal([])).toThrow(CostNormalizationError);
    expect(() => normalizeItemsSubtotal([{ price: 10, quantity: 0 }])).toThrow(CostNormalizationError);
    expect(() => normalizeItemsSubtotal([{ price: 10, quantity: 1.5 }])).toThrow(CostNormalizationError);
    expect(() =>
      normalizeItemsSubtotal([{ price: 1000, quantity: Number.MAX_SAFE_INTEGER }]),
    ).toThrow(CostNormalizationError);
  });

  it("aceita frete grátis explícito e taxa zero explícita como custo confirmado ou estimado", () => {
    const confirmed = normalizeCost({
      items: [{ price: 39.9, promotionalPrice: 29.9, quantity: 1 }],
      delivery: 0,
      fees: 0,
      status: "confirmed",
    });
    expect(confirmed).toEqual({
      items: { currency: "BRL", cents: 2990 },
      delivery: { currency: "BRL", cents: 0 },
      fees: { currency: "BRL", cents: 0 },
      total: { currency: "BRL", cents: 2990 },
      status: "confirmed",
    });
    expect(CostSchema.safeParse(confirmed).success).toBe(true);

    const estimated = normalizeCost({
      items: 29.9,
      delivery: 6.5,
      fees: 1.99,
      status: "estimated",
    });
    expect(estimated).toEqual({
      items: { currency: "BRL", cents: 2990 },
      delivery: { currency: "BRL", cents: 650 },
      fees: { currency: "BRL", cents: 199 },
      total: { currency: "BRL", cents: 3839 },
      status: "estimated",
    });
  });

  it("mantém frete ou taxas ausentes como desconhecidos e omite o total", () => {
    const missingFees = normalizeCost({
      items: 32.9,
      delivery: 5.0,
    });
    expect(missingFees).toEqual({
      items: { currency: "BRL", cents: 3290 },
      delivery: { currency: "BRL", cents: 500 },
      status: "unknown",
    });
    expect(missingFees.fees).toBeUndefined();
    expect(missingFees.total).toBeUndefined();

    const missingDelivery = normalizeCost({
      items: 32.9,
      fees: 0,
    });
    expect(missingDelivery.delivery).toBeUndefined();
    expect(missingDelivery.fees).toEqual({ currency: "BRL", cents: 0 });
    expect(missingDelivery.total).toBeUndefined();
    expect(missingDelivery.status).toBe("unknown");

    const explicitUnknown = normalizeCost({
      items: 32.9,
      delivery: 5.0,
      fees: 0,
      status: "unknown",
    });
    expect(explicitUnknown.total).toBeUndefined();
    expect(explicitUnknown.status).toBe("unknown");
  });

  it("normaliza Candidate preservando promoção, frete grátis explícito e taxas ausentes", () => {
    const unknownCandidateCost = normalizeCandidateCost({
      price: 42.0,
      promotionalPrice: 35.5,
      deliveryFee: 0,
    });
    expect(unknownCandidateCost).toEqual({
      items: { currency: "BRL", cents: 3550 },
      delivery: { currency: "BRL", cents: 0 },
      status: "unknown",
    });

    const confirmedCandidateCost = normalizeCandidateCost(
      { price: 42.0, promotionalPrice: 35.5, deliveryFee: 7.9 },
      { quantity: 2, fees: 0, status: "confirmed" },
    );
    expect(confirmedCandidateCost).toEqual({
      items: { currency: "BRL", cents: 7100 },
      delivery: { currency: "BRL", cents: 790 },
      fees: { currency: "BRL", cents: 0 },
      total: { currency: "BRL", cents: 7890 },
      status: "confirmed",
    });
  });

  it("rejeita total sem todos os componentes, total divergente e overflow na soma do total", () => {
    expect(() =>
      normalizeCost({
        items: 30,
        delivery: 5,
        total: 35,
      }),
    ).toThrow(CostNormalizationError);

    expect(() =>
      normalizeCost({
        items: 30,
        delivery: 5,
        fees: 2,
        total: 36,
      }),
    ).toThrow(CostNormalizationError);

    expect(() =>
      normalizeCost({
        items: 30,
        delivery: 5,
        fees: 2,
        total: 37,
        status: "unknown",
      }),
    ).toThrow(CostNormalizationError);

    expect(() =>
      normalizeCost({
        items: { currency: "BRL", cents: Number.MAX_SAFE_INTEGER - 10 },
        delivery: { currency: "BRL", cents: 20 },
        fees: { currency: "BRL", cents: 0 },
      }),
    ).toThrow(CostNormalizationError);
  });
});
