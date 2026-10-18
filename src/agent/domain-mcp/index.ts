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
import { vereditoLexico } from "../relevancia";
import type { BlocoPlano, ContextoBusca, Criterio, DomainPort, EventoFeedback, Necessidade, Ocasiao, OpcaoPlano, PlanoSnapshot, Vertical } from "../types";

// Porta mínima para o cliente MCP: o domínio não conhece transporte nem token.
export interface McpTools { callTool(name: string, args: Record<string, unknown>): Promise<unknown> }
export interface Localizacao { latitude: number; longitude: number; fonte: "endereco" | "fixa" }

const MAX_CANDIDATOS = 10;
// Candidatos que entram na avaliação de relevância (antes de cortar pelo ranking de preço, que sozinho põe lixo barato na frente).
const MAX_POOL = 40;
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

// Frente da lista: tira do topo o que custa menos que um terço da mediana (suspeito de ser parcial) e ordena por nota e custo.
export function escolhaEquilibrada(lista: Candidato[]): Candidato[] {
  if (lista.length < 3) return lista;
  const precos = lista.map((c) => c.precoCents).sort((a, b) => a - b);
  const mediana = precos[Math.floor(precos.length / 2)];
  const suspeito = (c: Candidato) => c.precoCents < mediana / 3;
  const nota = (c: Candidato) => Math.round((c.nota ?? 0) * 10);
  const custo = (c: Candidato) => c.precoCents + (c.opcao.freteCents ?? 0);
  const ordenar = (l: Candidato[]) => [...l].sort((a, b) => nota(b) - nota(a) || custo(a) - custo(b));
  return [...ordenar(lista.filter((c) => !suspeito(c))), ...ordenar(lista.filter(suspeito))];
}

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

const VAZIAS = new Map<string, Map<Vertical, { n: number; em: number }>>();
const TTL_VAZIA_MS = 10 * 60_000;

// Onde procurar quando a vertical escolhida não tem catálogo aqui.
const ALTERNATIVA: Partial<Record<Vertical, Vertical>> = { GROCERIES: "RESTAURANT", RESTAURANT: "GROCERIES" };

interface PlanoGuardado { subjectRef: string; snapshot: PlanoSnapshot; ocasiao: Ocasiao; necessidades: Necessidade[]; candidatos: Map<string, Candidato[]> }
export type PlanosStore = Map<string, PlanoGuardado>;

export class McpDomain implements DomainPort {
  // Candidatos da última busca por necessidade, para montar e ajustar o plano sem nova chamada.
  private readonly ultimaBusca = new Map<string, Candidato[]>();
  // Verticais sem NENHUM item devolvido neste local. É aprendido por observação e vale 10 minutos (catálogo muda com a hora:
  // mercado sem entrega de madrugada não é mercado inexistente). Só conta quando a busca volta sem item algum.
  private vazias(): Map<Vertical, { n: number; em: number }> {
    const chave = `${this.local.latitude.toFixed(2)},${this.local.longitude.toFixed(2)}`;
    let m = VAZIAS.get(chave); if (!m) { m = new Map(); VAZIAS.set(chave, m); }
    return m;
  }
  private contagemVazia(tipo: Vertical): number {
    const v = this.vazias().get(tipo);
    return v && Date.now() - v.em < TTL_VAZIA_MS ? v.n : 0;
  }
  private marcarVazia(tipo: Vertical, vazio: boolean): void {
    this.vazias().set(tipo, { n: vazio ? this.contagemVazia(tipo) + 1 : 0, em: Date.now() });
  }

  // Verticais sem catálogo agora (o planejador não deve montar pedido por elas).
  semCatalogo(): string[] { return (["GROCERIES", "RESTAURANT", "SHOPPING"] as Vertical[]).filter((v) => this.contagemVazia(v) >= 2); }

  // Por que uma necessidade ficou sem opção ("há itens, mas nada aberto com entrega agora" é diferente de "não existe").
  private readonly semResultado = new Map<string, string>();

  constructor(
    private readonly tools: McpTools,
    private readonly local: Localizacao,
    private readonly planos: Map<string, PlanoGuardado> = new Map(),
    private readonly eventos: (subjectRef: string, e: EventoFeedback) => void = () => undefined,
  ) {}

  async buscarNecessidade(n: Necessidade, ocasiao: Ocasiao, ctx?: ContextoBusca): Promise<OpcaoPlano[]> {
    const restricoesMcp = n.restricoes.map((r) => RESTRICOES_MCP[norm(r)]).filter(Boolean);
    // O catálogo busca ITEM por termo: o planejador devolve 1 a 3 termos concretos (sinônimos reais), em paralelo.
    const consultas = consultasDe(n);
    const buscarEm = async (tipo: Vertical) => {
      const buscas = await Promise.allSettled(consultas.map((query) => this.tools.callTool("searchOffers", {
        query,
        userLocation: { latitude: this.local.latitude, longitude: this.local.longitude },
        resultKind: "ITEM",
        merchantType: tipo,
        pageSize: PAGE_SIZE,
        refinements: { onlyOpen: true, ...(restricoesMcp.length ? { itemRestrictions: restricoesMcp } : {}) },
      })));
      const respostas = buscas.flatMap((b) => (b.status === "fulfilled" ? [b.value] : []));
      // Só falha se TODAS falharam: uma consulta que cai não derruba a necessidade.
      if (respostas.length === 0) throw (buscas[0] as PromiseRejectedResult).reason;
      const unicos = new Map<string, ItemBusca>();
      for (const r of respostas) for (const i of extrairItens(r)) if (!unicos.has(i.itemId)) unicos.set(i.itemId, i);
      return { respostas, unicos };
    };
    // A vertical que o modelo escolheu é um palpite: se o catálogo dela está vazio aqui (conta/região sem mercado, por
    // exemplo), busca onde há catálogo, e lembra disso para não gastar chamadas à toa nos próximos pedidos.
    const alternativa = ALTERNATIVA[n.vertical as Vertical];
    let tipo = n.vertical as Vertical;
    const pular = alternativa !== undefined && this.contagemVazia(tipo) >= 2;
    let { respostas, unicos } = pular && alternativa ? await buscarEm(alternativa) : await buscarEm(tipo);
    if (pular && alternativa) tipo = alternativa;
    else if (unicos.size === 0 && alternativa) {
      this.marcarVazia(tipo, true);
      const outra = await buscarEm(alternativa).catch(() => undefined);
      if (outra && outra.unicos.size > 0) { ({ respostas, unicos } = outra); tipo = alternativa; }
    } else if (unicos.size > 0) this.marcarVazia(tipo, false);
    const observedAt = new Date().toISOString();
    const abertos = [...unicos.values()].filter((i) => i.merchant.isOpen === true).length;
    const comEntrega = [...unicos.values()].filter((i) => i.merchant.isOpen === true && !!i.merchant.deliveryMethod).length;
    const convertidos = [...unicos.values()].map((i) => paraCandidato(i, observedAt)).filter((c): c is NonNullable<typeof c> => !!c);
    void ocasiao; // quantidade é calculada ao montar o plano
    // Restrições com filtro oficial do MCP (ex.: LAC_FREE) vão no refinamento; as demais passam pelo filtro
    // rígido do Kenzo, que exclui item sem composição conhecida. Em ambos os casos o plano pede confirmação.
    // Filtros rígidos do Kenzo: alergia sem composição conhecida exclui; teto rígido sobre o total.
    const filtro = filterEligibleCandidates(convertidos.map((c) => c.normalizado), {
      allergies: n.restricoes.filter((r) => !RESTRICOES_MCP[norm(r)]),
      missingCompositionPolicy: "exclude-from-safe-claims",
    }, n.orcamento?.tipo === "teto" ? { hardBudgetLimit: brlToMoney(n.orcamento.max) } : n.orcamento ? { flexibleBudgetLimit: brlToMoney(n.orcamento.max) } : undefined);
    const porId = new Map(convertidos.map((c) => [c.normalizado.itemId, c]));
    const ordenados = filtro.eligible
      .filter((e) => e.candidate.available !== false)
      .sort((a: CandidateEligibilityResult, b: CandidateEligibilityResult) => compareEligibleCandidates(a, b));
    // Sem juiz, vale o corte de sempre. Com juiz, o pool é maior: o ranking por preço sozinho põe o item errado e barato na frente.
    const elegiveis = ordenados.slice(0, ctx?.relevancia ? MAX_POOL : MAX_CANDIDATOS);
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
    // Relevância (mecanismo geral, sem lista de casos): só entra o que SERVE ao pedido. Sem nenhum, o mais parecido
    // entra marcado como "proxima" (o Guide avisa); sugestão do próprio Guide nunca vira "mais parecida".
    let todos = pool;
    let cobertura: "exata" | "proxima" = "exata";
    if (ctx?.relevancia && pool.length > 0) {
      // Os de texto mais próximo do pedido vão primeiro: o juiz avalia poucos itens e o ranking por preço não os esconde.
      const ordem = (c: Candidato) => ({ serve: 0, avulso: 1, proximo: 2, nao_serve: 3 })[vereditoLexico(n, c.opcao.item)];
      const paraJuiz = pool.map((c, i) => ({ c, i })).sort((a, b) => ordem(a.c) - ordem(b.c) || a.i - b.i).map((x) => x.c);
      const veredito = await ctx.relevancia.julgar(n, paraJuiz.map((c) => ({ ref: c.opcao.ref, item: c.opcao.item, loja: c.opcao.loja })));
      const serveInteiro = pool.filter((c) => veredito.get(c.opcao.ref) === "serve");
      const avulso = pool.filter((c) => veredito.get(c.opcao.ref) === "avulso");
      // O item completo vence; o avulso (fatia, mini) só aparece se não houver nenhum completo.
      const serve = serveInteiro.length > 0 ? serveInteiro : avulso;
      const proximo = pool.filter((c) => veredito.get(c.opcao.ref) === "proximo");
      if (serve.length > 0) todos = serve;
      else if (proximo.length > 0 && n.fonte !== "inferido") { todos = proximo; cobertura = "proxima"; }
      else todos = [];
      todos = todos.slice(0, MAX_CANDIDATOS);
      console.info(`[busca] ${n.vertical} "${n.categoria}" consultas=${consultas.length} respostas=${respostas.length} itens=${unicos.size} abertos=${abertos} comEntrega=${comEntrega} elegiveis=${pool.length} serve=${serve.length} proximo=${proximo.length} fonte=${n.fonte ?? "dito"}`);
    } else {
      console.info(`[busca] ${n.vertical} "${n.categoria}" consultas=${consultas.length} respostas=${respostas.length} itens=${unicos.size} abertos=${abertos} comEntrega=${comEntrega} elegiveis=${pool.length} (sem juiz)`);
    }
    // A busca do iFood traz outros sabores junto; o pedido específico fica só com o que bate (sem perder a ordem).
    const candidatos = soOsEspecificos(todos, n.categoria, (c) => c.opcao.item);
    // A primeira é a mais recomendável, não a mais barata: preço muito abaixo do padrão da lista costuma ser item parcial
    // ou de outra coisa (o "mais barato" sozinho é o que faz o agente errar), então fica fora da frente; depois, nota e custo.
    const ordem2 = escolhaEquilibrada(candidatos);
    const opcoes = ordem2.map((c, i) => {
      const o = rotular(c, ordem2, i === 0 ? (c.nota !== undefined ? "melhor_avaliada" : "mais_barata") : undefined);
      // "Mais parecida" não é "mais barata": o rótulo diz a verdade sobre por que esta opção está aqui.
      return cobertura === "proxima" ? { ...o, rotulo: "mais parecida", motivo: `não encontrei "${n.categoria}"; esta é a opção mais parecida`, cobertura } : o;
    });
    this.ultimaBusca.set(n.id, candidatos.map((c, i) => ({ ...c, opcao: opcoes[i] })));
    // Sem opção: diz POR QUÊ. Há itens, mas nada aberto com entrega agora (ex.: mercado de madrugada) não é "não existe".
    if (opcoes.length === 0) this.semResultado.set(n.id, unicos.size > 0 && pool.length === 0 ? "fora_de_horario" : "nao_encontrado"); else this.semResultado.delete(n.id);
    return opcoes;
  }

  async montarPlano(input: { subjectRef: string; ocasiao: Ocasiao; itens: { necessidade: Necessidade; opcoes: OpcaoPlano[] }[] }): Promise<PlanoSnapshot> {
    const candidatos = new Map(input.itens.map((it) => [it.necessidade.id, this.ultimaBusca.get(it.necessidade.id) ?? []]));
    const snapshot = construir(randomUUID(), 1, input.ocasiao, input.itens.map((it) => ({ necessidade: it.necessidade, lista: candidatos.get(it.necessidade.id) ?? [] })), this.semResultado);
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

function construir(planoId: string, versao: number, ocasiao: Ocasiao, itens: { necessidade: Necessidade; lista: Candidato[] }[], motivos: Map<string, string> = new Map()): PlanoSnapshot {
  const blocos: BlocoPlano[] = [];
  const naoAtendidas: PlanoSnapshot["naoAtendidas"] = [];
  const pendencias: string[] = [];
  for (const { necessidade: n, lista } of itens) {
    const [principal, ...resto] = lista;
    if (!principal) {
      // Sugestão do próprio Guide que não achou nada some em silêncio: a pessoa não pediu, então "não tenho" só gera ruído.
      if (n.fonte === "inferido") continue;
      naoAtendidas.push({ categoria: n.categoria, motivo: n.restricoes.length ? "nenhuma opção aberta com composição confirmada para a restrição" : motivos.get(n.id) === "fora_de_horario" ? "existe no iFood, mas nenhuma loja está aberta com entrega agora" : "não encontrei no iFood perto de você" });
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
