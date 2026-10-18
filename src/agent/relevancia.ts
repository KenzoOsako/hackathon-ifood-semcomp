// Relevância: o que a busca devolveu serve para o que a pessoa pediu? Mecanismo GERAL, sem lista de casos: nada aqui
// sabe o que é "churrasco" ou "bolo". Duas camadas:
//  1) léxica, determinística e de graça: confere se as palavras do pedido aparecem no nome do item;
//  2) juiz (o próprio LLM, em uma chamada curta e estruturada) para o que o texto sozinho não resolve
//     (pedido de uma palavra só, sinônimo, categoria que o catálogo nomeia diferente).
// Se o juiz falhar ou demorar, vale a camada léxica e a conversa segue. Sem veredito "serve", o agente diz que não achou.
import { MAX_CANDIDATOS_JUIZ, TIMEOUT_JUIZ_MS } from "./limites";
import { contar } from "./telemetria";
import type { CandidatoJulgado, LlmPort, Necessidade, RelevancePort, Veredito } from "./types";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Palavras que não distinguem um item de outro (quantidade, tamanho, ligação) ou que só descrevem o tipo do pedido.
const IGNORAR = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "para", "por", "uma", "uns", "umas", "the", "ingrediente", "ingredientes",
  "produto", "produtos", "item", "itens", "grande", "grandes", "media", "medio", "pequena", "pequeno", "familia", "extra",
  "tradicional", "kit", "pacote", "caixa", "unidade", "unidades",
]);

// Plural simples ("ovos"→"ovo", "paes"→"pao", "limoes"→"limao"), para a comparação não depender dele.
function raiz(w: string): string {
  if (w.length > 4 && w.endsWith("oes")) return `${w.slice(0, -3)}ao`;
  if (w.length >= 4 && w.endsWith("aes")) return `${w.slice(0, -3)}ao`; // "paes" → "pao"
  if (w.length > 4 && w.endsWith("ais")) return `${w.slice(0, -3)}al`;
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

export function palavras(texto: string): string[] {
  return norm(texto).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !IGNORAR.has(w) && !/^\d+$/.test(w)).map(raiz);
}

const bate = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));

// Palavras que o pedido exige: a categoria e as consultas do planejador (se houver).
export function palavrasDoPedido(n: Pick<Necessidade, "categoria" | "consultas">): string[] {
  return [...new Set(palavras([n.categoria, ...(n.consultas ?? [])].join(" ")))];
}

// Veredito só pelo texto. "serve" = todas as palavras do pedido aparecem no item; "proximo" = parte delas (mesmo tipo de
// coisa, outra variação); "nao_serve" = nenhuma. Pedido com consultas alternativas basta casar com UMA consulta inteira.
// Combo/kit: um item que reúne vários produtos ("Pizza A + Pizza B + Refri") não é o produto pedido sozinho, e o preço
// é de todos eles. Só serve a quem pediu combo ou kit.
const COMBO = /\s\+\s|\b(combo|kit|promocao)\b/;
export const ehCombo = (item: string) => COMBO.test(norm(item));

export function vereditoLexico(n: Pick<Necessidade, "categoria" | "consultas">, item: string): Veredito {
  const pediuCombo = [n.categoria, ...(n.consultas ?? [])].some((t) => ehCombo(t) || /combo|kit/.test(norm(t)));
  if (ehCombo(item) && !pediuCombo) return vereditoLexicoSimples(n, item) === "nao_serve" ? "nao_serve" : "proximo";
  return vereditoLexicoSimples(n, item);
}

function vereditoLexicoSimples(n: Pick<Necessidade, "categoria" | "consultas">, item: string): Veredito {
  const doItem = palavras(item);
  const casa = (pedido: string[]) => pedido.filter((p) => doItem.some((i) => bate(p, i))).length;
  const alternativas = [n.categoria, ...(n.consultas ?? [])].map(palavras).filter((p) => p.length > 0);
  if (alternativas.length === 0) return "serve"; // pedido sem palavra distintiva: nada a filtrar
  let melhor = 0;
  for (const alt of alternativas) {
    const c = casa(alt);
    if (c === alt.length) return "serve";
    melhor = Math.max(melhor, alt.length >= 2 ? c / alt.length : 0);
  }
  return melhor >= 0.5 ? "proximo" : "nao_serve";
}

export function julgarLexico(n: Necessidade, candidatos: CandidatoJulgado[]): Map<string, Veredito> {
  return new Map(candidatos.map((c) => [c.ref, vereditoLexico(n, c.item)]));
}

async function comLimite<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); } finally { clearTimeout(timer); }
}

// Pedido específico (2+ palavras distintivas) com ao menos um item que casa tudo: o texto já resolve e o juiz não é chamado.
function textoBasta(n: Necessidade, lexico: Map<string, Veredito>): boolean {
  const alvo = Math.max(...[n.categoria, ...(n.consultas ?? [])].map((t) => palavras(t).length));
  return alvo >= 2 && [...lexico.values()].includes("serve");
}

// Sem juiz (modo de reserva por regras) o texto sozinho NÃO filtra: categoria genérica ("presente", "sobremesa") quase
// nunca aparece no nome do item, e rejeitar tudo seria pior que não filtrar.
const semFiltro = (candidatos: CandidatoJulgado[]): Map<string, Veredito> => new Map(candidatos.map((c) => [c.ref, "serve"]));

// Juiz indisponível (erro, timeout): o texto vale se achou alguma coisa; se não achou nada, não dá para saber, e o
// jeito honesto é tratar tudo como "mais parecido" (o Guide avisa) em vez de afirmar que é o pedido.
function aposFalhaDoJuiz(lexico: Map<string, Veredito>): Map<string, Veredito> {
  const algum = [...lexico.values()].some((v) => v !== "nao_serve");
  return algum ? lexico : new Map([...lexico.keys()].map((ref) => [ref, "proximo" as Veredito]));
}

export function criarRelevancia(llm: Pick<LlmPort, "julgar">, opts: { timeoutMs?: number } = {}): RelevancePort {
  return {
    async julgar(n, candidatos) {
      if (!llm.julgar) return semFiltro(candidatos);
      const lista = candidatos.slice(0, MAX_CANDIDATOS_JUIZ);
      const lexico = julgarLexico(n, candidatos);
      if (lista.length === 0 || textoBasta(n, lexico)) return lexico;
      try {
        const dito = await comLimite(opts.timeoutMs ?? TIMEOUT_JUIZ_MS, (signal) => llm.julgar!({ necessidade: n, candidatos: lista }, signal));
        // O que o juiz não comentou (ou comentou fora do formato) cai no veredito léxico.
        return new Map(candidatos.map((c) => [c.ref, dito[c.ref] ?? lexico.get(c.ref)!]));
      } catch {
        contar("juiz:falhou");
        return aposFalhaDoJuiz(lexico);
      }
    },
  };
}
