// Sinais de demanda: o que as conversas ensinam ao iFood, sem guardar a conversa.
// Só entra o que o CÓDIGO já tem estruturado quando uma ferramenta roda (categoria, vertical, restrições, quantos
// resultados o catálogo devolveu). Nada de texto livre, transcrição, nome, endereço ou ID: cada sinal é solto,
// Valores publicados pertencem a um vocabulário fechado. A rota só registra com consentimento explícito.
import { temDadoPessoal } from "@/agent/privacidade";
import type { Vertical } from "@/agent/types";

export type Sinal =
  | { tipo: "busca"; vertical: Vertical; categoria: string; restricoes: string[]; resultados: number }
  | { tipo: "plano"; ocasiao?: string; pessoas?: number; categorias: string[]; naoAtendidas: string[] }
  | { tipo: "aprovado"; itens: number };

type Guardado = Sinal & { dia: string };

const LIMITE = 5000;
const g = globalThis as unknown as { __mimoSinaisV2?: Guardado[] };
const sinais = (g.__mimoSinaisV2 ??= []);

const CATEGORIAS = ["pizza", "hamburguer", "lanche", "sushi", "temaki", "comida árabe", "comida japonesa", "comida italiana", "comida brasileira", "carne", "picanha", "linguiça", "carvão", "pipoca", "refrigerante", "suco", "água", "leite", "café", "bolo", "doce", "sorvete", "açaí", "salada", "sopa", "canja", "arroz", "feijão", "macarrão", "pão", "queijo", "fruta", "legumes", "vegetariano", "presente", "flores", "chocolate", "livro", "fone", "panela", "copos", "outros"];
const RESTRICOES = ["lactose", "gluten", "amendoim", "leite", "ovo", "ovos", "castanha", "acucar", "camarão", "frutos do mar", "vegetariano", "vegano"];
const OCASIOES = ["aniversário", "churrasco", "jantar", "jantar a dois", "almoço", "café da manhã", "lanche", "festa", "filme", "reunião", "presente", "outros"];
const chave = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

// Termo curto e minúsculo; qualquer coisa que pareça dado pessoal é descartada inteira, não mascarada.
function termo(t: string | undefined, permitidos = CATEGORIAS): string | undefined {
  if (!t || temDadoPessoal(t) || /\d{4,}/.test(t)) return undefined;
  return permitidos.find(v => chave(v) === chave(t)) ?? "outros";
}
const termos = (lista: string[], permitidos = CATEGORIAS) => [...new Set(lista.map(t => termo(t, permitidos)).filter((t): t is string => Boolean(t)))].slice(0, 8);

function limpar(s: Sinal): Sinal | undefined {
  if (s.tipo === "busca") {
    const categoria = termo(s.categoria);
    return categoria ? { tipo: "busca", vertical: s.vertical, categoria, restricoes: termos(s.restricoes, RESTRICOES), resultados: Math.max(0, Math.trunc(s.resultados)) } : undefined;
  }
  if (s.tipo === "plano") {
    const ocasiao = termo(s.ocasiao, OCASIOES);
    // Faixa, não número exato: o tamanho do grupo é o que importa para o negócio.
    const pessoas = s.pessoas === undefined ? undefined : Math.min(s.pessoas, 10);
    return { tipo: "plano", ...(ocasiao ? { ocasiao } : {}), ...(pessoas ? { pessoas } : {}), categorias: termos(s.categorias), naoAtendidas: termos(s.naoAtendidas) };
  }
  return { tipo: "aprovado", itens: Math.max(0, Math.trunc(s.itens)) };
}

// Nunca derruba o turno: sinal é bônus, a conversa é o produto.
export function registrarSinal(s: Sinal, agora = new Date()): void {
  try {
    const limpo = limpar(s);
    if (!limpo) return;
    sinais.push({ ...limpo, dia: agora.toISOString().slice(0, 10) });
    if (sinais.length > LIMITE) sinais.splice(0, sinais.length - LIMITE);
  } catch { /* descarta */ }
}

export function limparSinais(): void { sinais.length = 0; }

export type Contagem = { nome: string; total: number };
export interface Agregados {
  buscas: number;
  planos: number;
  aprovados: number;
  semOferta: Contagem[];       // pedido que o catálogo não atendeu: o sinal mais valioso para o iFood
  maisBuscadas: Contagem[];
  restricoes: Contagem[];
  ocasioes: Contagem[];
  combinacoes: Contagem[];     // itens que aparecem juntos no mesmo plano
}

const MINIMO = 1; // em produção seria um piso de anonimato (ex.: 5); na demo, 1 para o painel não ficar vazio
function ranking(nomes: string[], max = 6): Contagem[] {
  const c = new Map<string, number>();
  for (const n of nomes) c.set(n, (c.get(n) ?? 0) + 1);
  return [...c].filter(([, t]) => t >= MINIMO).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([nome, total]) => ({ nome, total }));
}

export function agregarSinais(lista: readonly Sinal[] = sinais): Agregados {
  const seguros = lista.map(limpar).filter((s): s is Sinal => s !== undefined);
  const buscas = seguros.filter((s) => s.tipo === "busca");
  const planos = seguros.filter((s) => s.tipo === "plano");
  return {
    buscas: buscas.length,
    planos: planos.length,
    aprovados: seguros.filter((s) => s.tipo === "aprovado").length,
    semOferta: ranking([...buscas.filter((b) => b.resultados === 0).map((b) => b.categoria), ...planos.flatMap((p) => p.naoAtendidas)]),
    maisBuscadas: ranking(buscas.map((b) => b.categoria)),
    restricoes: ranking(buscas.flatMap((b) => b.restricoes)),
    ocasioes: ranking(planos.flatMap((p) => (p.ocasiao ? [p.ocasiao] : []))),
    combinacoes: ranking(planos.filter((p) => p.categorias.length > 1).map((p) => [...p.categorias].sort((a, b) => a.localeCompare(b)).join(" + "))),
  };
}
