// Orquestração textual provisória: apenas leituras mock e proposta local.
import { randomUUID } from "node:crypto";
import { AddressSchema, CandidateSchema, HistoryEntrySchema, toPublicProposal, type Address, type AgentTurn, type Option } from "@/contracts";
import { getMcp } from "@/mcp";
import type { McpClient } from "@/mcp/types";
import { rank } from "@/reco/rank";
import { ProposalError, ProposalStore } from "./proposals";

export interface Conversation {
  subjectRef: string;
  options: Option[];
  address?: Address;
  proposal?: { id: string; version: number };
  proposals: ProposalStore;
}
export const createConversation = (subjectRef: string): Conversation => ({ subjectRef, options: [], proposals: new ProposalStore(1) });
type ReadPort = Pick<McpClient, "listAddresses" | "searchOffers" | "getRecentOrders">;
const norm = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const brl = (amount: number) => `R$ ${(amount / 100).toFixed(2).replace(".", ",")}`;
function cents(value: number): number {
  const amount = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(amount) || Math.abs(value * 100 - amount) > 0.000001) throw new ProposalError("INVALID_DATA");
  return amount;
}

function discardProposal(c: Conversation) {
  if (!c.proposal) return;
  try { c.proposals.cancel(c.proposal.id, c.subjectRef, c.proposal.version); }
  catch (error) { if (!(error instanceof ProposalError) || error.code !== "EXPIRED") throw error; }
  c.proposal = undefined;
}

export function approveProposal(c: Conversation, request: unknown): AgentTurn {
  const approved = c.proposals.approve(c.subjectRef, request);
  return { state: "PROPOSTA_APROVADA", proposal: toPublicProposal(approved), reply: "Proposta local aprovada. Nenhum item foi adicionado e nenhum pedido foi enviado. Confira os itens e finalize a compra no iFood; transferência automática não está disponível nesta demo." };
}

export async function handleMessage(c: Conversation, text: string, readPort?: ReadPort): Promise<AgentTurn> {
  // Visitante não é OAuth; bloquear real mesmo se getMcp tiver mock em cache.
  if ((process.env.MCP_MODE ?? "mock") !== "mock") throw new ProposalError("UNAVAILABLE");
  const t = norm(text);
  if (/^(cancelar|cancela)$/.test(t)) {
    discardProposal(c); c.options = [];
    return { state: "DESCOBRINDO", reply: "Proposta local cancelada. Nenhuma operação remota foi executada." };
  }
  const approval = t.match(/^aprovar ([0-9a-f-]{36}) v([1-9]\d*)$/);
  if (approval) return approveProposal(c, { proposalId: approval[1], version: Number(approval[2]), interactionId: randomUUID(), channel: "text" });
  if (/^(sim|confirmo|aprovar)$/.test(t)) return { state: "DESCOBRINDO", reply: "Para aprovar, use a referência e a versão exibidas na proposta. Um sim isolado não aprova." };

  const selected = t.match(/^(?:quero (?:a |o )?)?([1-3])$/);
  // Invalidar imediatamente mesmo se a leitura externa seguinte falhar.
  discardProposal(c);
  if (!selected) c.options = [];
  const port = readPort ?? getMcp();
  const addresses = (await port.listAddresses()).map((a) => AddressSchema.parse(a));
  const addressChoice = t.match(/^endereco ([1-9]\d*)$/);
  if (addressChoice) {
    const address = addresses[Number(addressChoice[1]) - 1];
    if (!address) throw new ProposalError("INVALID_DATA");
    discardProposal(c); c.options = []; c.address = address;
    return { state: "DESCOBRINDO", reply: `Endereço simulado selecionado: ${address.alias}. O que você quer comer?` };
  }
  if (addresses.length === 0) {
    discardProposal(c); c.options = []; c.address = undefined;
    return { state: "DESCOBRINDO", reply: "Nenhum endereço disponível no mock. Selecione um endereço pelo caminho suportado antes de buscar." };
  }
  const previous = c.address;
  c.address = previous && addresses.find((a) => a.addressId === previous.addressId);
  if (!c.address && addresses.length === 1) c.address = addresses[0];
  if (previous && c.address?.addressId !== previous.addressId) c.options = [];
  if (!c.address) {
    discardProposal(c); c.options = [];
    return { state: "DESCOBRINDO", reply: `Escolha um endereço simulado com “endereço N”:\n${addresses.map((a, i) => `${i + 1}. ${a.alias}`).join("\n")}` };
  }
  if (selected) {
    const option = c.options[Number(selected[1]) - 1];
    if (!option) throw new ProposalError("INVALID_DATA");
    discardProposal(c);
    const candidate = option.candidate;
    const unit = { currency: "BRL" as const, cents: cents(candidate.promotionalPrice ?? candidate.price) };
    const delivery = candidate.deliveryFee === undefined ? undefined : { currency: "BRL" as const, cents: cents(candidate.deliveryFee) };
    const p = c.proposals.create(c.subjectRef, {
      merchantRef: candidate.merchantId, addressRef: c.address.addressId,
      items: [{ ref: candidate.itemId, quantity: 1, unitPrice: unit }],
      // O contrato legado não informa taxas. Não inventar zero nem total.
      cost: { items: unit, ...(delivery ? { delivery } : {}), status: "unknown" },
      unresolved: ["Taxas e total não confirmados", ...(delivery ? [] : ["Frete desconhecido"])],
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    const reviewed = c.proposals.review(p.id, c.subjectRef, p.version);
    c.proposal = { id: reviewed.id, version: reviewed.version };
    return { state: "AGUARDANDO_CONFIRMACAO", proposal: toPublicProposal(reviewed), reply: `[Simulado] Proposta local: 1× ${candidate.itemName}, ${candidate.merchantName}. Item ${brl(unit.cents)}; frete ${delivery ? brl(delivery.cents) : "desconhecido"}; taxas e total pendentes. Endereço: ${c.address.alias}.\nAprovação bloqueada até resolver as pendências. Referência ${reviewed.id}, versão ${reviewed.version}. Digite “cancelar” ou refaça a busca para editar. Nenhum carrinho remoto foi criado; a compra final é no iFood.` };
  }
  // Busca/refinamento invalida a proposta anterior antes de I/O.
  discardProposal(c); c.options = [];
  const food = ["hamburguer", "pizza", "sushi", "acai", "lanche"].find((f) => t.includes(f)) ?? (t.includes("fome") ? "hamburguer" : text);
  const budget = t.match(/ate\s*r?\$?\s*(\d+(?:[.,]\d{1,2})?)/)?.[1];
  const [candidates, history] = await Promise.all([
    port.searchOffers({ query: food, addressId: c.address.addressId, maxItemPrice: budget ? Number(budget.replace(",", ".")) : undefined }),
    port.getRecentOrders(c.address.addressId),
  ]);
  const options = rank(candidates.map((item) => CandidateSchema.parse(item)), history.map((item) => HistoryEntrySchema.parse(item)));
  c.options = options;
  return options.length === 0 ? { state: "DESCOBRINDO", reply: "Não encontrei opções no mock. Quer refinar a busca? Limites rígidos não serão ampliados automaticamente." } : {
    state: "ESCOLHENDO_OPCAO", options, reply: `[Simulado] Endereço: ${c.address.alias}. Encontrei ${options.length} opções. O limite informado filtra apenas o item neste esqueleto; não garante total com frete/taxas.\n${options.map((o, i) => `${i + 1}. ${o.candidate.merchantName}: ${o.candidate.itemName}`).join("\n")}\nQual você prefere?`,
  };
}
