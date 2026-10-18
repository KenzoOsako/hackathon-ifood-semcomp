// Orquestração textual provisória: apenas leituras mock e proposta local.
import { randomUUID } from "node:crypto";
import { AddressSchema, type Address, type AgentTurn, type Option } from "@/contracts";
import type { HandoffPresentation } from "@/domain/handoff";
import {
  approveProposalWithHandoff,
  buildProposalFromCandidate,
  evaluateAndRankSearchCandidates,
  parseSearchIntentFromText,
} from "@/domain/proposal-workflow";
import { getMcp } from "@/mcp";
import type { McpClient } from "@/mcp/types";
import { ProposalError, ProposalStore } from "./proposals";

export interface Conversation {
  subjectRef: string;
  options: Option[];
  address?: Address;
  proposal?: { id: string; version: number };
  proposalPresentation?: HandoffPresentation;
  proposals: ProposalStore;
}
export const createConversation = (subjectRef: string): Conversation => ({ subjectRef, options: [], proposals: new ProposalStore(1) });
type ReadPort = Pick<McpClient, "listAddresses" | "searchOffers" | "getRecentOrders">;
const norm = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function discardProposal(c: Conversation) {
  if (!c.proposal) {
    c.proposalPresentation = undefined;
    return;
  }
  try { c.proposals.cancel(c.proposal.id, c.subjectRef, c.proposal.version); }
  catch (error) { if (!(error instanceof ProposalError) || error.code !== "EXPIRED") throw error; }
  c.proposal = undefined;
  c.proposalPresentation = undefined;
}

export function approveProposal(c: Conversation, request: unknown): AgentTurn {
  const result = approveProposalWithHandoff(c.proposals, {
    subjectRef: c.subjectRef,
    request,
    presentation: c.proposalPresentation,
  });
  return {
    state: "PROPOSTA_APROVADA",
    proposal: result.publicProposal,
    reply: result.reply,
  };
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
    const built = buildProposalFromCandidate(c.proposals, {
      subjectRef: c.subjectRef,
      candidate: option.candidate,
      address: c.address,
      mode: "mock",
    });
    c.proposal = { id: built.proposal.id, version: built.proposal.version };
    c.proposalPresentation = built.presentation;
    return {
      state: "AGUARDANDO_CONFIRMACAO",
      proposal: built.publicProposal,
      reply: built.reply,
    };
  }
  // Busca/refinamento invalida a proposta anterior antes de I/O.
  discardProposal(c); c.options = [];
  const { foodQuery, hardBudgetBrl, allergies } = parseSearchIntentFromText(text, t);
  const [candidates, history] = await Promise.all([
    port.searchOffers({ query: foodQuery, addressId: c.address.addressId, maxItemPrice: hardBudgetBrl }),
    port.getRecentOrders(c.address.addressId),
  ]);
  const { options } = evaluateAndRankSearchCandidates({
    candidates,
    history,
    hardBudgetBrl,
    allergies,
  });
  c.options = options;
  return options.length === 0 ? { state: "DESCOBRINDO", reply: "Não encontrei opções no mock. Quer refinar a busca? Limites rígidos não serão ampliados automaticamente." } : {
    state: "ESCOLHENDO_OPCAO", options, reply: `[Simulado] Endereço: ${c.address.alias}. Encontrei ${options.length} opções. O limite rígido considera o total com frete e taxas quando informados.\n${options.map((o, i) => `${i + 1}. ${o.candidate.merchantName}: ${o.candidate.itemName}`).join("\n")}\nQual você prefere?`,
  };
}
