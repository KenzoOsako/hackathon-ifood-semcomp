// AGENTE (versão do esqueleto): entende por palavras-chave, SEM modelo de linguagem.
// A frente "Agente e MCP" troca `handleMessage` por um laço com LLM + tool use, mantendo:
//   - a máquina de estados (OrderState) e a trava de confirmação;
//   - os motivos vindos de `rank` (o modelo só verbaliza).
import type { AgentTurn, Candidate, Option, OrderState } from "@/contracts";
import { getMcp } from "@/mcp";
import { rank } from "@/reco/rank";

interface Session {
  state: OrderState;
  addressId: string;
  options: Option[];
  cartId?: string;
}

const g = globalThis as unknown as { __sessions?: Map<string, Session> };
const sessions = (g.__sessions ??= new Map<string, Session>());

function session(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { state: "DESCOBRINDO", addressId: "addr-1", options: [] };
    sessions.set(id, s);
  }
  return s;
}

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const FOODS = ["hamburguer", "pizza", "sushi", "acai", "lanche"];

function parseIntent(text: string) {
  const t = norm(text);
  const food = FOODS.find((f) => t.includes(f)) ?? (t.includes("fome") ? "hamburguer" : "");
  const budget = t.match(/ate\s*r?\$?\s*(\d+)/)?.[1];
  const ordinal = /\b(1|primeir)/.test(t) ? 0 : /\b(2|segund)/.test(t) ? 1 : /\b(3|terceir)/.test(t) ? 2 : undefined;
  return { food, maxItemPrice: budget ? Number(budget) : undefined, ordinal };
}

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

export async function handleMessage(sessionId: string, text: string): Promise<AgentTurn> {
  const s = session(sessionId);
  const mcp = getMcp();
  const { food, maxItemPrice, ordinal } = parseIntent(text);

  // Escolha de uma das opções já apresentadas.
  if (s.state === "ESCOLHENDO_OPCAO" && ordinal !== undefined && s.options[ordinal]) {
    const opt = s.options[ordinal];
    const cart = await mcp.createCart({
      merchantId: opt.candidate.merchantId,
      addressId: s.addressId,
      items: [{ itemId: opt.candidate.itemId, quantity: 1 }],
    });
    s.cartId = cart.cartId;
    s.state = "AGUARDANDO_CONFIRMACAO";
    return {
      state: s.state,
      cart,
      reply: `${opt.candidate.itemName} da ${cart.merchantName}, total ${brl(cart.total)} com entrega, em ${cart.addressFormatted}, pagando no ${cart.paymentLabel}. Posso confirmar o pedido?`,
    };
  }

  // Busca + recomendação.
  const query = food || text;
  const [candidates, history] = await Promise.all([
    mcp.searchOffers({ query, addressId: s.addressId, maxItemPrice }),
    mcp.getRecentOrders(s.addressId),
  ]);
  const options = rank(candidates as Candidate[], history);
  if (options.length === 0) {
    s.state = "DESCOBRINDO";
    return { state: s.state, reply: "Não encontrei nada com isso por perto. Quer tentar outro prato ou subir o orçamento?" };
  }
  s.options = options;
  s.state = "ESCOLHENDO_OPCAO";
  const falas = options.map((o, i) => `${i + 1}. ${o.candidate.merchantName}: ${o.reasons.slice(0, 3).map((r) => r.text).join(", ")}`);
  return { state: s.state, options, reply: `Encontrei ${options.length} opções:\n${falas.join("\n")}\nQual você prefere?` };
}

// CONFIRMAÇÃO: único caminho que chama submitOrder. Exige ação explícita da pessoa (botão ou frase
// validada pela interface). O modelo nunca preenche `explicit`.
export async function confirmOrder(sessionId: string, explicit: boolean): Promise<AgentTurn> {
  const s = session(sessionId);
  if (s.state !== "AGUARDANDO_CONFIRMACAO" || !s.cartId) {
    return { state: s.state, reply: "Não há pedido aguardando confirmação." };
  }
  if (!explicit) return { state: s.state, reply: "Preciso da sua confirmação explícita para fechar o pedido." };
  const mcp = getMcp();
  const { orderId } = await mcp.submitOrder({ cartId: s.cartId, userConsent: true });
  s.state = "PEDIDO_CONFIRMADO";
  const order = await mcp.trackOrder(orderId);
  return { state: s.state, order, reply: `Pedido feito! Status: ${order.description}.` };
}

export async function orderStatus(orderId: string) {
  return getMcp().trackOrder(orderId);
}

export function resetSession(sessionId: string) {
  sessions.delete(sessionId);
}
