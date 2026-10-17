// Interface do adaptador do MCP. A frente "Agente e MCP" implementa a versão real.
// Regras do guia (docs/mcp-ifood-referencia.md): IDs vêm do servidor, preço em BRL decimal,
// checkout só com consentimento humano explícito, nunca reenviar submitOrder em resultado incerto.
import type { Address, Candidate, Cart, HistoryEntry, OrderStatus } from "@/contracts";

export interface SearchParams {
  query: string;
  addressId: string;
  maxItemPrice?: number;
  sort?: "RELEVANCE" | "PRICE" | "DELIVERY_TIME";
}

export interface McpClient {
  listAddresses(): Promise<Address[]>;
  searchOffers(params: SearchParams): Promise<Candidate[]>;
  getRecentOrders(addressId: string): Promise<HistoryEntry[]>;
  createCart(p: { merchantId: string; addressId: string; items: { itemId: string; quantity: number }[] }): Promise<Cart>;
  // userConsent só pode ser true se o usuário confirmou de forma explícita (ver agent/guard).
  submitOrder(p: { cartId: string; userConsent: boolean }): Promise<{ orderId: string }>;
  trackOrder(orderId: string): Promise<OrderStatus>;
}
