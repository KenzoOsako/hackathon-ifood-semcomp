import { describe, expect, it } from "vitest";
import { canTransitionProposal } from "./proposal-state";
import { ProposalStateSchema } from "./proposal";

describe("transições de proposta", () => {
  it("exige revisão antes da aprovação e invalidação antes de editar uma aprovada", () => {
    expect(canTransitionProposal("draft", "approved")).toBe(false);
    expect(canTransitionProposal("draft", "awaiting_approval")).toBe(true);
    expect(canTransitionProposal("awaiting_approval", "approved")).toBe(true);
    expect(canTransitionProposal("approved", "draft")).toBe(false);
    expect(canTransitionProposal("approved", "invalidated")).toBe(true);
    expect(canTransitionProposal("invalidated", "draft")).toBe(true);
    expect(canTransitionProposal("invalidated", "approved")).toBe(false);
  });
  it("cancelamento e expiração são terminais; não se reaprovam snapshots", () => {
    for (const target of ProposalStateSchema.options) {
      expect(canTransitionProposal("cancelled", target)).toBe(false);
      expect(canTransitionProposal("expired", target)).toBe(false);
    }
    expect(canTransitionProposal("approved", "approved")).toBe(false);
  });
});
