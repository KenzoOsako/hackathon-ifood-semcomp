import { describe, expect, it } from "vitest";
import { ProposalError, ProposalStore } from "./proposals";

const money = (cents: number) => ({ currency: "BRL" as const, cents });
const draft = () => ({ merchantRef: "m1", addressRef: "a1", items: [{ ref: "i1", quantity: 1, unitPrice: money(1000) }],
  cost: { items: money(1000), delivery: money(0), fees: money(0), total: money(1000), status: "confirmed" as const },
  unresolved: [] as string[], expiresAt: "2026-10-18T12:00:00-03:00" });
const now = () => Date.parse("2026-10-17T20:00:00-03:00");
const request = (id: string, version = 1, interactionId = "click1") => ({ proposalId: id, version, interactionId, channel: "button" });
const expectCode = (action: () => unknown, code: string) => {
  try { action(); throw new Error("A ação deveria falhar"); }
  catch (error) { expect(error).toBeInstanceOf(ProposalError); expect((error as ProposalError).code).toBe(code); }
};

describe("propostas locais no servidor", () => {
  it("cria/revisa/aprova sem executar qualquer operação remota", () => {
    const store = new ProposalStore(10, now);
    const p = store.create("s1", draft());
    expect(p.state).toBe("draft");
    expectCode(() => store.approve("s1", request(p.id)), "STALE_PROPOSAL");
    expect(store.review(p.id, "s1", 1).state).toBe("awaiting_approval");
    expect(store.approve("s1", request(p.id)).state).toBe("approved");
    expectCode(() => store.approve("s1", request(p.id)), "STALE_PROPOSAL");
    expectCode(() => store.approve("s1", request(p.id, 1, "click2")), "STALE_PROPOSAL");
  });
  it("nega sessão alheia em todas as operações", () => {
    const store = new ProposalStore(10, now);
    const p = store.create("s1", draft());
    for (const action of [() => store.get(p.id, "s2", 1), () => store.review(p.id, "s2", 1),
      () => store.revise(p.id, "s2", 1, draft()), () => store.cancel(p.id, "s2", 1), () => store.approve("s2", request(p.id))]) {
      expectCode(action, "AUTH_REQUIRED");
    }
    expectCode(() => store.create("", draft()), "AUTH_REQUIRED");
  });
  it("edição invalida aprovação, incrementa versão e impede replay de interação antiga", () => {
    const store = new ProposalStore(10, now);
    const p = store.create("s1", draft());
    store.review(p.id, "s1", 1); store.approve("s1", request(p.id));
    const edited = store.revise(p.id, "s1", 1, { ...draft(), addressRef: "a2" });
    expect(edited).toMatchObject({ version: 2, state: "draft", addressRef: "a2" });
    expectCode(() => store.approve("s1", request(p.id)), "STALE_PROPOSAL");
    store.review(p.id, "s1", 2);
    expectCode(() => store.approve("s1", request(p.id, 2)), "STALE_PROPOSAL");
    expect(store.approve("s1", request(p.id, 2, "click2")).state).toBe("approved");
  });
  it("expira na fronteira exata e não ressuscita por edição", () => {
    let clock = now(); const store = new ProposalStore(10, () => clock);
    const p = store.create("s1", draft()); store.review(p.id, "s1", 1);
    clock = Date.parse(p.expiresAt);
    expectCode(() => store.approve("s1", request(p.id)), "EXPIRED");
    expectCode(() => store.revise(p.id, "s1", 1, draft()), "EXPIRED");
    expectCode(() => store.create("s1", draft()), "EXPIRED");
  });
  it("cancelamento é terminal e dados retornados não alteram estado interno", () => {
    const store = new ProposalStore(10, now); const p = store.create("s1", draft());
    p.state = "approved"; p.items[0].quantity = 99;
    expect(store.get(p.id, "s1", 1)).toMatchObject({ state: "draft", items: [{ quantity: 1 }] });
    store.cancel(p.id, "s1", 1);
    expectCode(() => store.revise(p.id, "s1", 1, draft()), "STALE_PROPOSAL");
    expectCode(() => store.review(p.id, "s1", 1), "STALE_PROPOSAL");
  });
  it("pendências e payload com identidade injetada não aprovam", () => {
    const store = new ProposalStore(10, now); const p = store.create("s1", { ...draft(), unresolved: ["estoque"] });
    store.review(p.id, "s1", 1);
    expect(() => store.approve("s1", request(p.id))).toThrow();
    expect(() => store.approve("s1", { ...request(p.id), subjectRef: "s2" })).toThrow();
    expect(store.get(p.id, "s1", 1).state).toBe("awaiting_approval");
  });
  it("limita armazenamento e rejeita relógio inválido", () => {
    const store = new ProposalStore(1, now); store.create("s1", draft());
    expectCode(() => store.create("s1", draft()), "UNAVAILABLE");
    expectCode(() => new ProposalStore(0), "INVALID_DATA");
    expectCode(() => new ProposalStore(1, () => NaN).create("s1", draft()), "INVALID_DATA");
  });
  it("edição pode remover endereço e aprovação falha até nova seleção válida", () => {
    const store = new ProposalStore(10, now); const p = store.create("s1", draft());
    const input = draft();
    const withoutAddress = { merchantRef: input.merchantRef, items: input.items, cost: input.cost, unresolved: [], expiresAt: input.expiresAt };
    expect(store.revise(p.id, "s1", 1, withoutAddress).addressRef).toBeUndefined();
    store.review(p.id, "s1", 2);
    expect(() => store.approve("s1", request(p.id, 2))).toThrow();
  });
  it("recupera capacidade após expiração sem aceitar aprovação antiga", () => {
    let clock = now(); const store = new ProposalStore(1, () => clock);
    const old = store.create("s1", draft());
    clock = Date.parse(old.expiresAt);
    const next = store.create("s1", { ...draft(), expiresAt: "2026-10-18T13:00:00-03:00" });
    expect(next.id).not.toBe(old.id);
    expectCode(() => store.approve("s1", request(old.id)), "AUTH_REQUIRED");
  });
  it("recupera capacidade após cancelamento", () => {
    const store = new ProposalStore(1, now); const old = store.create("s1", draft());
    store.cancel(old.id, "s1", 1);
    expect(store.create("s1", draft()).id).not.toBe(old.id);
  });
});
