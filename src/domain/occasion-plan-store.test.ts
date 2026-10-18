import { describe, expect, it } from "vitest";
import { CompositePlanSchema, PublicCompositePlanSchema, toPublicCompositePlan, type PlanBlock } from "@/contracts";
import { OccasionPlanStore } from "./occasion-plan-store";
import { ProposalError } from "@/agent/proposals";

const start = Date.parse("2026-10-17T23:00:00-03:00");
const money = (cents: number) => ({ currency: "BRL" as const, cents });
const block = (id: string, overrides: Partial<PlanBlock["proposal"]> = {}): PlanBlock => ({
  need: { id, vertical: "RESTAURANT", categoria: "pizza", restricoes: [] },
  origin: { mode: "mock", source: "fixture", observedAt: new Date(start).toISOString() },
  proposal: { id: `p-${id}`, version: 1, subjectRef: "s1", merchantRef: `m-${id}`, addressRef: "a1", state: "draft",
    items: [{ ref: `i-${id}`, quantity: 1, unitPrice: money(1000) }],
    cost: { items: money(1000), delivery: money(500), fees: money(0), total: money(1500), status: "confirmed" },
    unresolved: [], expiresAt: new Date(start + 60_000).toISOString(), ...overrides },
});
const draft = () => ({ occasion: { tipo: "aniversário", pessoas: 2 }, blocks: [block("n1"), block("n2")], unresolved: [] as string[] });
const request = (planId: string, version = 1, interactionId = "click1") => ({ planId, version, interactionId, channel: "button" });
const expectCode = (action: () => unknown, code: string) => {
  try { action(); throw new Error("Esperava falha"); }
  catch (error) { expect(error).toBeInstanceOf(ProposalError); expect((error as ProposalError).code).toBe(code); }
};

describe("plano composto local", () => {
  it("revisa e aprova todos os blocos em uma única versão", () => {
    const store = new OccasionPlanStore(2, () => start);
    const p = store.create("s1", draft());
    expectCode(() => store.approve("s1", request(p.id)), "STALE_PROPOSAL");
    store.review(p.id, "s1", 1);
    const approved = store.approve("s1", request(p.id));
    expect(approved.blocks.map((b) => b.proposal.state)).toEqual(["approved", "approved"]);
    expect(toPublicCompositePlan(approved).cost.total?.cents).toBe(3000);
    expectCode(() => store.approve("s1", request(p.id)), "STALE_PROPOSAL");
    expectCode(() => store.approve("s1", request(p.id, 1, "click2")), "STALE_PROPOSAL");
  });
  it.each(["unknown", "unresolved", "address", "budget", "restrictions"])("nega bloco com %s sem aprovação parcial", (kind) => {
    const store = new OccasionPlanStore(1, () => start); const input = draft();
    const second = input.blocks[1];
    if (kind === "unknown") second.proposal.cost = { items: money(1000), status: "unknown" };
    if (kind === "unresolved") second.proposal.unresolved = ["estoque"];
    if (kind === "address") delete second.proposal.addressRef;
    if (kind === "budget") second.need.orcamento = { max: 14.99, tipo: "teto" };
    if (kind === "restrictions") second.need.restricoes = ["amendoim"];
    const p = store.create("s1", input); store.review(p.id, "s1", 1);
    expect(() => store.approve("s1", request(p.id))).toThrow();
    const current = store.get(p.id, "s1", 1);
    expect(current.state).toBe("awaiting_approval");
    expect(current.blocks.every((b) => b.proposal.state === "awaiting_approval")).toBe(true);
    input.blocks[1] = block("n2");
    store.revise(p.id, "s1", 1, input); store.review(p.id, "s1", 2);
    expect(store.approve("s1", request(p.id, 2)).state).toBe("approved"); // falha não consome interação
  });
  it("edição invalida aprovação e replay de interação antiga", () => {
    const store = new OccasionPlanStore(1, () => start); const p = store.create("s1", draft());
    store.review(p.id, "s1", 1); store.approve("s1", request(p.id));
    expect(store.revise(p.id, "s1", 1, draft())).toMatchObject({ version: 2, state: "draft" });
    expectCode(() => store.approve("s1", request(p.id)), "STALE_PROPOSAL");
    store.review(p.id, "s1", 2);
    expectCode(() => store.approve("s1", request(p.id, 2)), "STALE_PROPOSAL");
    expect(store.approve("s1", request(p.id, 2, "click2")).state).toBe("approved");
  });
  it("usa validade do bloco que vence primeiro e nega a fronteira exata", () => {
    let now = start; const store = new OccasionPlanStore(1, () => now); const input = draft();
    input.blocks[1].proposal.expiresAt = new Date(start + 1000).toISOString();
    const p = store.create("s1", input); expect(Date.parse(p.expiresAt)).toBe(start + 1000);
    store.review(p.id, "s1", 1); now += 1000;
    expectCode(() => store.approve("s1", request(p.id)), "EXPIRED");
    expectCode(() => store.revise(p.id, "s1", 1, draft()), "EXPIRED");
  });
  it("nega outros sujeitos em todas as operações sem revelar existência", () => {
    const store = new OccasionPlanStore(1, () => start); const p = store.create("s1", draft());
    for (const action of [() => store.get(p.id, "s2", 1), () => store.review(p.id, "s2", 1),
      () => store.revise(p.id, "s2", 1, draft()), () => store.cancel(p.id, "s2", 1), () => store.approve("s2", request(p.id))]) expectCode(action, "AUTH_REQUIRED");
    expectCode(() => store.create("", draft()), "AUTH_REQUIRED");
  });
  it.each(["subject", "merchant", "address", "need", "proposal", "approved", "empty", "overflow"])("rejeita composição inválida: %s", (kind) => {
    const store = new OccasionPlanStore(1, () => start); const input = draft(); const second = input.blocks[1];
    if (kind === "subject") second.proposal.subjectRef = "s2";
    if (kind === "merchant") second.proposal.merchantRef = input.blocks[0].proposal.merchantRef;
    if (kind === "address") second.proposal.addressRef = "a2";
    if (kind === "need") second.need.id = input.blocks[0].need.id;
    if (kind === "proposal") second.proposal.id = input.blocks[0].proposal.id;
    if (kind === "approved") second.proposal.state = "approved";
    if (kind === "empty") input.blocks = [];
    if (kind === "overflow") {
      for (const b of input.blocks) {
        b.proposal.items[0].unitPrice = money(Number.MAX_SAFE_INTEGER);
        b.proposal.cost = { items: money(Number.MAX_SAFE_INTEGER), delivery: money(0), fees: money(0), total: money(Number.MAX_SAFE_INTEGER), status: "confirmed" };
      }
    }
    expect(() => store.create("s1", input)).toThrow();
  });
  it("projeta allowlist pública, mantém origem por bloco e valida soma/estado no parse direto", () => {
    const store = new OccasionPlanStore(1, () => start); const input = draft(); input.blocks[1].origin.mode = "real";
    const p = store.create("s1", input); const pub = toPublicCompositePlan(p);
    expect(pub).not.toHaveProperty("subjectRef");
    expect(pub.blocks[0].proposal).not.toHaveProperty("addressRef");
    expect(pub.blocks[0].proposal).not.toHaveProperty("subjectRef");
    expect(pub.blocks.map((b) => b.origin.mode)).toEqual(["mock", "real"]);
    expect(PublicCompositePlanSchema.safeParse({ ...pub, subjectRef: "s1" }).success).toBe(false);
    expect(PublicCompositePlanSchema.safeParse({ ...pub, state: "approved" }).success).toBe(false);
    expect(PublicCompositePlanSchema.safeParse({ ...pub, cost: { ...pub.cost, total: money(1) } }).success).toBe(false);
    expect(CompositePlanSchema.safeParse({ ...p, expiresAt: new Date(start + 120_000).toISOString() }).success).toBe(false);
  });
  it("preserva ausências, estimativas e limites rígidos/flexíveis", () => {
    const store = new OccasionPlanStore(2, () => start); const input = draft();
    input.blocks[0].proposal.cost = { items: money(1000), status: "unknown" };
    const unknown = toPublicCompositePlan(store.create("s1", input));
    expect(unknown.cost.status).toBe("unknown"); expect(unknown.cost.total).toBeUndefined();
    const known = draft(); known.blocks[0].need.orcamento = { max: 15, tipo: "teto" };
    known.blocks[1].need.orcamento = { max: 1, tipo: "flexivel" }; known.blocks[0].proposal.cost.status = "estimated";
    const p = store.create("s1", known); store.review(p.id, "s1", 1);
    expect(toPublicCompositePlan(store.approve("s1", request(p.id))).cost.status).toBe("estimated");
  });
  it("cópias defensivas, cancelamento terminal, capacidade e relógio inválido", () => {
    const store = new OccasionPlanStore(1, () => start); const input = draft(); const p = store.create("s1", input);
    input.blocks[0].proposal.items[0].quantity = 99; p.blocks[0].proposal.items[0].quantity = 99;
    expect(store.get(p.id, "s1", 1).blocks[0].proposal.items[0].quantity).toBe(1);
    expectCode(() => store.create("s1", draft()), "UNAVAILABLE");
    store.cancel(p.id, "s1", 1); expectCode(() => store.revise(p.id, "s1", 1, draft()), "STALE_PROPOSAL");
    expect(store.create("s1", draft()).id).not.toBe(p.id);
    expectCode(() => new OccasionPlanStore(0), "INVALID_DATA");
    expectCode(() => new OccasionPlanStore(1, () => NaN).create("s1", draft()), "INVALID_DATA");
  });
  it("rejeita identidade e flag de autorização no pedido de aprovação", () => {
    const store = new OccasionPlanStore(1, () => start); const p = store.create("s1", draft()); store.review(p.id, "s1", 1);
    expect(() => store.approve("s1", { ...request(p.id), subjectRef: "s1" })).toThrow();
    expect(() => store.approve("s1", { ...request(p.id), explicit: true })).toThrow();
  });
});
