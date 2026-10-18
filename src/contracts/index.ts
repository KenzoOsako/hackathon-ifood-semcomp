// CONTRATOS COMPARTILHADOS. Só o integrador altera este arquivo (via PR).
// As frentes (agente/MCP, voz/UI, recomendação/memória) se falam por estes tipos.
import { z } from "zod";
import { PublicProposalSchema } from "./recommendation";
export * from "./proposal";
export * from "./recommendation";
export * from "./proposal-state";

// Regra de proveniência: todo motivo falado pelo agente nasce de um campo real.
// `text` é gerado por código a partir de `value`; o modelo só verbaliza.
export const ReasonSchema = z.object({
  kind: z.enum([
    "rating",
    "price",
    "delivery_time",
    "distance",
    "promo",
    "times_ordered",
    "new_for_you",
    "curated",
  ]),
  value: z.union([z.number(), z.string(), z.boolean()]),
  text: z.string(),
});
export type Reason = z.infer<typeof ReasonSchema>;

// Item encontrado pelo MCP (Discovery), já normalizado. Campos opcionais = o MCP pode não trazer.
export const CandidateSchema = z.object({
  merchantId: z.string(),
  merchantName: z.string(),
  rating: z.number().optional(),
  distanceKm: z.number().optional(),
  deliveryTimeMinutes: z.number().optional(),
  deliveryFee: z.number().optional(),
  fees: z.number().optional(),
  costStatus: z.enum(["confirmed", "estimated", "unknown"]).optional(),
  composition: z
    .object({
      ingredients: z.array(z.string()).optional(),
      allergens: z.array(z.string()).optional(),
    })
    .optional(),
  itemId: z.string(),
  itemName: z.string(),
  price: z.number(), // BRL decimal (32.9), nunca centavos
  promotionalPrice: z.number().optional(),
  curated: z.boolean().optional(), // veio de RECOMMENDED/FEATURED_LOCAL
});
export type Candidate = z.infer<typeof CandidateSchema>;

// Vem de getRecommendations(RECENT_ORDERS). Vazio no sandbox até haver pedidos de teste.
export const HistoryEntrySchema = z.object({
  merchantId: z.string(),
  timesOrdered: z.number(),
  lastOrderedAt: z.string().optional(),
  lastOrderId: z.string().optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const OptionLabelSchema = z.enum([
  "MAIS_BARATA",
  "MELHOR_AVALIADA",
  "MAIS_RAPIDA",
  "SEU_FAVORITO",
  "NOVIDADE_PARA_VOCE",
]);
export type OptionLabel = z.infer<typeof OptionLabelSchema>;

export const OptionSchema = z.object({
  label: OptionLabelSchema,
  candidate: CandidateSchema,
  reasons: z.array(ReasonSchema).min(1),
});
export type Option = z.infer<typeof OptionSchema>;

export const AddressSchema = z.object({
  addressId: z.string(),
  alias: z.string(),
  formatted: z.string(),
});
export type Address = z.infer<typeof AddressSchema>;

export const CartSchema = z.object({
  cartId: z.string(),
  merchantName: z.string(),
  items: z.array(z.object({ name: z.string(), quantity: z.number(), price: z.number() })),
  deliveryFee: z.number(),
  total: z.number(), // total vindo do servidor, nunca recalculado por nós
  addressFormatted: z.string(),
  paymentLabel: z.string(),
  canProceedToCheckout: z.boolean(),
});
export type Cart = z.infer<typeof CartSchema>;

export const OrderStatusSchema = z.object({
  orderId: z.string(),
  statusCode: z.string(),
  description: z.string(),
  pollingStop: z.boolean(),
});
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// Estados do pedido (recomendação do guia do MCP, §11).
export const OrderStateSchema = z.enum([
  "DESCOBRINDO",
  "ESCOLHENDO_OPCAO",
  "AGUARDANDO_CONFIRMACAO",
  "PEDIDO_CONFIRMADO",
  "PROPOSTA_APROVADA",
  "FALHA",
]);
export type OrderState = z.infer<typeof OrderStateSchema>;

// Resposta do agente para a interface.
export const AgentTurnSchema = z.object({
  reply: z.string(), // o que o agente fala (voz/legenda)
  state: OrderStateSchema,
  options: z.array(OptionSchema).optional(),
  cart: CartSchema.optional(),
  order: OrderStatusSchema.optional(),
  proposal: PublicProposalSchema.optional(),
});
export type AgentTurn = z.infer<typeof AgentTurnSchema>;

// Memória (camada 2). Tudo aqui só existe com consentimento do usuário.
export const MemoryEventSchema = z.object({
  at: z.string(),
  type: z.enum(["pediu", "rejeitou", "preferencia", "restricao"]),
  detail: z.string(),
});
export type MemoryEvent = z.infer<typeof MemoryEventSchema>;
