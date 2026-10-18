// Domínio real do agente: mesma interface do FakeDomain, dados do MCP do iFood.
// Busca via searchOffers (item já traz preço, loja aberta, nota, prazo e frete), aplica a
// normalização e os filtros rígidos do Kenzo (src/mcp/normalize-candidate, src/reco/eligibility)
// e guarda os candidatos do plano para o ajuste reordenar sem nova chamada ao MCP.
import { randomUUID } from "node:crypto";
import { brlToMoney } from "@/mcp/costs";
import { normalizeCandidate, type NormalizedCandidate } from "@/mcp/normalize-candidate";
import { compareEligibleCandidates } from "@/reco/rank-eligible";
import { filterEligibleCandidates, type CandidateEligibilityResult } from "@/reco/eligibility";
import { soOsEspecificos } from "../especificidade";
import { descricaoDe } from "../descricao";
import { urlDoIfood } from "../guardas-fala";
import { MAX_CONSULTAS } from "../limites";
import { normalizarComplementos } from "../complementos";
import type { BlocoPlano, Criterio, DomainPort, EventoFeedback, Necessidade, Ocasiao, OpcaoPlano, PlanoSnapshot, RelatorioBusca, Vertical } from "../types";

// Porta mínima para o cliente MCP: o domínio não conhece transporte nem token.
export interface McpTools { callTool(name: string, args: Record<string, unknown>): Promise<unknown> }
export interface Localizacao { latitude: number; longitude: number; fonte: "endereco" | "fixa" }

// O MCP do iFood é uma credencial compartilhada e devolve INTERNAL quando recebe rajada (medido em 18/10: 4 de 5 chamadas
// simultâneas falharam). Por isso: no máximo N chamadas ao mesmo tempo no processo e UMA nova tentativa em INTERNAL.
const MAX_CONCORRENTES = Number(process.env.MCP_CONCORRENCIA) || 3;
const gFila = globalThis as unknown as { __guideMcpFila?: { ativos: number; espera: (() => void)[] } };
const fila = (gFila.__guideMcpFila ??= { ativos: 0, espera: [] });
export async function comLimite<T>(fn: () => Promise<T>, max = MAX_CONCORRENTES): Promise<T> {
  if (fila.ativos >= max) await new Promise<void>((liberar) => fila.espera.push(liberar)); // a vaga passa direto para quem espera
  else fila.ativos++;
  try { return await fn(); }
  finally { const prox = fila.espera.shift(); if (prox) prox(); else fila.ativos--; }
}
const ehInterno = (e: unknown) => /INTERNAL/.test(String(e));
// O próprio iFood devolve, junto do INTERNAL: "Do not retry immediately". Por isso a nova tentativa espera (padrão 2 s) e é UMA só.
const pausaRetryMs = () => { const v = Number(process.env.MCP_RETRY_MS); return Number.isFinite(v) && v >= 0 ? v : 2000; };

// Cache de busca: só resposta COM itens, por consulta + vertical + restrições + local, 3 min. Vazio e erro nunca entram
// (um "não existe" falso, vindo de erro do iFood, ficaria repetido por minutos). getItem nunca é cacheado: confere preço e
// disponibilidade da opção escolhida na hora de montar o plano.
const TTL_CACHE_MS = 3 * 60_000;
const MAX_CACHE = 200;
const cacheLigado = () => process.env.ATENDENTE_CACHE !== "off";

const MAX_CANDIDATOS = 10;
// Candidatos que entram na avaliação de relevância (antes de cortar pelo ranking de preço, que sozinho põe lixo barato na frente).
const PAGE_SIZE = 15;
const RESTRICOES_MCP: Record<string, string> = { lactose: "LAC_FREE", gluten: "GLUTEN_FREE", acucar: "SUGAR_FREE" };

interface ItemBusca {
  itemId: string; itemName: string; unitPrice: number; promotionalUnitPrice?: number | null; itemImageUrl?: string;
  merchant: {
    merchantId: string; merchantName: string; merchantLogoUrl?: string; isOpen?: boolean; reviewRating?: number; ratingCount?: number;
    straightLineDistanceKm?: number; minimumOrderAmount?: number;
    deliveryMethod?: { fee?: number; promotionalFee?: number; estimatedMinutes?: { min?: number; max?: number } } | null;
  };
}

// Candidato guardado no plano: opção pública + campos para reordenar por critério.
interface Candidato { opcao: OpcaoPlano; precoCents: number; prazoMin?: number; nota?: number; minimoCents?: number }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const reais = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
// A API devolve nota como float (4.699999809265137): arredondar antes de exibir ou comparar.
const nota1 = (n?: number) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined);

// 1 a MAX_CONSULTAS termos de busca, sem repetir e sem vazio; sem consultas do planejador, a própria categoria.
export function consultasDe(n: Pick<Necessidade, "categoria" | "consultas">): string[] {
  const lista = [...(n.consultas ?? []), n.categoria].map((q) => q.trim().replace(/\s+/g, " ")).filter((q) => q.length > 0);
  const vistos = new Set<string>();
  return lista.filter((q) => { const k = norm(q); if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, MAX_CONSULTAS);
}

// Campos do cartão de sugestão, só do que o MCP devolveu (nenhum texto do modelo).
function extrasDoCartao(item: ItemBusca, precoCents: number, minimoCents?: number): Partial<OpcaoPlano> {
  const m = item.merchant;
  const entrega = m.deliveryMethod ?? undefined;
  const frete = entrega?.promotionalFee ?? entrega?.fee;
  const prazoMax = entrega?.estimatedMinutes?.max;
  const promo = typeof item.promotionalUnitPrice === "number" && item.promotionalUnitPrice < item.unitPrice;
  const imagemUrl = urlDoIfood(item.itemImageUrl);
  const logoUrl = urlDoIfood(m.merchantLogoUrl);
  const extras: Partial<OpcaoPlano> = {
    ...(imagemUrl ? { imagemUrl } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    ...(typeof m.straightLineDistanceKm === "number" && m.straightLineDistanceKm >= 0 ? { distanciaKm: Math.round(m.straightLineDistanceKm * 10) / 10 } : {}),
    ...(typeof m.ratingCount === "number" && m.ratingCount > 0 ? { avaliacoes: Math.round(m.ratingCount) } : {}),
    ...(minimoCents ? { pedidoMinimoCents: minimoCents } : {}),
    ...(promo ? { precoOriginalCents: brlToMoney(item.unitPrice).cents } : {}),
  };
  const descricao = descricaoDe({
    nota: nota1(m.reviewRating), avaliacoes: extras.avaliacoes, distanciaKm: extras.distanciaKm,
    prazo: typeof prazoMax === "number" && prazoMax > 0 ? `até ${Math.round(prazoMax)} minutos` : undefined,
    freteCents: typeof frete === "number" ? brlToMoney(frete).cents : undefined,
    pedidoMinimoCents: extras.pedidoMinimoCents, precoCents, precoOriginalCents: extras.precoOriginalCents,
  });
  return { ...extras, ...(descricao ? { descricao } : {}) };
}

export function quantidadePara(n: Necessidade, ocasiao: Ocasiao): number {
  const pessoas = ocasiao.pessoas ?? 1;
  if (n.vertical === "SHOPPING") return 1;
  // Estimativa simples e declarada como pendência: pizza e itens de mercado servem ~3 pessoas.
  if (n.vertical === "GROCERIES" || /pizza/.test(norm(n.categoria))) return Math.max(1, Math.ceil(pessoas / 3));
  return pessoas;
}

function extrairItens(resposta: unknown): ItemBusca[] {
  const r = resposta as { results?: unknown; data?: { results?: unknown } } | undefined;
  const lista = r?.results ?? r?.data?.results;
  return Array.isArray(lista) ? (lista as ItemBusca[]).filter((i) => i?.itemId && i?.merchant?.merchantId) : [];
}

function paraCandidato(item: ItemBusca, observedAt: string): { normalizado: NormalizedCandidate; base: Omit<Candidato, "opcao"> & { item: ItemBusca } } | undefined {
  const m = item.merchant;
  const entrega = m.deliveryMethod ?? undefined;
  const frete = entrega?.promotionalFee ?? entrega?.fee;
  const prazoMin = entrega?.estimatedMinutes?.max;
  const promo = typeof item.promotionalUnitPrice === "number" && item.promotionalUnitPrice < item.unitPrice ? item.promotionalUnitPrice : undefined;
  try {
    const normalizado = normalizeCandidate({
      itemId: item.itemId, itemName: item.itemName, merchantId: m.merchantId, merchantName: m.merchantName,
      price: item.unitPrice, ...(promo !== undefined ? { promotionalPrice: promo } : {}),
      ...(typeof frete === "number" ? { deliveryFee: frete } : {}),
      ...(nota1(m.reviewRating) !== undefined ? { rating: Math.min(5, nota1(m.reviewRating)!) } : {}),
      ...(typeof prazoMin === "number" && prazoMin > 0 ? { deliveryTimeMinutes: Math.round(prazoMin) } : {}),
      ...(typeof m.straightLineDistanceKm === "number" ? { distanceKm: m.straightLineDistanceKm } : {}),
      // Loja fechada ou sem método de entrega não é opção.
      available: m.isOpen === true && !!entrega,
      origin: { mode: "real", source: "ifood-mcp:searchOffers", observedAt },
    });
    return {
      normalizado,
      base: { item, precoCents: normalizado.unitPrice.cents, prazoMin: normalizado.deliveryTimeMinutes, nota: normalizado.rating, minimoCents: typeof m.minimumOrderAmount === "number" ? brlToMoney(m.minimumOrderAmount).cents : undefined },
    };
  } catch {
    // Item com dado inválido (preço, nota fora da faixa) fica de fora em vez de virar opção inventada.
    return undefined;
  }
}

const CRITERIOS = ["mais_barata", "mais_rapida", "melhor_avaliada"] as const;
type CriterioComDado = (typeof CRITERIOS)[number];
// "Mais barata" compara item + frete (como o ranking do domínio); sem frete conhecido não concorre.
const custoComFrete = (c: Candidato) => (c.opcao.freteCents === undefined ? undefined : c.precoCents + c.opcao.freteCents);
const valor: Record<CriterioComDado, (c: Candidato) => number | undefined> = {
  mais_barata: custoComFrete,
  mais_rapida: (c) => c.prazoMin,
  melhor_avaliada: (c) => (c.nota === undefined ? undefined : -c.nota),
};

function ordenarPor(lista: Candidato[], criterio: CriterioComDado): Candidato[] {
  const com = lista.filter((c) => valor[criterio](c) !== undefined);
  return [...com].sort((a, b) => valor[criterio](a)! - valor[criterio](b)! || a.precoCents - b.precoCents);
}

// Rótulo e motivo só de campo real: o critério em que a opção é a melhor da lista elegível.
function rotular(c: Candidato, lista: Candidato[], preferido?: CriterioComDado): OpcaoPlano {
  const ordem = preferido ? [preferido, ...CRITERIOS.filter((x) => x !== preferido)] : CRITERIOS;
  for (const crit of ordem) {
    if (ordenarPor(lista, crit)[0]?.opcao.ref === c.opcao.ref) {
      const motivo = crit === "mais_barata" ? `menor preço com entrega entre as opções (${reais(custoComFrete(c)!)})`
        : crit === "mais_rapida" ? `menor prazo estimado (até ${c.prazoMin} minutos)`
        : `maior nota entre as opções (${c.nota})`;
      return { ...c.opcao, rotulo: crit === "mais_barata" ? "mais barata" : crit === "mais_rapida" ? "mais rápida" : "melhor avaliada", motivo };
    }
  }
  return { ...c.opcao, rotulo: "alternativa", motivo: "outra opção aberta e com entrega" };
}

// Opção pública de volta a candidato (preço, prazo e nota já normalizados na busca que a gerou).
export function candidatoDe(o: OpcaoPlano): Candidato {
  const prazoMin = o.prazo ? Number(o.prazo.match(/\d+/)?.[0]) || undefined : undefined;
  return { opcao: o, precoCents: o.precoCents, prazoMin, nota: o.nota, minimoCents: o.pedidoMinimoCents };
}

interface PlanoGuardado { subjectRef: string; snapshot: PlanoSnapshot; ocasiao: Ocasiao; necessidades: Necessidade[]; candidatos: Map<string, Candidato[]> }
export type PlanosStore = Map<string, PlanoGuardado>;

export class McpDomain implements DomainPort {
  // Candidatos da última busca por necessidade, para montar e ajustar o plano sem nova chamada.
  private readonly ultimaBusca = new Map<string, Candidato[]>();

  constructor(
    private readonly tools: McpTools,
    private readonly local: Localizacao,
    private readonly planos: Map<string, PlanoGuardado> = new Map(),
    private readonly eventos: (subjectRef: string, e: EventoFeedback) => void = () => undefined,
  ) {}

  // Toda ida ao MCP passa por aqui só para medir o tempo (log); não muda o que é enviado nem o resultado.
  private async chamar(nome: string, args: Record<string, unknown>, rel?: RelatorioBusca): Promise<unknown> {
    const t = performance.now();
    try {
      return await comLimite(async () => {
        try { return await this.tools.callTool(nome, args); }
        catch (e) {
          if (!ehInterno(e)) throw e;
          if (rel) rel.retries++;
          console.warn(`[mcp] ${nome} INTERNAL; nova tentativa em ${pausaRetryMs()} ms (o iFood pede para não repetir de imediato)`);
          await new Promise((r) => setTimeout(r, pausaRetryMs()));
          return await this.tools.callTool(nome, args);
        }
      });
    } finally {
      const ms = Math.round(performance.now() - t);
      rel?.ms.push(ms);
      console.info(`[mcp] ${nome} ${ms}ms${typeof args.query === "string" ? ` q="${args.query}"` : ""}`);
    }
  }

  private readonly cacheBusca = new Map<string, { ate: number; resposta: unknown }>();
  private async buscarComCache(args: Record<string, unknown> & { query: string }, rel?: RelatorioBusca): Promise<unknown> {
    const chave = JSON.stringify(args);
    const hit = cacheLigado() ? this.cacheBusca.get(chave) : undefined;
    if (hit && hit.ate > Date.now()) { if (rel) rel.cache++; return hit.resposta; }
    const resposta = await this.chamar("searchOffers", args, rel);
    if (cacheLigado() && extrairItens(resposta).length > 0) {
      this.cacheBusca.set(chave, { ate: Date.now() + TTL_CACHE_MS, resposta });
      if (this.cacheBusca.size > MAX_CACHE) this.cacheBusca.delete(this.cacheBusca.keys().next().value!);
    }
    return resposta;
  }

  async detalharItem(opcao: OpcaoPlano): Promise<OpcaoPlano> {
    // IDs são os da opção elegível no plano, nunca um nome ou ID inventado pelo modelo.
    const [merchantId, itemId, extra] = opcao.ref.split(":");
    try {
      if (extra || !itemId || merchantId !== opcao.lojaId) throw new Error("ITEM_INVALIDO");
      const raw = await this.chamar("getItem", { merchantId, itemId, userLocation: { latitude: this.local.latitude, longitude: this.local.longitude } });
      const detalhe = raw as { merchantId?: unknown; unitPrice?: unknown; promotionalUnitPrice?: unknown; available?: unknown };
      if (!detalhe || detalhe.merchantId !== merchantId || detalhe.available === false || typeof detalhe.unitPrice !== "number") throw new Error("DETALHE_INVALIDO");
      const base = brlToMoney(detalhe.unitPrice).cents;
      const promo = detalhe.promotionalUnitPrice == null ? base : typeof detalhe.promotionalUnitPrice === "number" ? brlToMoney(detalhe.promotionalUnitPrice).cents : NaN;
      if (!Number.isSafeInteger(promo)) throw new Error("PRECO_INVALIDO");
      return { ...opcao, precoCents: Math.min(base, promo), complementos: { status: "verificado", grupos: normalizarComplementos(raw, itemId), selecoes: [] } };
    } catch {
      return { ...opcao, complementos: { status: "indisponivel", grupos: [], selecoes: [] } };
    }
  }

  async buscarNecessidade(n: Necessidade, ocasiao: Ocasiao, relatorio?: RelatorioBusca): Promise<OpcaoPlano[]> {
    const restricoesMcp = n.restricoes.map((r) => RESTRICOES_MCP[norm(r)]).filter(Boolean);
    // O catálogo busca ITEM por termo: o planejador devolve 1 a 3 termos concretos (sinônimos reais), em paralelo.
    const consultas = consultasDe(n);
    if (relatorio) relatorio.consultas += consultas.length;
    const buscas = await Promise.allSettled(consultas.map((query) => this.buscarComCache({
      query,
      userLocation: { latitude: this.local.latitude, longitude: this.local.longitude },
      resultKind: "ITEM",
      merchantType: n.vertical as Vertical,
      pageSize: PAGE_SIZE,
      refinements: { onlyOpen: true, ...(restricoesMcp.length ? { itemRestrictions: restricoesMcp } : {}) },
    }, relatorio)));
    // Falha parcial fica visível (trace e log): uma consulta que caiu parece "sem resultado" e não pode passar em silêncio.
    buscas.forEach((b, i) => { if (b.status === "rejected") { relatorio?.falhas.push(`${consultas[i]}: ${String(b.reason).slice(0, 90)}`); console.warn(`[mcp] consulta "${consultas[i]}" falhou: ${String(b.reason).slice(0, 120)}`); } });
    const respostas = buscas.flatMap((b) => (b.status === "fulfilled" ? [b.value] : []));
    // Só falha se TODAS falharam: uma consulta que cai não derruba a necessidade.
    if (respostas.length === 0) throw (buscas[0] as PromiseRejectedResult).reason;
    const observedAt = new Date().toISOString();
    const unicos = new Map<string, ItemBusca>();
    for (const r of respostas) for (const i of extrairItens(r)) if (!unicos.has(i.itemId)) unicos.set(i.itemId, i);
    const convertidos = [...unicos.values()].map((i) => paraCandidato(i, observedAt)).filter((c): c is NonNullable<typeof c> => !!c);
    void ocasiao; // quantidade é calculada ao montar o plano
    // Restrições com filtro oficial do MCP (ex.: LAC_FREE) vão no refinamento; as demais passam pelo filtro
    // rígido do Kenzo, que exclui item sem composição conhecida. Em ambos os casos o plano pede confirmação.
    // Filtros rígidos do Kenzo: alergia sem composição conhecida exclui; preço não exclui opções.
    const filtro = filterEligibleCandidates(convertidos.map((c) => c.normalizado), {
      allergies: n.restricoes.filter((r) => !RESTRICOES_MCP[norm(r)]),
      missingCompositionPolicy: "exclude-from-safe-claims",
    });
    const porId = new Map(convertidos.map((c) => [c.normalizado.itemId, c]));
    const ordenados = filtro.eligible
      .filter((e) => e.candidate.available !== false)
      .sort((a: CandidateEligibilityResult, b: CandidateEligibilityResult) => compareEligibleCandidates(a, b));
        const elegiveis = ordenados.slice(0, MAX_CANDIDATOS);
    const pool: Candidato[] = elegiveis.map((e) => {
      const c = porId.get(e.candidate.itemId)!;
      const prazo = c.base.prazoMin;
      return {
        precoCents: c.base.precoCents, prazoMin: prazo, nota: c.base.nota, minimoCents: c.base.minimoCents,
        opcao: {
          ref: `${e.candidate.merchantId}:${e.candidate.itemId}`, loja: e.candidate.merchantName, lojaId: e.candidate.merchantId, item: e.candidate.itemName,
          precoCents: c.base.precoCents, ...(e.candidate.deliveryFee !== undefined ? { freteCents: brlToMoney(e.candidate.deliveryFee).cents } : {}),
          ...(prazo ? { prazo: `até ${prazo} minutos` } : {}), ...(c.base.nota !== undefined ? { nota: c.base.nota } : {}),
          rotulo: "", motivo: "", origem: "real",
          ...extrasDoCartao(c.base.item, c.base.precoCents, c.base.minimoCents),
        },
      };
    });
    // Quem julga se a opção serve ao pedido é o atendente, que vê o resultado da busca e escolhe.
    const todos = pool;
    const cobertura = "exata" as "exata" | "proxima";
    // A busca do iFood traz outros sabores junto; o pedido específico fica só com o que bate (sem perder a ordem).
    const candidatos = soOsEspecificos(todos, n.categoria, (c) => c.opcao.item);
    // A primeira continua sendo a do ranking do domínio (custo, depois nota e prazo); o rótulo diz em que ela ganha.
    const opcoes = candidatos.map((c, i) => {
      const o = rotular(c, candidatos, i === 0 ? "mais_barata" : undefined);
      // "Mais parecida" não é "mais barata": o rótulo diz a verdade sobre por que esta opção está aqui.
      return cobertura === "proxima" ? { ...o, rotulo: "mais parecida", motivo: `não encontrei "${n.categoria}"; esta é a opção mais parecida`, cobertura } : o;
    });
    this.ultimaBusca.set(n.id, candidatos.map((c, i) => ({ ...c, opcao: opcoes[i] })));
    return opcoes;
  }

  async montarPlano(input: { subjectRef: string; ocasiao: Ocasiao; itens: { necessidade: Necessidade; opcoes: OpcaoPlano[] }[] }): Promise<PlanoSnapshot> {
    // Necessidade sem busca própria (o atendente já tinha as opções de uma busca anterior): usa as opções recebidas, sem nova ida ao MCP.
    const candidatos = new Map(input.itens.map((it) => [it.necessidade.id, this.ultimaBusca.get(it.necessidade.id) ?? it.opcoes.map(candidatoDe)]));
    const snapshot = construir(randomUUID(), 1, input.ocasiao, input.itens.map((it) => ({ necessidade: it.necessidade, lista: candidatos.get(it.necessidade.id) ?? [] })));
    this.planos.set(snapshot.planoId, { subjectRef: input.subjectRef, snapshot, ocasiao: input.ocasiao, necessidades: input.itens.map((i) => i.necessidade), candidatos });
    if (this.planos.size > 5000) this.planos.delete(this.planos.keys().next().value!);
    return structuredClone(snapshot);
  }

  async ajustarPlano(input: { subjectRef: string; planoId: string; versao: number; categoria?: string; criterio: Criterio }): Promise<PlanoSnapshot> {
    const atual = this.planos.get(input.planoId);
    if (!atual || atual.subjectRef !== input.subjectRef) throw new Error("PLANO_INEXISTENTE");
    if (atual.snapshot.versao !== input.versao) throw new Error("VERSAO_DESATUALIZADA");
    if (input.criterio === "favorita") throw new Error("SEM_DADO_CRITERIO"); // sem escopo de histórico
    const alvo = input.categoria ? norm(input.categoria) : undefined;
    const bloco = atual.snapshot.blocos.find((b) => alvo && (norm(b.categoria).includes(alvo) || alvo.includes(norm(b.categoria)))) ?? atual.snapshot.blocos[0];
    if (!bloco) throw new Error("PLANO_VAZIO");
    const itens = atual.necessidades.map((n) => {
      const lista = atual.candidatos.get(n.id) ?? [];
      if (n.id !== bloco.necessidadeId) return { necessidade: n, lista };
      if (input.criterio === "outra") {
        const i = lista.findIndex((c) => c.opcao.ref === bloco.principal.ref);
        return { necessidade: n, lista: [...lista.slice(i + 1), ...lista.slice(0, i + 1)] };
      }
      const crit = input.criterio as CriterioComDado;
      const ordenada = ordenarPor(lista, crit);
      if (ordenada.length === 0) throw new Error("SEM_DADO_CRITERIO");
      const resto = lista.filter((c) => !ordenada.includes(c));
      const relabel = [...ordenada, ...resto].map((c, i) => ({ ...c, opcao: rotular(c, lista, i === 0 ? crit : undefined) }));
      return { necessidade: n, lista: relabel };
    });
    const mesmas = itens.every((it) => {
      const b = atual.snapshot.blocos.find((x) => x.necessidadeId === it.necessidade.id);
      return !b || b.principal.ref === it.lista[0]?.opcao.ref;
    });
    if (mesmas) return structuredClone(atual.snapshot);
    const snapshot = construir(atual.snapshot.planoId, atual.snapshot.versao + 1, atual.ocasiao, itens);
    this.planos.set(snapshot.planoId, { ...atual, snapshot, candidatos: new Map(itens.map((i) => [i.necessidade.id, i.lista])) });
    return structuredClone(snapshot);
  }

  async registrarEvento(subjectRef: string, evento: EventoFeedback): Promise<void> {
    this.eventos(subjectRef, evento);
  }
}

function construir(planoId: string, versao: number, ocasiao: Ocasiao, itens: { necessidade: Necessidade; lista: Candidato[] }[]): PlanoSnapshot {
  const blocos: BlocoPlano[] = [];
  const naoAtendidas: PlanoSnapshot["naoAtendidas"] = [];
  const pendencias: string[] = [];
  for (const { necessidade: n, lista } of itens) {
    const [principal, ...resto] = lista;
    if (!principal) {
      naoAtendidas.push({ categoria: n.categoria, motivo: n.restricoes.length ? "nenhuma opção aberta com composição confirmada para a restrição" : "nenhuma opção aberta com entrega no iFood agora" });
      continue;
    }
    const quantidade = quantidadePara(n, ocasiao);
    blocos.push({ necessidadeId: n.id, vertical: n.vertical, categoria: n.categoria, quantidade, principal: principal.opcao, alternativas: resto.slice(0, 2).map((c) => c.opcao), ...(n.fonte === "inferido" ? { sugestao: true } : {}), ...(principal.opcao.cobertura ? { cobertura: principal.opcao.cobertura } : {}) });
    if (principal.minimoCents && principal.precoCents * quantidade < principal.minimoCents) {
      pendencias.push(`${principal.opcao.loja} tem pedido mínimo de ${reais(principal.minimoCents)}`);
    }
    if (quantidade > 1) pendencias.push(`Quantidade de ${n.categoria} estimada para ${ocasiao.pessoas ?? 1} pessoas`);
    if (n.restricoes.length > 0) pendencias.push(`Confirme a composição de ${principal.opcao.item} com a loja (restrição: ${n.restricoes.join(", ")})`);
  }
  pendencias.push("Opções do item (sabor, tamanho, complementos), taxas e total são confirmados no iFood");
  return { planoId, versao, blocos, naoAtendidas, pendencias, origem: "real" };
}
