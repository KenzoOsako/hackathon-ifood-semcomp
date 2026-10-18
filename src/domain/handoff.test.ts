import { describe, expect, it } from "vitest";
import { toPublicProposal, type PublicProposal } from "@/contracts";
import {
  buildManualHandoffSummary,
  formatManualHandoffText,
  HandoffSummaryError,
} from "./handoff";

const money = (cents: number) => ({ currency: "BRL" as const, cents });

const baseProposal: PublicProposal = {
  id: "prop-101",
  version: 2,
  state: "approved",
  items: [
    { ref: "item-pizza", quantity: 2, unitPrice: money(3990) },
    { ref: "item-refri", quantity: 1, unitPrice: money(1200) },
  ],
  cost: {
    items: money(9180),
    delivery: money(790),
    fees: money(150),
    total: money(10120),
    status: "confirmed",
  },
  unresolved: [],
  expiresAt: "2026-10-18T12:00:00-03:00",
};

describe("resumo manual para continuidade no iFood (K-4)", () => {
  it("exibe itens, quantidades, preços, encargos conhecidos e ausência de pendências em proposta aprovada", () => {
    const summary = buildManualHandoffSummary({
      proposal: baseProposal,
      presentation: {
        mode: "real",
        merchantName: "Pizzaria Forno D'Oro",
        addressLabel: "Casa",
        itemNames: {
          "item-pizza": "Pizza Calabresa Artesanal",
          "item-refri": "Guaraná 2L",
        },
      },
      now: "2026-10-18T11:00:00-03:00",
    });

    expect(summary.isSimulated).toBe(false);
    expect(summary.isEstimated).toBe(false);
    expect(summary.isExpired).toBe(false);
    expect(summary.requiresNewReview).toBe(false);
    expect(summary.unresolved).toEqual([]);
    expect(summary.remoteCartCreated).toBe(false);
    expect(summary.orderSubmitted).toBe(false);
    expect(summary.transferMode).toBe("manual_copy");

    expect(summary.text).toContain("[DADOS REAIS / MCP]");
    expect(summary.text).toContain("Pizzaria Forno D'Oro");
    expect(summary.text).toContain("Local de entrega (referência): Casa");
    expect(summary.text).toContain(
      "2x Pizza Calabresa Artesanal: R$ 39,90 cada | subtotal R$ 79,80",
    );
    expect(summary.text).toContain("1x Guaraná 2L: R$ 12,00 cada | subtotal R$ 12,00");
    expect(summary.text).toContain("Subtotal dos itens: R$ 91,80");
    expect(summary.text).toContain("Frete: R$ 7,90");
    expect(summary.text).toContain("Taxas: R$ 1,50");
    expect(summary.text).toContain("Total: R$ 101,20 (confirmado na proposta)");
    expect(summary.text).toContain("Pendências: nenhuma.");
    expect(summary.text).toContain(
      "Nenhuma compra, reserva ou criação de carrinho remoto foi realizada pelo Mimo.",
    );
  });

  it("identifica valores estimados e dados simulados (mock) explicitamente", () => {
    const estimatedProposal: PublicProposal = {
      ...baseProposal,
      state: "awaiting_approval",
      cost: {
        items: money(9180),
        delivery: money(0),
        fees: money(200),
        total: money(9380),
        status: "estimated",
      },
      unresolved: ["Confirmar disponibilidade de borda recheada"],
    };

    const summary = buildManualHandoffSummary({
      proposal: estimatedProposal,
      presentation: {
        origins: [{ mode: "mock", source: "fixtures/discovery.json", observedAt: "2026-10-17T20:00:00-03:00" }],
        merchantName: "Pizzaria Mock",
      },
      now: "2026-10-18T11:00:00-03:00",
    });

    expect(summary.isSimulated).toBe(true);
    expect(summary.isEstimated).toBe(true);
    expect(summary.requiresNewReview).toBe(true);
    expect(summary.text).toContain("[DADOS SIMULADOS / MOCK]");
    expect(summary.text).toContain("Origem dos dados: Simulado");
    expect(summary.text).toContain("Frete: R$ 0,00 (grátis explícito) (estimado)");
    expect(summary.text).toContain("Taxas: R$ 2,00 (estimado)");
    expect(summary.text).toContain(
      "Total estimado: R$ 93,80 (valor estimado, sujeito a confirmação no iFood)",
    );
    expect(summary.text).not.toContain("(confirmado na proposta)");
    expect(summary.text).toContain("Confirmar disponibilidade de borda recheada");
  });

  it("nunca apresenta total desconhecido como zero ou confirmado e lista encargos ausentes como pendências", () => {
    const unknownCostProposal: PublicProposal = {
      ...baseProposal,
      state: "awaiting_approval",
      cost: {
        items: money(9180),
        status: "unknown",
      },
      unresolved: ["Taxas e total não confirmados"],
    };

    const text = formatManualHandoffText({
      proposal: unknownCostProposal,
      presentation: { mode: "mock" },
      now: "2026-10-18T11:00:00-03:00",
    });

    expect(text).toContain("Frete: desconhecido (pendente)");
    expect(text).toContain("Taxas: desconhecidas (pendente)");
    expect(text).toContain("Total: desconhecido (não confirmado — depende de encargos pendentes)");
    expect(text).not.toContain("Total: R$ 0,00");
    expect(text).not.toContain("Total estimado:");
    expect(text).not.toContain("(confirmado na proposta)");
    expect(text).toContain("- Taxas e total não confirmados");
    expect(text).toContain("- Frete desconhecido");
    expect(text).toContain("- Taxas desconhecidas");
  });

  it("marca proposta expirada por estado ou relógio como exigindo nova revisão", () => {
    const expiredByClock = buildManualHandoffSummary({
      proposal: baseProposal,
      presentation: { mode: "real" },
      now: "2026-10-18T12:00:01-03:00",
    });

    expect(expiredByClock.isExpired).toBe(true);
    expect(expiredByClock.state).toBe("expired");
    expect(expiredByClock.requiresNewReview).toBe(true);
    expect(expiredByClock.text).toContain(
      "ATENÇÃO: Proposta expirada. Exige nova revisão antes de continuar no iFood.",
    );
    expect(expiredByClock.unresolved).toContain("Proposta expirada — exige nova revisão");

    const expiredByState = buildManualHandoffSummary({
      proposal: { ...baseProposal, state: "expired" },
      presentation: { mode: "real" },
      now: "2026-10-18T10:00:00-03:00",
    });
    expect(expiredByState.isExpired).toBe(true);
    expect(expiredByState.requiresNewReview).toBe(true);
  });

  it("rejeita sujeito interno, tokens, campos privados extras e URLs/deeplinks não validados", () => {
    const internalSnapshot = {
      ...baseProposal,
      subjectRef: "visitor-secret-123",
      addressRef: "addr-internal-9",
    };

    // Se o chamador esquecer toPublicProposal e passar subjectRef/addressRef, deve falhar fechado.
    expect(() =>
      buildManualHandoffSummary({
        proposal: internalSnapshot as unknown as PublicProposal,
      }),
    ).toThrow(HandoffSummaryError);

    // Projetando via toPublicProposal, os campos privados são removidos na borda do contrato.
    const safeProposal = toPublicProposal({
      ...internalSnapshot,
      merchantRef: "merchant-1",
    });
    const summary = buildManualHandoffSummary({
      proposal: safeProposal,
      now: "2026-10-18T11:00:00-03:00",
    });
    expect(summary.text).not.toContain("visitor-secret-123");
    expect(summary.text).not.toContain("addr-internal-9");
    expect(summary.text).not.toMatch(/https?:\/\/|ifood:\/\//i);

    // Rejeita tokens ou campos extras em presentation.
    expect(() =>
      buildManualHandoffSummary({
        proposal: baseProposal,
        presentation: {
          mode: "real",
          merchantName: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
        },
      }),
    ).toThrow(HandoffSummaryError);

    expect(() =>
      buildManualHandoffSummary({
        proposal: baseProposal,
        presentation: {
          mode: "real",
          merchantName: "Loja https://ifood.com.br/checkout",
        },
      }),
    ).toThrow(HandoffSummaryError);

    expect(() =>
      buildManualHandoffSummary({
        proposal: baseProposal,
        presentation: {
          mode: "real",
          token: "secret-token",
        } as unknown as { mode: "real" },
      }),
    ).toThrow(HandoffSummaryError);
  });
});
