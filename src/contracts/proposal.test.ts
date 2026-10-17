import { describe, expect, it } from "vitest";
import { ApprovalRequestSchema, CartProposalSchema, ConstraintsSchema, CostSchema, MoneySchema, PortFailureSchema } from "./proposal";

const money = (cents: number) => ({ currency: "BRL" as const, cents });
const cost = { items: money(2000), delivery: money(500), fees: money(0), total: money(2500), status: "confirmed" };
const proposal = {
  id: "p1", version: 1, subjectRef: "subject1", merchantRef: "merchant1",
  addressRef: "address1", state: "awaiting_approval", items: [{ ref: "item1", quantity: 2, unitPrice: money(1000) }],
  cost, unresolved: [], expiresAt: "2026-10-18T12:00:00-03:00",
};

describe("contratos de proposta local", () => {
  it.each([-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])("rejeita centavos inválidos: %s", (cents) => {
    expect(MoneySchema.safeParse(money(cents)).success).toBe(false);
  });
  it("aceita zero e rejeita moeda diferente", () => {
    expect(MoneySchema.parse(money(0)).cents).toBe(0);
    expect(MoneySchema.safeParse({ currency: "USD", cents: 100 }).success).toBe(false);
  });
  it("preserva componentes desconhecidos sem inventar zero", () => {
    const unknown = CostSchema.parse({ items: money(2000), status: "unknown" });
    expect(unknown.delivery).toBeUndefined();
    expect(unknown.total).toBeUndefined();
  });
  it("aceita soma completa e rejeita total inconsistente ou sem encargos", () => {
    expect(CostSchema.safeParse(cost).success).toBe(true);
    expect(CostSchema.safeParse({ ...cost, total: money(2000) }).success).toBe(false);
    expect(CostSchema.safeParse({ ...cost, delivery: undefined }).success).toBe(false);
    expect(CostSchema.safeParse({ ...cost, total: undefined }).success).toBe(false);
    expect(CostSchema.safeParse({ ...cost, status: "unknown" }).success).toBe(false);
  });
  it("valida restrição rígida e política explícita de composição ausente", () => {
    const constraints = { budget: { limit: money(3000), kind: "hard" }, allergies: ["amendoim"], missingCompositionPolicy: "exclude-from-safe-claims" };
    expect(ConstraintsSchema.safeParse(constraints).success).toBe(true);
    expect(ConstraintsSchema.safeParse({ ...constraints, missingCompositionPolicy: "assume-safe" }).success).toBe(false);
  });
  it("aceita snapshot versionado e rejeita subtotal, itens e validade inválidos", () => {
    expect(CartProposalSchema.safeParse(proposal).success).toBe(true);
    for (const change of [{ version: 0 }, { id: " " }, { expiresAt: "amanhã" }, { items: [] },
      { items: [{ ref: "item1", quantity: 1, unitPrice: money(1000) }] }]) {
      expect(CartProposalSchema.safeParse({ ...proposal, ...change }).success).toBe(false);
    }
  });
  it("não aceita aprovação com pendências, endereço ausente ou total desconhecido", () => {
    expect(CartProposalSchema.safeParse({ ...proposal, state: "approved" }).success).toBe(true);
    for (const change of [{ unresolved: ["confirmar disponibilidade"] }, { addressRef: undefined },
      { cost: { items: money(2000), status: "unknown" } }]) {
      expect(CartProposalSchema.safeParse({ ...proposal, state: "approved", ...change }).success).toBe(false);
    }
  });
  it("rejeita itens duplicados e multiplicação que excede inteiro seguro", () => {
    const item = { ref: "item1", quantity: 1, unitPrice: money(1000) };
    expect(CartProposalSchema.safeParse({ ...proposal, items: [item, item] }).success).toBe(false);
    expect(CartProposalSchema.safeParse({ ...proposal, items: [{ ...item, quantity: Number.MAX_SAFE_INTEGER }] }).success).toBe(false);
  });
  it("não aceita identidade ou flag de autorização enviadas no pedido de aprovação", () => {
    const request = { proposalId: "p1", version: 1, interactionId: "i1", channel: "button" };
    expect(ApprovalRequestSchema.safeParse(request).success).toBe(true);
    expect(ApprovalRequestSchema.safeParse({ ...request, subjectRef: "outra-pessoa" }).success).toBe(false);
    expect(ApprovalRequestSchema.safeParse({ ...request, explicit: true }).success).toBe(false);
    expect(ApprovalRequestSchema.safeParse({ ...request, version: 0 }).success).toBe(false);
  });
  it("falha ambígua não autoriza repetição automática", () => {
    const failure = { code: "AMBIGUOUS_RESULT", retryable: false, correlationId: "c1" };
    expect(PortFailureSchema.safeParse(failure).success).toBe(true);
    expect(PortFailureSchema.safeParse({ ...failure, retryable: true }).success).toBe(false);
  });
});
