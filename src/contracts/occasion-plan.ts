import { z } from "zod";
import { ApprovalRequestSchema, CartProposalSchema, CostSchema, ProposalStateSchema, type Cost } from "./proposal";
import { OriginSchema, PublicProposalSchema, toPublicProposal } from "./recommendation";

const Ref = z.string().trim().min(1).max(200);
const Version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const OccasionSchema = z.strictObject({
  tipo: z.string().trim().min(1).max(60).optional(),
  pessoas: z.number().int().min(1).max(50).optional(),
  quando: z.string().trim().min(1).max(60).optional(),
  local: z.string().trim().min(1).max(60).optional(),
});
export type Occasion = z.infer<typeof OccasionSchema>;
export const NeedSchema = z.strictObject({
  id: Ref, vertical: z.enum(["RESTAURANT", "GROCERIES", "SHOPPING"]),
  categoria: z.string().trim().min(1).max(60),
  restricoes: z.array(z.string().trim().min(1).max(60)).max(10),
  // BRL decimal para compatibilidade com o agente atual; cálculos usam Cost.
  orcamento: z.strictObject({
    max: z.number().finite().positive().refine((value) => Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001),
    tipo: z.enum(["teto", "flexivel"]),
  }).optional(),
});
export type Need = z.infer<typeof NeedSchema>;
export const PlanBlockSchema = z.strictObject({ need: NeedSchema, proposal: CartProposalSchema, origin: OriginSchema });
export type PlanBlock = z.infer<typeof PlanBlockSchema>;

// Cada bloco é uma proposta independente de estabelecimento distinto.
export function composePlanCost(costs: readonly Cost[]): Cost {
  costs = z.array(CostSchema).min(1).max(5).parse(costs);
  const money = (cents: number) => ({ currency: "BRL" as const, cents });
  const component = (key: "items" | "delivery" | "fees" | "total") => costs.every((c) => c[key] !== undefined)
    ? money(costs.reduce((sum, c) => sum + c[key]!.cents, 0)) : undefined;
  const unknown = costs.some((c) => c.status === "unknown");
  return CostSchema.parse({
    items: component("items"), delivery: component("delivery"), fees: component("fees"),
    total: unknown ? undefined : component("total"),
    status: unknown ? "unknown" : costs.some((c) => c.status === "estimated") ? "estimated" : "confirmed",
  });
}

const header = {
  id: Ref, version: Version, state: ProposalStateSchema, occasion: OccasionSchema,
  unresolved: z.array(Ref).max(30), expiresAt: z.iso.datetime({ offset: true }),
};
const PublicBlockSchema = z.strictObject({ need: NeedSchema, proposal: PublicProposalSchema, origin: OriginSchema });
type PublicBlock = z.infer<typeof PublicBlockSchema>;
function validateCommon(plan: { state: string; expiresAt: string; unresolved: string[]; blocks: PublicBlock[] }, ctx: z.RefinementCtx) {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(plan.blocks.map((b) => b.need.id)) || !unique(plan.blocks.map((b) => b.proposal.id))) {
    ctx.addIssue({ code: "custom", path: ["blocks"], message: "Necessidades e propostas devem ter IDs únicos." });
  }
  for (const block of plan.blocks) {
    if (block.proposal.state !== plan.state || Date.parse(plan.expiresAt) > Date.parse(block.proposal.expiresAt)) {
      ctx.addIssue({ code: "custom", path: ["blocks"], message: "Estado e validade dos blocos devem respeitar o plano." });
    }
    if (plan.state === "approved") {
      const budget = block.need.orcamento;
      if (budget?.tipo === "teto" && (block.proposal.cost.total === undefined || block.proposal.cost.total.cents > Math.round(budget.max * 100))) {
        ctx.addIssue({ code: "custom", path: ["blocks"], message: "Teto rígido deve ser respeitado pelo total do bloco." });
      }
      // CartProposal ainda não carrega prova de composição/eligibilidade.
      // Não promover texto de restrição a garantia de compatibilidade.
      if (block.need.restricoes.length > 0) {
        ctx.addIssue({ code: "custom", path: ["blocks"], message: "Restrições declaradas exigem validação de composição ainda não integrada ao plano." });
      }
    }
  }
  if (plan.state === "approved" && plan.unresolved.length > 0) {
    ctx.addIssue({ code: "custom", path: ["unresolved"], message: "Plano com pendências não pode estar aprovado." });
  }
  if (!CostSchema.safeParse(composeCostSafely(plan.blocks)).success) {
    ctx.addIssue({ code: "custom", path: ["blocks"], message: "Soma dos custos excede os limites ou é inválida." });
  }
}
function composeCostSafely(blocks: PublicBlock[]): Cost | undefined {
  try { return composePlanCost(blocks.map((b) => b.proposal.cost)); } catch { return undefined; }
}

export const CompositePlanSchema = z.strictObject({
  ...header, subjectRef: Ref, blocks: z.array(PlanBlockSchema).min(1).max(5),
}).superRefine((plan, ctx) => {
  validateCommon(plan, ctx);
  const merchants = plan.blocks.map((b) => b.proposal.merchantRef);
  if (new Set(merchants).size !== merchants.length) {
    ctx.addIssue({ code: "custom", path: ["blocks"], message: "Consolidar necessidades do mesmo estabelecimento antes de compor o plano." });
  }
  const addresses = plan.blocks.map((b) => b.proposal.addressRef).filter((ref) => ref !== undefined);
  if (new Set(addresses).size > 1 || plan.blocks.some((b) => b.proposal.subjectRef !== plan.subjectRef)) {
    ctx.addIssue({ code: "custom", path: ["blocks"], message: "Todos os blocos devem pertencer ao mesmo sujeito e endereço." });
  }
});
export type CompositePlan = z.infer<typeof CompositePlanSchema>;

export const PublicCompositePlanSchema = z.strictObject({
  ...header, blocks: z.array(PublicBlockSchema).min(1).max(5), cost: CostSchema,
}).superRefine((plan, ctx) => {
  validateCommon(plan, ctx);
  const expected = composeCostSafely(plan.blocks);
  if (!expected || plan.cost.status !== expected.status || (["items", "delivery", "fees", "total"] as const).some((key) => plan.cost[key]?.cents !== expected[key]?.cents)) {
    ctx.addIssue({ code: "custom", path: ["cost"], message: "Custo composto deve corresponder aos blocos." });
  }
});
export type PublicCompositePlan = z.infer<typeof PublicCompositePlanSchema>;
export function toPublicCompositePlan(input: unknown): PublicCompositePlan {
  const plan = CompositePlanSchema.parse(input);
  return PublicCompositePlanSchema.parse({
    id: plan.id, version: plan.version, state: plan.state, occasion: plan.occasion,
    unresolved: plan.unresolved, expiresAt: plan.expiresAt,
    blocks: plan.blocks.map((b) => ({ need: b.need, origin: b.origin, proposal: toPublicProposal(b.proposal) })),
    cost: composePlanCost(plan.blocks.map((b) => b.proposal.cost)),
  });
}
export const PlanApprovalRequestSchema = z.strictObject({
  planId: Ref, version: Version,
  interactionId: ApprovalRequestSchema.shape.interactionId,
  channel: ApprovalRequestSchema.shape.channel,
});
export type PlanApprovalRequest = z.infer<typeof PlanApprovalRequestSchema>;
