// Geração pura de resumo copiável para continuidade manual no iFood (K-4).
// Reutiliza PublicProposal e metadados de apresentação do servidor, sem I/O externo, URL/deeplink ou carrinho remoto.
import { z } from "zod";
import {
  OriginSchema,
  PublicProposalSchema,
  type Money,
  type Origin,
  type ProposalState,
  type PublicProposal,
} from "@/contracts";

export class HandoffSummaryError extends Error {
  readonly code = "INVALID_DATA" as const;

  constructor(message = "INVALID_DATA") {
    super(message);
    this.name = "HandoffSummaryError";
  }
}

const SafePresentationTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((val) => !/(?:https?:\/\/|ifood:\/\/|www\.)/i.test(val), {
    message: "Texto de apresentação não pode conter URL ou deeplink não validado.",
  })
  .refine(
    (val) =>
      !/\bBearer\s+\S+/i.test(val) &&
      !/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(val) &&
      !/\b(?:access_token|refresh_token|subjectRef|sessionId)\b/i.test(val),
    {
      message: "Texto de apresentação não pode conter tokens ou identificadores internos.",
    },
  );

export const HandoffPresentationSchema = z.strictObject({
  mode: z.enum(["real", "mock"]).optional(),
  origins: z.array(OriginSchema).min(1).optional(),
  merchantName: SafePresentationTextSchema.optional(),
  addressLabel: SafePresentationTextSchema.optional(),
  itemNames: z.record(z.string().trim().min(1), SafePresentationTextSchema).optional(),
});
export type HandoffPresentation = z.infer<typeof HandoffPresentationSchema>;

export interface ManualHandoffInput {
  proposal: PublicProposal;
  presentation?: HandoffPresentation;
  now?: string | number | Date;
}

export interface ManualHandoffSummary {
  proposalId: string;
  version: number;
  state: ProposalState;
  text: string;
  isSimulated: boolean;
  isEstimated: boolean;
  isExpired: boolean;
  requiresNewReview: boolean;
  unresolved: string[];
  remoteCartCreated: false;
  orderSubmitted: false;
  transferMode: "manual_copy";
}

function formatMoneyBrl(money: Money): string {
  return `R$ ${(money.cents / 100).toFixed(2).replace(".", ",")}`;
}

function resolveNowTimestamp(now: ManualHandoffInput["now"]): number {
  if (now === undefined) return Date.now();
  const ms = typeof now === "number" ? now : now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(ms)) {
    throw new HandoffSummaryError("Instante de referência (now) inválido.");
  }
  return ms;
}

function detectSimulated(presentation?: HandoffPresentation): boolean {
  if (!presentation) return true;
  const hasMockOrigin = presentation.origins?.some((origin: Origin) => origin.mode === "mock") ?? false;
  if (presentation.mode === "mock" || hasMockOrigin) return true;
  if (presentation.mode === "real") return false;
  if (presentation.origins && presentation.origins.every((origin: Origin) => origin.mode === "real")) {
    return false;
  }
  return true;
}

function collectUnresolved(proposal: PublicProposal, isExpired: boolean): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  const push = (entry: string) => {
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    list.push(normalized);
  };

  for (const item of proposal.unresolved) {
    push(item);
  }
  if (proposal.cost.delivery === undefined) {
    push("Frete desconhecido");
  }
  if (proposal.cost.fees === undefined) {
    push("Taxas desconhecidas");
  }
  if (isExpired) {
    push("Proposta expirada — exige nova revisão");
  } else if (proposal.state === "invalidated") {
    push("Proposta invalidada — exige nova revisão");
  } else if (proposal.state === "cancelled") {
    push("Proposta cancelada — exige nova revisão");
  }
  return list;
}

/**
 * Gera um resumo estruturado e texto copiável de uma PublicProposal para continuidade manual no iFood.
 * Rejeita propostas com campos internos/privados (ex.: subjectRef, addressRef, tokens) ou URLs não validadas.
 */
export function buildManualHandoffSummary(input: ManualHandoffInput): ManualHandoffSummary {
  if (typeof input !== "object" || input === null) {
    throw new HandoffSummaryError("Entrada de handoff inválida.");
  }

  const parsedProposal = PublicProposalSchema.safeParse(input.proposal);
  if (!parsedProposal.success) {
    throw new HandoffSummaryError("PublicProposal inválida ou contém dados privados não permitidos.");
  }
  const proposal = parsedProposal.data;

  const parsedPresentation =
    input.presentation === undefined
      ? { success: true as const, data: undefined }
      : HandoffPresentationSchema.safeParse(input.presentation);
  if (!parsedPresentation.success) {
    throw new HandoffSummaryError("Dados de apresentação inválidos ou contêm campos não autorizados.");
  }
  const presentation = parsedPresentation.data;

  const nowMs = resolveNowTimestamp(input.now);
  const expiresAtMs = Date.parse(proposal.expiresAt);
  const isExpired = proposal.state === "expired" || expiresAtMs <= nowMs;
  const effectiveState: ProposalState = isExpired ? "expired" : proposal.state;

  const isSimulated = detectSimulated(presentation);
  const isEstimated = proposal.cost.status === "estimated";
  const isUnknownCost = proposal.cost.status === "unknown" || proposal.cost.total === undefined;
  const unresolved = collectUnresolved(proposal, isExpired);
  const requiresNewReview =
    isExpired || effectiveState !== "approved" || unresolved.length > 0 || isUnknownCost;

  const lines: string[] = [];

  lines.push(
    isSimulated
      ? "=== RESUMO MANUAL DO PEDIDO [DADOS SIMULADOS / MOCK] ==="
      : "=== RESUMO MANUAL DO PEDIDO [DADOS REAIS / MCP] ===",
  );

  if (isSimulated) {
    lines.push(
      "Origem dos dados: Simulado (mock de demonstração — valores e disponibilidade não vêm do catálogo real).",
    );
  } else {
    lines.push("Origem dos dados: Real (consultado via servidor MCP autorizado).");
  }

  lines.push(`Proposta: ${proposal.id} (versão ${proposal.version})`);

  if (isExpired) {
    lines.push("ATENÇÃO: Proposta expirada. Exige nova revisão antes de continuar no iFood.");
  } else if (effectiveState === "invalidated" || effectiveState === "cancelled") {
    lines.push(
      `ATENÇÃO: Proposta ${effectiveState === "invalidated" ? "invalidada" : "cancelada"}. Exige nova revisão antes de continuar no iFood.`,
    );
  } else if (requiresNewReview) {
    lines.push("Status: Com pendências — exige revisão antes de concluir no iFood.");
  } else {
    lines.push("Status: Proposta revisada e aprovada localmente.");
  }

  if (presentation?.merchantName) {
    lines.push(`Estabelecimento: ${presentation.merchantName}`);
  }
  if (presentation?.addressLabel) {
    lines.push(`Local de entrega (referência): ${presentation.addressLabel}`);
  }

  lines.push("");
  lines.push("Itens:");
  for (const item of proposal.items) {
    const label = presentation?.itemNames?.[item.ref] ?? item.ref;
    const lineCents = item.quantity * item.unitPrice.cents;
    const subtotalMoney: Money = { currency: "BRL", cents: lineCents };
    const estimatedSuffix = isEstimated ? " (estimado)" : "";
    lines.push(
      `- ${item.quantity}x ${label}: ${formatMoneyBrl(item.unitPrice)} cada | subtotal ${formatMoneyBrl(subtotalMoney)}${estimatedSuffix}`,
    );
  }

  lines.push("");
  lines.push("Custos e encargos:");
  lines.push(
    `- Subtotal dos itens: ${formatMoneyBrl(proposal.cost.items)}${isEstimated ? " (estimado)" : ""}`,
  );

  if (proposal.cost.delivery === undefined) {
    lines.push("- Frete: desconhecido (pendente)");
  } else if (proposal.cost.delivery.cents === 0) {
    lines.push(`- Frete: R$ 0,00 (grátis explícito)${isEstimated ? " (estimado)" : ""}`);
  } else {
    lines.push(`- Frete: ${formatMoneyBrl(proposal.cost.delivery)}${isEstimated ? " (estimado)" : ""}`);
  }

  if (proposal.cost.fees === undefined) {
    lines.push("- Taxas: desconhecidas (pendente)");
  } else {
    lines.push(`- Taxas: ${formatMoneyBrl(proposal.cost.fees)}${isEstimated ? " (estimado)" : ""}`);
  }

  if (isUnknownCost || proposal.cost.total === undefined) {
    lines.push("- Total: desconhecido (não confirmado — depende de encargos pendentes)");
  } else if (isEstimated) {
    lines.push(
      `- Total estimado: ${formatMoneyBrl(proposal.cost.total)} (valor estimado, sujeito a confirmação no iFood)`,
    );
  } else {
    lines.push(`- Total: ${formatMoneyBrl(proposal.cost.total)} (confirmado na proposta)`);
  }

  lines.push("");
  if (unresolved.length > 0) {
    lines.push("Pendências:");
    for (const pending of unresolved) {
      lines.push(`- ${pending}`);
    }
  } else {
    lines.push("Pendências: nenhuma.");
  }

  lines.push("");
  lines.push(
    "Aviso importante: Nenhuma compra, reserva ou criação de carrinho remoto foi realizada pelo FoodPilot.",
  );
  lines.push(
    "Como continuar: Abra o aplicativo do iFood, busque o estabelecimento e adicione os itens manualmente. Transferência automática e links externos não são gerados sem suporte validado.",
  );

  return {
    proposalId: proposal.id,
    version: proposal.version,
    state: effectiveState,
    text: lines.join("\n"),
    isSimulated,
    isEstimated,
    isExpired,
    requiresNewReview,
    unresolved,
    remoteCartCreated: false,
    orderSubmitted: false,
    transferMode: "manual_copy",
  };
}

/**
 * Retorna diretamente o texto copiável do resumo manual para continuidade no iFood.
 */
export function formatManualHandoffText(input: ManualHandoffInput): string {
  return buildManualHandoffSummary(input).text;
}
