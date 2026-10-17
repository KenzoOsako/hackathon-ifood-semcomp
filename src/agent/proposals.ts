import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApprovalRequestSchema, CartProposalSchema, canTransitionProposal, type CartProposal, type ProposalState } from "@/contracts";

export class ProposalError extends Error {
  constructor(public readonly code: "AUTH_REQUIRED" | "INVALID_DATA" | "STALE_PROPOSAL" | "EXPIRED" | "UNAVAILABLE") {
    super(code);
    this.name = "ProposalError";
  }
}

type Draft = Pick<CartProposal, "merchantRef" | "addressRef" | "items" | "cost" | "unresolved" | "expiresAt">;
const DraftSchema = z.strictObject({
  merchantRef: CartProposalSchema.shape.merchantRef,
  addressRef: CartProposalSchema.shape.addressRef,
  items: CartProposalSchema.shape.items,
  cost: CartProposalSchema.shape.cost,
  unresolved: CartProposalSchema.shape.unresolved,
  expiresAt: CartProposalSchema.shape.expiresAt,
});

// Uso exclusivamente no servidor. subjectRef vem de sessão validada, nunca do body.
// Operações síncronas mantêm a aprovação atômica nesta instância, sem I/O remoto.
// Múltiplas instâncias exigirão armazenamento transacional antes de escrita real.
export class ProposalStore {
  private readonly records = new Map<string, { proposal: CartProposal; interactions: Set<string> }>();

  constructor(private readonly capacity: number, private readonly now: () => number = Date.now) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new ProposalError("INVALID_DATA");
  }

  private time(): number {
    const time = this.now();
    if (!Number.isFinite(time)) throw new ProposalError("INVALID_DATA");
    return time;
  }

  private subject(subjectRef: string): void {
    if (typeof subjectRef !== "string" || !subjectRef.trim()) throw new ProposalError("AUTH_REQUIRED");
  }

  private record(id: string, subjectRef: string, version: number) {
    this.subject(subjectRef);
    const record = this.records.get(id);
    // Não revelar existência de proposta pertencente a outra sessão.
    if (!record || record.proposal.subjectRef !== subjectRef) throw new ProposalError("AUTH_REQUIRED");
    if (!Number.isSafeInteger(version) || record.proposal.version !== version) throw new ProposalError("STALE_PROPOSAL");
    if (Date.parse(record.proposal.expiresAt) <= this.time()) {
      if (canTransitionProposal(record.proposal.state, "expired")) record.proposal.state = "expired";
      throw new ProposalError("EXPIRED");
    }
    return record;
  }

  private transition(proposal: CartProposal, state: ProposalState): CartProposal {
    if (!canTransitionProposal(proposal.state, state)) throw new ProposalError("STALE_PROPOSAL");
    return CartProposalSchema.parse({ ...proposal, state });
  }

  create(subjectRef: string, input: Draft): CartProposal {
    this.subject(subjectRef);
    const time = this.time();
    // IDs são gerados pelo servidor; descartar registro terminal não permite
    // ressuscitar aprovação antiga. Varredura limitada pela capacidade configurada.
    if (this.records.size >= this.capacity) {
      for (const [id, record] of this.records) {
        if (record.proposal.state === "cancelled" || Date.parse(record.proposal.expiresAt) <= time) this.records.delete(id);
      }
    }
    if (this.records.size >= this.capacity) throw new ProposalError("UNAVAILABLE");
    const proposal = CartProposalSchema.parse({ ...DraftSchema.parse(input), id: randomUUID(), subjectRef, version: 1, state: "draft" });
    if (Date.parse(proposal.expiresAt) <= this.time()) throw new ProposalError("EXPIRED");
    this.records.set(proposal.id, { proposal, interactions: new Set() });
    return structuredClone(proposal);
  }

  get(id: string, subjectRef: string, version: number): CartProposal {
    return structuredClone(this.record(id, subjectRef, version).proposal);
  }

  review(id: string, subjectRef: string, version: number): CartProposal {
    const record = this.record(id, subjectRef, version);
    record.proposal = this.transition(record.proposal, "awaiting_approval");
    return structuredClone(record.proposal);
  }

  revise(id: string, subjectRef: string, version: number, input: Draft): CartProposal {
    const record = this.record(id, subjectRef, version);
    if (["cancelled", "expired"].includes(record.proposal.state)) throw new ProposalError("STALE_PROPOSAL");
    // Toda edição gera nova versão, inclusive alterações aparentemente menores.
    const next = CartProposalSchema.parse({ ...DraftSchema.parse(input), id, subjectRef, version: version + 1, state: "draft" });
    if (Date.parse(next.expiresAt) <= this.time()) throw new ProposalError("EXPIRED");
    record.proposal = next;
    return structuredClone(next);
  }

  cancel(id: string, subjectRef: string, version: number): CartProposal {
    const record = this.record(id, subjectRef, version);
    record.proposal = this.transition(record.proposal, "cancelled");
    return structuredClone(record.proposal);
  }

  approve(subjectRef: string, input: unknown): CartProposal {
    const request = ApprovalRequestSchema.parse(input);
    const record = this.record(request.proposalId, subjectRef, request.version);
    if (record.interactions.has(request.interactionId)) throw new ProposalError("STALE_PROPOSAL");
    const approved = this.transition(record.proposal, "approved");
    record.interactions.add(request.interactionId);
    record.proposal = approved;
    return structuredClone(approved);
  }
}
