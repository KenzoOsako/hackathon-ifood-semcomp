import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CompositePlanSchema, PlanApprovalRequestSchema, canTransitionProposal, type CompositePlan, type ProposalState } from "@/contracts";
import { ProposalError } from "@/agent/proposals";

const DraftSchema = z.strictObject({
  occasion: CompositePlanSchema.shape.occasion,
  blocks: CompositePlanSchema.shape.blocks,
  unresolved: CompositePlanSchema.shape.unresolved,
});
type Draft = z.infer<typeof DraftSchema>;

// Snapshots próprios do plano; não aprova/muta propostas em outro store.
// Todas as verificações precedem uma única troca síncrona do snapshot.
export class OccasionPlanStore {
  private readonly records = new Map<string, { plan: CompositePlan; interactions: Set<string> }>();
  constructor(private readonly capacity: number, private readonly now: () => number = Date.now) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new ProposalError("INVALID_DATA");
  }
  private time(): number {
    const now = this.now();
    if (!Number.isFinite(now)) throw new ProposalError("INVALID_DATA");
    return now;
  }
  private subject(subjectRef: string) {
    if (typeof subjectRef !== "string" || !subjectRef.trim()) throw new ProposalError("AUTH_REQUIRED");
  }
  private snapshot(subjectRef: string, id: string, version: number, input: Draft): CompositePlan {
    const draft = DraftSchema.parse(input);
    if (draft.blocks.some((b) => !["draft", "awaiting_approval"].includes(b.proposal.state))) throw new ProposalError("INVALID_DATA");
    const expiresAt = new Date(Math.min(...draft.blocks.map((b) => Date.parse(b.proposal.expiresAt)))).toISOString();
    const plan = CompositePlanSchema.parse({
      ...draft, id, subjectRef, version, state: "draft", expiresAt,
      blocks: draft.blocks.map((b) => ({ ...b, proposal: { ...b.proposal, state: "draft" } })),
    });
    if (Date.parse(expiresAt) <= this.time()) throw new ProposalError("EXPIRED");
    return plan;
  }
  private record(id: string, subjectRef: string, version: number) {
    this.subject(subjectRef);
    const record = this.records.get(id);
    if (!record || record.plan.subjectRef !== subjectRef) throw new ProposalError("AUTH_REQUIRED");
    if (!Number.isSafeInteger(version) || record.plan.version !== version) throw new ProposalError("STALE_PROPOSAL");
    if (Date.parse(record.plan.expiresAt) <= this.time()) throw new ProposalError("EXPIRED");
    return record;
  }
  private transition(plan: CompositePlan, state: ProposalState): CompositePlan {
    if (!canTransitionProposal(plan.state, state)) throw new ProposalError("STALE_PROPOSAL");
    return CompositePlanSchema.parse({ ...plan, state, blocks: plan.blocks.map((b) => ({ ...b, proposal: { ...b.proposal, state } })) });
  }
  create(subjectRef: string, input: Draft): CompositePlan {
    this.subject(subjectRef);
    const next = this.snapshot(subjectRef, randomUUID(), 1, input);
    if (this.records.size >= this.capacity) {
      const now = this.time();
      for (const [id, record] of this.records) if (record.plan.state === "cancelled" || Date.parse(record.plan.expiresAt) <= now) this.records.delete(id);
    }
    if (this.records.size >= this.capacity) throw new ProposalError("UNAVAILABLE");
    this.records.set(next.id, { plan: next, interactions: new Set() });
    return structuredClone(next);
  }
  get(id: string, subjectRef: string, version: number): CompositePlan {
    return structuredClone(this.record(id, subjectRef, version).plan);
  }
  review(id: string, subjectRef: string, version: number): CompositePlan {
    const record = this.record(id, subjectRef, version);
    record.plan = this.transition(record.plan, "awaiting_approval");
    return structuredClone(record.plan);
  }
  revise(id: string, subjectRef: string, version: number, input: Draft): CompositePlan {
    const record = this.record(id, subjectRef, version);
    if (["cancelled", "expired"].includes(record.plan.state)) throw new ProposalError("STALE_PROPOSAL");
    const next = this.snapshot(subjectRef, id, version + 1, input);
    record.plan = next;
    return structuredClone(next);
  }
  cancel(id: string, subjectRef: string, version: number): CompositePlan {
    const record = this.record(id, subjectRef, version);
    record.plan = this.transition(record.plan, "cancelled");
    return structuredClone(record.plan);
  }
  approve(subjectRef: string, input: unknown): CompositePlan {
    const request = PlanApprovalRequestSchema.parse(input);
    const record = this.record(request.planId, subjectRef, request.version);
    if (record.interactions.has(request.interactionId)) throw new ProposalError("STALE_PROPOSAL");
    const approved = this.transition(record.plan, "approved");
    record.interactions.add(request.interactionId);
    record.plan = approved;
    return structuredClone(approved);
  }
}
