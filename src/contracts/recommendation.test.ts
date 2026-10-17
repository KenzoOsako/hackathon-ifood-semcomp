import { describe, expect, it } from "vitest";
import { AuthorizedContextSchema, InterpretedIntentSchema, PublicAgentTurnSchema, PublicProposalSchema, RecommendationSchema, toPublicProposal } from "./recommendation";

const origin = { mode: "mock", source: "fixture", observedAt: "2026-10-17T19:00:00-03:00" };
const money = { currency: "BRL", cents: 1000 };
const cost = { items: money, status: "unknown" };
const recommendation = {
  ref: "item1", merchantRef: "merchant1", title: "Prato de teste", cost,
  origins: [origin], evidence: [{ ref: "e1", originIndex: 0, field: "price" }],
  reasons: [{ text: "Item custa R$ 10,00", evidenceRef: "e1" }], uncertainties: ["Frete desconhecido"],
};
const constraints = { allergies: [], missingCompositionPolicy: "exclude-from-safe-claims" };

describe("fronteiras de interpretação e recomendação", () => {
  it("aceita intenção sem conceder autoridade transacional ao LLM", () => {
    const intent = { action: "search", query: "almoço", constraints, uncertainties: [] };
    expect(InterpretedIntentSchema.safeParse(intent).success).toBe(true);
    expect(InterpretedIntentSchema.safeParse({ ...intent, action: "submitOrder" }).success).toBe(false);
    expect(InterpretedIntentSchema.safeParse({ ...intent, approved: true }).success).toBe(false);
    expect(InterpretedIntentSchema.safeParse({ ...intent, action: "select" }).success).toBe(false);
  });
  it("exige propósito para dados internos e rejeita credenciais extras", () => {
    const context = { subjectRef: "s1", authorizedPurposes: ["recommendations"], origins: [origin],
      preferences: [{ value: "pizza", basis: "declared" }], addresses: [] };
    expect(AuthorizedContextSchema.safeParse(context).success).toBe(true);
    expect(AuthorizedContextSchema.safeParse({ ...context, addresses: [{ ref: "a1", label: "Casa" }] }).success).toBe(false);
    expect(AuthorizedContextSchema.safeParse({ ...context, token: "synthetic" }).success).toBe(false);
    expect(AuthorizedContextSchema.safeParse({ ...context, authorizedPurposes: [] }).success).toBe(false);
  });
  it("preserva mock e ausências, rejeitando razão sem evidência ou origem", () => {
    expect(RecommendationSchema.parse(recommendation).origins[0].mode).toBe("mock");
    for (const change of [{ origins: [] }, { reasons: [{ text: "Favorito", evidenceRef: "inexistente" }] },
      { evidence: [{ ref: "e1", originIndex: 1, field: "price" }] }, { evidence: [recommendation.evidence[0], recommendation.evidence[0]] }]) {
      expect(RecommendationSchema.safeParse({ ...recommendation, ...change }).success).toBe(false);
    }
  });
  it("limita resposta pública a três recomendações e rejeita contexto privado", () => {
    const turn = { reply: "Veja as opções", state: "choosing", recommendations: [recommendation] };
    expect(PublicAgentTurnSchema.safeParse(turn).success).toBe(true);
    expect(PublicAgentTurnSchema.safeParse({ ...turn, recommendations: Array(4).fill(recommendation) }).success).toBe(false);
    expect(PublicAgentTurnSchema.safeParse({ ...turn, subjectRef: "s1" }).success).toBe(false);
  });
  it("projeta proposta sem identidade nem endereço interno", () => {
    const proposal = { id: "p1", version: 1, subjectRef: "s1", merchantRef: "m1", addressRef: "a1",
      state: "draft", items: [{ ref: "item1", quantity: 1, unitPrice: money }], cost,
      unresolved: ["Frete"], expiresAt: "2026-10-18T12:00:00-03:00" };
    const result = toPublicProposal(proposal);
    expect(result).not.toHaveProperty("subjectRef");
    expect(result).not.toHaveProperty("addressRef");
    expect(result.id).toBe("p1");
    expect(() => toPublicProposal({ ...proposal, version: 0 })).toThrow();
    expect(PublicAgentTurnSchema.safeParse({ reply: "Aprovado", state: "approved", recommendations: [] }).success).toBe(false);
    expect(PublicAgentTurnSchema.safeParse({ reply: "Aprovado", state: "approved", recommendations: [], proposal: result }).success).toBe(false);
    expect(PublicAgentTurnSchema.safeParse({ reply: "Revise", state: "awaiting_approval", recommendations: [], proposal: result }).success).toBe(false);
    expect(PublicProposalSchema.safeParse({ ...result, state: "approved" }).success).toBe(false);
    expect(PublicProposalSchema.safeParse({ ...result, items: [{ ref: "item1", quantity: 2, unitPrice: money }] }).success).toBe(false);
    const approved = { ...result, state: "approved", unresolved: [], cost: { items: money, delivery: { ...money, cents: 0 }, fees: { ...money, cents: 0 }, total: money, status: "confirmed" } };
    expect(PublicAgentTurnSchema.safeParse({ reply: "Aprovado", state: "approved", recommendations: [], proposal: approved }).success).toBe(true);
  });
});
