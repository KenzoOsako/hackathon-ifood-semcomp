import { describe, expect, it } from "vitest";
import { ProposalStore } from "@/agent/proposals";
import {
  approveProposalWithHandoff,
  buildProposalFromCandidate,
  evaluateAndRankSearchCandidates,
  parseSearchIntentFromText,
} from "./proposal-workflow";

const sampleAddress = {
  addressId: "addr-1",
  alias: "Casa",
  formatted: "Rua das Acácias, 100 - Campinas/SP",
};

describe("fluxo de domínio de propostas e busca (K-1, K-4, K-5)", () => {
  it("cria proposta aprovável quando item, frete e taxas são confirmados e gera resumo manual no handoff", () => {
    const store = new ProposalStore(2);
    const built = buildProposalFromCandidate(store, {
      subjectRef: "visitor-1",
      address: sampleAddress,
      candidate: {
        merchantId: "m-5",
        merchantName: "Forno & Cia",
        itemId: "i-5",
        itemName: "Pizza calabresa",
        price: 39.9,
        deliveryFee: 5.9,
        fees: 0,
        costStatus: "confirmed",
      },
      mode: "mock",
    });

    expect(built.publicProposal.state).toBe("awaiting_approval");
    expect(built.publicProposal.cost).toEqual({
      items: { currency: "BRL", cents: 3990 },
      delivery: { currency: "BRL", cents: 590 },
      fees: { currency: "BRL", cents: 0 },
      total: { currency: "BRL", cents: 4580 },
      status: "confirmed",
    });
    expect(built.publicProposal.unresolved).toEqual([]);
    expect(built.reply).toContain("Pronta para aprovação explícita");

    const approved = approveProposalWithHandoff(store, {
      subjectRef: "visitor-1",
      request: {
        proposalId: built.proposal.id,
        version: built.proposal.version,
        interactionId: "click-1",
        channel: "button",
      },
      presentation: built.presentation,
    });

    expect(approved.publicProposal.state).toBe("approved");
    expect(approved.handoff.transferMode).toBe("manual_copy");
    expect(approved.handoff.remoteCartCreated).toBe(false);
    expect(approved.handoff.orderSubmitted).toBe(false);
    expect(approved.reply).toContain("Nenhum item foi adicionado e nenhum pedido foi enviado");
    expect(approved.reply).toContain("=== RESUMO MANUAL DO PEDIDO [DADOS SIMULADOS / MOCK] ===");
    expect(approved.reply).toContain("Estabelecimento: Forno & Cia");
    expect(approved.reply).toContain("1x Pizza calabresa");
    expect(approved.reply).toContain("Total: R$ 45,80 (confirmado na proposta)");
  });

  it("mantém status unknown e bloqueia aprovação quando taxas estão ausentes", () => {
    const store = new ProposalStore(2);
    const built = buildProposalFromCandidate(store, {
      subjectRef: "visitor-1",
      address: sampleAddress,
      candidate: {
        merchantId: "m-3",
        merchantName: "Lanchonete da Praça",
        itemId: "i-3",
        itemName: "X-Burger",
        price: 19.5,
        promotionalPrice: 16.9,
        deliveryFee: 0,
      },
      mode: "mock",
    });

    expect(built.publicProposal.state).toBe("awaiting_approval");
    expect(built.publicProposal.cost).toEqual({
      items: { currency: "BRL", cents: 1690 },
      delivery: { currency: "BRL", cents: 0 },
      status: "unknown",
    });
    expect(built.publicProposal.cost.total).toBeUndefined();
    expect(built.publicProposal.unresolved).toContain("Taxas e total não confirmados");

    expect(() =>
      approveProposalWithHandoff(store, {
        subjectRef: "visitor-1",
        request: {
          proposalId: built.proposal.id,
          version: built.proposal.version,
          interactionId: "click-bloqueado",
          channel: "button",
        },
        presentation: built.presentation,
      }),
    ).toThrow(/Proposta com pendências não pode estar aprovada/);
  });

  it("filtra candidatos pelo teto rígido considerando o total com frete e taxas e exclui alérgenos incompatíveis", () => {
    const candidates = [
      {
        merchantId: "m-4",
        merchantName: "Pizzaria Nonna",
        itemId: "i-4",
        itemName: "Pizza margherita",
        price: 48.0,
        deliveryFee: 6.5,
        fees: 1.5,
        costStatus: "confirmed" as const,
        composition: {
          ingredients: ["Massa de trigo", "Molho de tomate", "Muçarela"],
          allergens: ["Glúten", "Leite"],
        },
      },
      {
        merchantId: "m-5",
        merchantName: "Forno & Cia",
        itemId: "i-5",
        itemName: "Pizza calabresa",
        price: 39.9,
        deliveryFee: 5.9,
        fees: 0,
        costStatus: "confirmed" as const,
        composition: {
          ingredients: ["Massa de trigo", "Molho de tomate", "Calabresa"],
          allergens: ["Glúten"],
        },
      },
    ];

    // Teto rígido de R$ 50,00: Pizza margherita custa R$ 48,00 no item, mas R$ 56,00 no total (excluída).
    const byBudget = evaluateAndRankSearchCandidates({
      candidates,
      history: [],
      hardBudgetBrl: 50,
    });
    expect(byBudget.options).toHaveLength(1);
    expect(byBudget.options[0].candidate.merchantId).toBe("m-5");
    expect(byBudget.recommendations).toHaveLength(1);
    expect(byBudget.recommendations[0].ref).toBe("i-5");

    // Restrição de alergia a leite: exclui Pizza margherita (contém Leite/Muçarela).
    const byAllergy = evaluateAndRankSearchCandidates({
      candidates,
      history: [],
      allergies: ["leite"],
    });
    expect(byAllergy.options).toHaveLength(1);
    expect(byAllergy.options[0].candidate.merchantId).toBe("m-5");
  });

  it("extrai intenção de busca, teto rígido e alergias do texto normalizado", () => {
    const parsed = parseSearchIntentFromText(
      "Quero pizza sem lactose até R$ 50,00",
      "quero pizza sem lactose ate r$ 50,00",
    );
    expect(parsed).toEqual({
      foodQuery: "pizza",
      hardBudgetBrl: 50,
      allergies: ["leite"],
    });
  });
});
