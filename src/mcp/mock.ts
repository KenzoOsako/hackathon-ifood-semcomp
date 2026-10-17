// MCP simulado: permite desenvolver e fazer a demo sem o portal. Dados em fixtures/discovery.json.
import fixtures from "../../fixtures/discovery.json";
import { CandidateSchema, type Cart, type OrderStatus } from "@/contracts";
import type { McpClient, SearchParams } from "./types";

const carts = new Map<string, { cart: Cart; merchantId: string }>();
const orders = new Map<string, number>(); // orderId -> instante da criação

const STATUS = [
  { code: "ORDER_CREATED", description: "Pedido recebido", afterMs: 0 },
  { code: "CONFIRMED", description: "Restaurante confirmou", afterMs: 4000 },
  { code: "PREPARING", description: "Em preparo", afterMs: 9000 },
  { code: "ON_THE_WAY", description: "Saiu para entrega", afterMs: 16000 },
  { code: "DELIVERED", description: "Entregue", afterMs: 24000 },
];

function foldAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function createMockMcp(): McpClient {
  return {
    async listAddresses() {
      return fixtures.addresses;
    },

    async searchOffers({ query, maxItemPrice, sort }: SearchParams) {
      const q = foldAccents(query);
      let found = fixtures.candidates
        .filter((c) => foldAccents(`${c.itemName} ${c.category} ${c.merchantName}`).includes(q) || q === "")
        .map((c) => CandidateSchema.parse(c)); // zod descarta `category` (campo só das fixtures)
      if (maxItemPrice !== undefined) found = found.filter((c) => (c.promotionalPrice ?? c.price) <= maxItemPrice);
      if (sort === "PRICE") found.sort((a, b) => (a.promotionalPrice ?? a.price) - (b.promotionalPrice ?? b.price));
      if (sort === "DELIVERY_TIME") found.sort((a, b) => (a.deliveryTimeMinutes ?? 999) - (b.deliveryTimeMinutes ?? 999));
      return found;
    },

    async getRecentOrders() {
      return fixtures.history;
    },

    async createCart({ merchantId, addressId, items }) {
      const c = fixtures.candidates.find((x) => x.merchantId === merchantId && items.some((i) => i.itemId === x.itemId));
      if (!c) throw new Error("Par loja/item inválido (ITEM_MERCHANT_MISMATCH)");
      const qty = items[0].quantity;
      const unit = c.promotionalPrice ?? c.price;
      const fee = c.deliveryFee ?? 0;
      const address = fixtures.addresses.find((a) => a.addressId === addressId);
      const cart: Cart = {
        cartId: `cart-${carts.size + 1}`,
        merchantName: c.merchantName,
        items: [{ name: c.itemName, quantity: qty, price: unit }],
        deliveryFee: fee,
        total: Math.round((unit * qty + fee) * 100) / 100,
        addressFormatted: address?.formatted ?? "",
        paymentLabel: "Pix (teste)",
        canProceedToCheckout: true,
      };
      carts.set(cart.cartId, { cart, merchantId });
      return cart;
    },

    async submitOrder({ cartId, userConsent }) {
      if (!userConsent) throw new Error("CONSENT_REQUIRED");
      if (!carts.has(cartId)) throw new Error("CART_NOT_FOUND");
      const orderId = `order-${orders.size + 1}`;
      orders.set(orderId, Date.now());
      return { orderId };
    },

    async trackOrder(orderId): Promise<OrderStatus> {
      const start = orders.get(orderId);
      if (start === undefined) throw new Error("ORDER_NOT_FOUND");
      const elapsed = Date.now() - start;
      const current = [...STATUS].reverse().find((s) => elapsed >= s.afterMs)!;
      return { orderId, statusCode: current.code, description: current.description, pollingStop: current.code === "DELIVERED" };
    },
  };
}
