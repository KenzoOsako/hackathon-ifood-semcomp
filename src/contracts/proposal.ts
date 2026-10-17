import { z } from "zod";

const RefSchema = z.string().trim().min(1);
export const MoneySchema = z.strictObject({
  currency: z.literal("BRL"),
  cents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type Money = z.infer<typeof MoneySchema>;

// Ausência de frete/taxas não significa gratuidade. Total só existe com ambos.
export const CostSchema = z.strictObject({
  items: MoneySchema,
  delivery: MoneySchema.optional(),
  fees: MoneySchema.optional(),
  total: MoneySchema.optional(),
  status: z.enum(["confirmed", "estimated", "unknown"]),
}).superRefine((cost, ctx) => {
  const complete = cost.delivery !== undefined && cost.fees !== undefined;
  if ((cost.status === "unknown") !== (cost.total === undefined)) {
    ctx.addIssue({ code: "custom", message: "Total ausente exige status unknown e vice-versa." });
  }
  if (cost.total !== undefined && (!complete ||
    cost.total.cents !== cost.items.cents + cost.delivery!.cents + cost.fees!.cents)) {
    ctx.addIssue({ code: "custom", path: ["total"], message: "Total exige todos os componentes e soma consistente." });
  }
});
export type Cost = z.infer<typeof CostSchema>;

export const ConstraintsSchema = z.strictObject({
  budget: z.strictObject({ limit: MoneySchema, kind: z.enum(["hard", "flexible"]) }).optional(),
  allergies: z.array(RefSchema),
  missingCompositionPolicy: z.literal("exclude-from-safe-claims"),
});
export type Constraints = z.infer<typeof ConstraintsSchema>;

export const ProposalStateSchema = z.enum([
  "draft", "awaiting_approval", "approved", "invalidated", "cancelled", "expired",
]);
export type ProposalState = z.infer<typeof ProposalStateSchema>;

// Snapshot interno de servidor. Não enviar subjectRef ao browser/LLM.
export const CartProposalSchema = z.strictObject({
  id: RefSchema,
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  subjectRef: RefSchema,
  merchantRef: RefSchema,
  addressRef: RefSchema.optional(),
  state: ProposalStateSchema,
  items: z.array(z.strictObject({
    ref: RefSchema,
    quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    unitPrice: MoneySchema,
  })).min(1),
  cost: CostSchema,
  unresolved: z.array(RefSchema),
  expiresAt: z.iso.datetime({ offset: true }),
}).superRefine((proposal, ctx) => {
  const subtotal = proposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice.cents, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal !== proposal.cost.items.cents) {
    ctx.addIssue({ code: "custom", path: ["cost", "items"], message: "Subtotal deve corresponder aos itens sem exceder inteiro seguro." });
  }
  if (new Set(proposal.items.map((item) => item.ref)).size !== proposal.items.length) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "Itens repetidos devem usar quantidade." });
  }
  if (proposal.state === "approved" && (!proposal.addressRef || proposal.unresolved.length > 0 || proposal.cost.status === "unknown")) {
    ctx.addIssue({ code: "custom", path: ["state"], message: "Proposta com pendências não pode estar aprovada." });
  }
});
export type CartProposal = z.infer<typeof CartProposalSchema>;

// Validação de formato não é autorização: identidade, validade, versão e replay
// precisam ser revalidados no servidor antes de qualquer operação remota.
export const ApprovalRequestSchema = z.strictObject({
  proposalId: RefSchema,
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  interactionId: RefSchema,
  channel: z.enum(["text", "voice", "button"]),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const PortFailureSchema = z.strictObject({
  code: z.enum(["AUTH_REQUIRED", "EXPIRED", "UNAVAILABLE", "INVALID_DATA", "STALE_PROPOSAL", "NOT_SUPPORTED", "AMBIGUOUS_RESULT"]),
  retryable: z.boolean(),
  correlationId: RefSchema,
}).refine((failure) => failure.code !== "AMBIGUOUS_RESULT" || !failure.retryable, {
  message: "Resultado ambíguo exige reconciliação antes de repetir.", path: ["retryable"],
});
export type PortFailure = z.infer<typeof PortFailureSchema>;
