import { ProposalStateSchema, type ProposalState } from "./proposal";

export const proposalTransitions: Readonly<Record<ProposalState, readonly ProposalState[]>> = {
  draft: ["awaiting_approval", "cancelled", "expired"],
  awaiting_approval: ["approved", "invalidated", "cancelled", "expired"],
  approved: ["invalidated", "cancelled", "expired"],
  invalidated: ["draft", "cancelled", "expired"],
  cancelled: [],
  expired: [],
};

// Apenas o grafo de estados: uma aresta permitida não concede aprovação.
// O domínio deve verificar sujeito, versão, validade e pré-condições antes de usá-la.
export function canTransitionProposal(from: ProposalState, to: ProposalState): boolean {
  const source = ProposalStateSchema.safeParse(from);
  const target = ProposalStateSchema.safeParse(to);
  return source.success && target.success && proposalTransitions[source.data].includes(target.data);
}
