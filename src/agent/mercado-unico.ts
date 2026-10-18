// Itens de mercado de um plano saem de um mercado só: o iFood fecha um carrinho por loja, e uma receita espalhada em
// três mercados vira três pedidos e três fretes. O que o mercado escolhido não tem não é puxado de outro sozinho:
// fica como falta, e a pessoa decide (outro item do mesmo mercado ou outra loja, que vira outro pedido).
import { chaveLoja } from "./sacola";
import type { BlocoPlano, OpcaoPlano, PlanoSnapshot } from "./types";

export type BuscarNaLoja = (bloco: BlocoPlano, lojaId: string) => Promise<OpcaoPlano[]>;
export interface FaltaMercado { categoria: string; loja: string; foraDaLoja: OpcaoPlano[] }

const MAX_ALTERNATIVAS = 3;
// Mercados testados de verdade (com busca dentro da loja): os dois que mais cobrem, para não multiplicar chamadas.
const CANDIDATOS = 2;
const reais = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

// Mercados que aparecem nas listas: quem cobre mais itens; empate pelo menor total com um frete só, depois pela nota.
export function rankingMercados(listas: OpcaoPlano[][]): { lojaId: string; cobre: number; totalCents: number }[] {
  const lojas = new Map<string, { cobre: number; itensCents: number; freteCents: number; nota: number }>();
  for (const lista of listas) {
    const maisBarata = new Map<string, OpcaoPlano>();
    for (const o of lista) { const id = chaveLoja(o); const atual = maisBarata.get(id); if (!atual || o.precoCents < atual.precoCents) maisBarata.set(id, o); }
    for (const [id, o] of maisBarata) {
      const l = lojas.get(id) ?? { cobre: 0, itensCents: 0, freteCents: o.freteCents ?? 0, nota: o.nota ?? 0 };
      l.cobre += 1; l.itensCents += o.precoCents;
      lojas.set(id, l);
    }
  }
  return [...lojas.entries()]
    .map(([lojaId, l]) => ({ lojaId, cobre: l.cobre, totalCents: l.itensCents + l.freteCents, nota: l.nota }))
    .sort((a, b) => b.cobre - a.cobre || a.totalCents - b.totalCents || b.nota - a.nota || a.lojaId.localeCompare(b.lojaId))
    .map(({ lojaId, cobre, totalCents }) => ({ lojaId, cobre, totalCents }));
}

const unicas = (lista: OpcaoPlano[]) => [...new Map(lista.map((o) => [o.ref, o])).values()];

// opcoesDe: tudo o que a busca do item trouxe (não só as 2 alternativas do bloco). fixos: itens cuja opção a pessoa
// escolheu (ref), que nunca são trocados; o mercado deles é o preferido.
export async function unificarMercado(
  plano: PlanoSnapshot,
  opcoesDe: (necessidadeId: string) => OpcaoPlano[],
  fixos: ReadonlySet<string>,
  buscarNaLoja?: BuscarNaLoja,
): Promise<{ plano: PlanoSnapshot; faltas: FaltaMercado[] }> {
  const mercado = plano.blocos.filter((b) => b.vertical === "GROCERIES");
  const livres = mercado.filter((b) => !fixos.has(b.necessidadeId));
  if (mercado.length < 2 || livres.length === 0) return { plano, faltas: [] };
  const poolDe = (b: BlocoPlano) => unicas([b.principal, ...b.alternativas, ...opcoesDe(b.necessidadeId)]);

  const lojasFixas = rankingMercados(mercado.filter((b) => fixos.has(b.necessidadeId)).map((b) => [b.principal]));
  const candidatos = lojasFixas.length ? [lojasFixas[0].lojaId] : rankingMercados(mercado.map(poolDe)).slice(0, CANDIDATOS).map((r) => r.lojaId);

  // Para cada candidato: o que ele tem de cada item livre, buscando dentro da loja o que a busca geral não trouxe.
  const avaliados = await Promise.all(candidatos.map(async (lojaId) => {
    const porBloco = await Promise.all(livres.map(async (b) => {
      const naLista = poolDe(b).filter((o) => chaveLoja(o) === lojaId);
      if (naLista.length || !buscarNaLoja) return naLista;
      try { return (await buscarNaLoja(b, lojaId)).filter((o) => chaveLoja(o) === lojaId); } catch { return []; }
    }));
    const ordenadas = porBloco.map((l) => [...l].sort((x, y) => x.precoCents - y.precoCents));
    return { lojaId, porBloco: ordenadas, cobre: ordenadas.filter((l) => l.length).length, totalCents: ordenadas.reduce((s, l) => s + (l[0]?.precoCents ?? 0), 0) };
  }));
  const ancora = avaliados.sort((a, b) => b.cobre - a.cobre || a.totalCents - b.totalCents)[0];
  if (!ancora || ancora.cobre === 0) return { plano, faltas: [] };

  const nomeAncora = ancora.porBloco.find((l) => l.length)![0].loja;
  const faltas: FaltaMercado[] = [];
  const trocados = new Map<string, BlocoPlano | undefined>();
  livres.forEach((b, i) => {
    const daLoja = ancora.porBloco[i];
    if (!daLoja.length) {
      faltas.push({ categoria: b.categoria, loja: nomeAncora, foraDaLoja: [b.principal, ...b.alternativas].slice(0, MAX_ALTERNATIVAS) });
      trocados.set(b.necessidadeId, undefined);
      return;
    }
    const [principal, ...resto] = daLoja;
    // Alternativas: primeiro do mesmo mercado (mantém um pedido só), depois as de outras lojas.
    const alternativas = unicas([...resto, b.principal, ...b.alternativas]).filter((o) => o.ref !== principal.ref).slice(0, MAX_ALTERNATIVAS);
    trocados.set(b.necessidadeId, { ...b, principal, alternativas });
  });

  const blocos = plano.blocos.flatMap((b) => (trocados.has(b.necessidadeId) ? (trocados.get(b.necessidadeId) ? [trocados.get(b.necessidadeId)!] : []) : [b]));
  const naoAtendidas = [...plano.naoAtendidas, ...faltas.map((f) => ({ categoria: f.categoria, motivo: `${f.loja} não tem; dá para trocar por outro item de lá ou trazer de outra loja, que vira outro pedido` }))];
  return { plano: { ...plano, blocos, naoAtendidas, pendencias: pendenciasDeMinimo(blocos, plano.pendencias) }, faltas };
}

// Pedido mínimo é por loja (soma do que vai para ela), não por item: recalculado depois de mudar as lojas.
export function pendenciasDeMinimo(blocos: BlocoPlano[], pendencias: string[]): string[] {
  const lojas = new Map<string, { loja: string; minimo: number; soma: number }>();
  for (const b of blocos) {
    const o = b.principal;
    if (!o.pedidoMinimoCents) continue;
    const l = lojas.get(chaveLoja(o)) ?? { loja: o.loja, minimo: o.pedidoMinimoCents, soma: 0 };
    l.soma += o.precoCents * b.quantidade;
    lojas.set(chaveLoja(o), l);
  }
  const minimos = [...lojas.values()].filter((l) => l.soma < l.minimo).map((l) => `${l.loja} tem pedido mínimo de ${reais(l.minimo)}`);
  return [...minimos, ...pendencias.filter((p) => !/tem pedido mínimo de/.test(p))];
}
