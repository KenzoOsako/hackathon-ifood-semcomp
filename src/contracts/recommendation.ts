import { z } from "zod";
import { CartProposalSchema, ConstraintsSchema, CostSchema } from "./proposal";

const Ref = z.string().trim().min(1);
export const OriginSchema = z.strictObject({
  mode: z.enum(["real", "mock"]), source: Ref,
  observedAt: z.iso.datetime({ offset: true }),
});
export type Origin = z.infer<typeof OriginSchema>;

// Interno ao servidor: propósitos são conceitos locais, não scopes oficiais.
export const AuthorizedContextSchema = z.strictObject({
  subjectRef: Ref,
  authorizedPurposes: z.array(z.enum(["recommendations", "addresses", "memory"])).min(1),
  origins: z.array(OriginSchema).min(1),
  preferences: z.array(z.strictObject({ value: Ref, basis: z.enum(["declared", "observed"]) })),
  addresses: z.array(z.strictObject({ ref: Ref, label: Ref })),
}).superRefine((context, ctx) => {
  if (context.addresses.length > 0 && !context.authorizedPurposes.includes("addresses")) {
    ctx.addIssue({ code: "custom", path: ["addresses"], message: "Endereços exigem propósito autorizado correspondente." });
  }
  if (context.preferences.length > 0 && !context.authorizedPurposes.includes("recommendations")) {
    ctx.addIssue({ code: "custom", path: ["preferences"], message: "Preferências exigem autorização para recomendação." });
  }
});
export type AuthorizedContext = z.infer<typeof AuthorizedContextSchema>;

// O LLM interpreta; esta saída não contém autorização nem instrução de tool.
export const InterpretedIntentSchema = z.strictObject({
  action: z.enum(["search", "refine", "select", "edit", "cancel", "request_approval", "clarify"]),
  query: Ref.optional(),
  selectedRef: Ref.optional(),
  constraints: ConstraintsSchema,
  uncertainties: z.array(Ref),
}).superRefine((intent, ctx) => {
  if (intent.action === "select" && !intent.selectedRef) {
    ctx.addIssue({ code: "custom", path: ["selectedRef"], message: "Seleção exige referência explícita." });
  }
});
export type InterpretedIntent = z.infer<typeof InterpretedIntentSchema>;

export const RecommendationSchema = z.strictObject({
  ref: Ref, merchantRef: Ref, title: Ref,
  cost: CostSchema,
  origins: z.array(OriginSchema).min(1),
  evidence: z.array(z.strictObject({ ref: Ref, originIndex: z.number().int().nonnegative(), field: Ref })).min(1),
  reasons: z.array(z.strictObject({ text: Ref, evidenceRef: Ref })).min(1),
  uncertainties: z.array(Ref),
}).superRefine((recommendation, ctx) => {
  const refs = new Set(recommendation.evidence.map((entry) => entry.ref));
  if (refs.size !== recommendation.evidence.length) {
    ctx.addIssue({ code: "custom", path: ["evidence"], message: "Referências de evidência devem ser únicas." });
  }
  recommendation.evidence.forEach((entry, index) => {
    if (entry.originIndex >= recommendation.origins.length) {
      ctx.addIssue({ code: "custom", path: ["evidence", index, "originIndex"], message: "Origem inexistente." });
    }
  });
  recommendation.reasons.forEach((reason, index) => {
    if (!refs.has(reason.evidenceRef)) {
      ctx.addIssue({ code: "custom", path: ["reasons", index, "evidenceRef"], message: "Motivo sem evidência referenciada." });
    }
  });
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

// Allowlist deliberada: o snapshot interno não é serializado por spread.
export const PublicProposalSchema = z.strictObject({
  id: Ref,
  version: CartProposalSchema.shape.version,
  state: CartProposalSchema.shape.state,
  items: CartProposalSchema.shape.items,
  cost: CostSchema,
  unresolved: z.array(Ref),
  expiresAt: CartProposalSchema.shape.expiresAt,
}).superRefine((proposal, ctx) => {
  const subtotal = proposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice.cents, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal !== proposal.cost.items.cents ||
    new Set(proposal.items.map((item) => item.ref)).size !== proposal.items.length) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "Itens e subtotal inconsistentes." });
  }
  if (proposal.state === "approved" && (proposal.unresolved.length > 0 || proposal.cost.status === "unknown")) {
    ctx.addIssue({ code: "custom", path: ["state"], message: "Proposta pública aprovada não pode ter pendências." });
  }
});
export type PublicProposal = z.infer<typeof PublicProposalSchema>;
export function toPublicProposal(input: unknown): PublicProposal {
  const proposal = CartProposalSchema.parse(input);
  return PublicProposalSchema.parse({
    id: proposal.id, version: proposal.version, state: proposal.state,
    items: proposal.items, cost: proposal.cost, unresolved: proposal.unresolved,
    expiresAt: proposal.expiresAt,
  });
}

export const PublicAgentTurnSchema = z.strictObject({
  reply: Ref,
  state: z.enum(["discovering", "choosing", "reviewing", "awaiting_approval", "approved", "handoff", "failure"]),
  recommendations: z.array(RecommendationSchema).max(3),
  proposal: PublicProposalSchema.optional(),
}).superRefine((turn, ctx) => {
  if ((turn.state === "approved" || turn.state === "awaiting_approval") && turn.proposal?.state !== turn.state) {
    ctx.addIssue({ code: "custom", path: ["proposal"], message: "Estado da conversa exige snapshot no mesmo estado de aprovação." });
  }
});
export type PublicAgentTurn = z.infer<typeof PublicAgentTurnSchema>;
