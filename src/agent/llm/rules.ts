// Interpretador por regras: modo degradado sem chave de LLM e linha de base dos evals.
// Cobre o roteiro da demo; não tenta entender linguagem livre.
import { respostaTemplate } from "@/prompts/responder";
import type { Criterio, InterpretarInput, LlmPort, Necessidade, Nivel, Ocasiao, ResponderInput, TurnoInterpretado } from "../types";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NUMEROS: Record<string, number> = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12, quinze: 15, vinte: 20 };

function categoriaPizza(t: string): string {
  if (/calabresa/.test(t)) return "pizza calabresa";
  if (/margherita|marguerita/.test(t)) return "pizza margherita";
  return "pizza";
}

const CATALOGO: { re: RegExp; vertical: Necessidade["vertical"]; categoria: (t: string) => string }[] = [
  { re: /pizza/, vertical: "RESTAURANT", categoria: categoriaPizza },
  { re: /hamburguer|burger|lanche|smash/, vertical: "RESTAURANT", categoria: () => "hamburguer" },
  { re: /pipoca|filme/, vertical: "GROCERIES", categoria: () => "pipoca" },
  { re: /refrigerante|refri\b/, vertical: "GROCERIES", categoria: () => "refrigerante" },
  { re: /copo/, vertical: "GROCERIES", categoria: () => "copos" },
  { re: /presente|aniversario/, vertical: "SHOPPING", categoria: () => "presente" },
];

export const PRESSA = /tanto faz|qualquer (um|uma)|pede logo|pode escolher|escolhe (voce|vc|ai)|so faz|faz isso logo|rapidinho|to com pressa|sem pergunta/;
const RE_FORA_ESCOPO = /cerveja|vinho|vodka|alcool|remedio|dipirona|medic|farmacia/;
const RE_APROVAR = /(aprovo|confirmo) o plano/;
const RE_SAUDACAO = /o que voce faz|quem e voce|^(oi|ola|bom dia|boa tarde|boa noite)\b/;
const RE_ORCAMENTO = /(?:ate|no maximo|maximo)\s*(?:r\$?\s*)?(\d+)/;
const RE_CONCORDANCIA = /^(sim|pode|isso|fechou|fechado|ok|beleza|monta|pode montar|faz)\b/;
const RE_ESPECIFICO = /calabresa|margherita|x-burger|smash|classico/;
const RE_PESSOAS_EXPLICITO = /\b(\d+|[a-z]+)\s+(?:pessoas|amigos|convidados)\b/;
const RESTRICOES_CONHECIDAS = ["lactose", "amendoim", "gluten", "camarao"];

export class RuleBasedLlm implements LlmPort {
  readonly nome = "regras";

  interpretar(input: InterpretarInput): Promise<TurnoInterpretado> {
    return Promise.resolve(interpretarPorRegras(input));
  }

  responder(input: ResponderInput): Promise<string> {
    return Promise.resolve(respostaTemplate(input));
  }
}

function interpretarPorRegras(input: InterpretarInput): TurnoInterpretado {
  const t = norm(input.texto);
  const s = input.session;
  const base = { ocasiao: { ...s.ocasiao }, necessidades: s.necessidades.map((n) => ({ ...n })), assumido: [] as string[] };
  const nivelAtual: Nivel = s.nivel ?? "L1";

  const direto = atalhoDireto(t, s, base, nivelAtual);
  if (direto) return direto;

  const ocasiao = atualizarOcasiao(t, s.estado === "S2", base.ocasiao);
  const { necessidades, valorExtraido } = atualizarNecessidades(t, base.necessidades);
  const pressa = input.pressaDetectada || PRESSA.test(t);
  const novo = necessidades.length !== s.necessidades.length || ocasiao.pessoas !== s.ocasiao.pessoas || valorExtraido !== undefined;

  if (!novo) {
    return decidirSemNovidade(t, s.opcoesFaladas, base, ocasiao, necessidades, nivelAtual, pressa);
  }
  return decidirComNovidade(t, s, base, ocasiao, necessidades, pressa);
}

function atalhoDireto(
  t: string,
  s: InterpretarInput["session"],
  base: { ocasiao: Ocasiao; necessidades: Necessidade[]; assumido: string[] },
  nivelAtual: Nivel,
): TurnoInterpretado | undefined {
  if (RE_FORA_ESCOPO.test(t)) {
    return { ...base, intencao: "fora_escopo", nivel: nivelAtual, resposta: "Isso eu não consigo ajudar. Posso ajudar com refeição, mercado ou presente?" };
  }
  if (RE_APROVAR.test(t)) return { ...base, intencao: "aprovar", nivel: nivelAtual };
  if (RE_SAUDACAO.test(t) && !CATALOGO.some((c) => c.re.test(t))) {
    return { ...base, intencao: "conversa", nivel: nivelAtual, resposta: "Eu ajudo com refeição, mercado e presentes, e monto um plano para você aprovar. O que você quer resolver?" };
  }
  const ajuste = criterioAjuste(t);
  if (s.estado !== "S0" && s.necessidades.length > 0 && ajuste && s.opcoesFaladas.length > 0) {
    const categoria = s.necessidades.find((n) => t.includes(norm(n.categoria).split(" ")[0]))?.categoria;
    return { ...base, intencao: "ajustar", nivel: nivelAtual, ajuste: { criterio: ajuste, ...(categoria ? { categoria } : {}) } };
  }
  return undefined;
}

function atualizarOcasiao(t: string, respondendo: boolean, ocasiao: Ocasiao): Ocasiao {
  if (/aniversario/.test(t)) ocasiao.tipo = "aniversario";
  if (/em casa/.test(t)) ocasiao.local = "casa";
  if (/\bhoje\b/.test(t)) ocasiao.quando = "hoje";
  const pessoas = extrairPessoas(t, respondendo);
  if (pessoas) ocasiao.pessoas = pessoas;
  return ocasiao;
}

function atualizarNecessidades(t: string, necessidades: Necessidade[]): { necessidades: Necessidade[]; valorExtraido?: string } {
  for (const c of CATALOGO) {
    if (!c.re.test(t)) continue;
    const categoria = c.categoria(t);
    const existente = necessidades.find((n) => n.vertical === c.vertical && norm(n.categoria).split(" ")[0] === categoria.split(" ")[0]);
    if (existente) existente.categoria = categoria;
    else necessidades.push({ id: `n${necessidades.length + 1}`, vertical: c.vertical, categoria, restricoes: [] });
  }
  const valorExtraido = RE_ORCAMENTO.exec(t)?.[1];
  const presente = necessidades.find((n) => n.vertical === "SHOPPING");
  if (valorExtraido && presente) {
    presente.orcamento = { max: Number(valorExtraido), tipo: /no maximo|maximo/.test(t) ? "teto" : "flexivel" };
  }
  adicionarRestricoes(t, necessidades);
  return { necessidades, valorExtraido };
}

function adicionarRestricoes(t: string, necessidades: Necessidade[]) {
  const novas = RESTRICOES_CONHECIDAS.filter((r) => t.includes(r));
  for (const n of necessidades) {
    if (n.vertical === "SHOPPING") continue;
    for (const r of novas) {
      if (!n.restricoes.includes(r)) n.restricoes.push(r);
    }
  }
}

function decidirSemNovidade(
  t: string,
  opcoesFaladas: string[],
  base: { ocasiao: Ocasiao; necessidades: Necessidade[]; assumido: string[] },
  ocasiao: Ocasiao,
  necessidades: Necessidade[],
  nivelAtual: Nivel,
  pressa: boolean,
): TurnoInterpretado {
  if (pressa) return { ...base, ocasiao, necessidades, intencao: "consentir", nivel: "L0", assumido: assumidos(ocasiao, necessidades) };
  if (RE_CONCORDANCIA.test(t)) {
    return { ...base, ocasiao, necessidades, intencao: "consentir", nivel: nivelAtual, assumido: assumidos(ocasiao, necessidades) };
  }
  const parecida = opcoesFaladas.find((o) => norm(o).split(" ").some((p) => p.length > 4 && t.includes(p.slice(0, 4))));
  return { ...base, intencao: "incerto", nivel: nivelAtual, confirmacao: parecida ? `Foi ${parecida}?` : "Pode repetir só o nome?" };
}

function calcularNivelProposto(pressa: boolean, especifico: boolean, necessidades: Necessidade[], ocasiao: Ocasiao): Nivel {
  if (pressa || especifico) return "L0";
  if (necessidades.length > 1 || ocasiao.tipo) return "L2";
  return "L1";
}

function decidirComNovidade(
  t: string,
  s: InterpretarInput["session"],
  base: { ocasiao: Ocasiao; necessidades: Necessidade[]; assumido: string[] },
  ocasiao: Ocasiao,
  necessidades: Necessidade[],
  pressa: boolean,
): TurnoInterpretado {
  const especifico = RE_ESPECIFICO.test(t);
  const nivel = rebaixar(s.nivel, calcularNivelProposto(pressa, especifico, necessidades, ocasiao));
  const intencao = s.estado === "S2" ? "responder" : "pedido";
  if (nivel === "L0") return { ...base, ocasiao, necessidades, intencao, nivel, assumido: assumidos(ocasiao, necessidades) };

  const temRestaurante = necessidades.some((n) => n.vertical === "RESTAURANT" || n.vertical === "GROCERIES");
  if (temRestaurante && !ocasiao.pessoas && nivel === "L2") {
    return { ...base, ocasiao, necessidades, intencao, nivel, pergunta: "Quantas pessoas, mais ou menos? Ou posso escolher por você." };
  }
  const presente = necessidades.find((n) => n.vertical === "SHOPPING");
  if (presente && !presente.orcamento && nivel === "L2") {
    return { ...base, ocasiao, necessidades, intencao, nivel, pergunta: "Quer um valor para o presente, ou escolho até cem reais?" };
  }
  return { ...base, ocasiao, necessidades, intencao, nivel, assumido: assumidos(ocasiao, necessidades) };
}

function criterioAjuste(t: string): Criterio | undefined {
  if (/mais barat|mais em conta|economic/.test(t)) return "mais_barata";
  if (/mais rapid|chega antes|mais cedo/.test(t)) return "mais_rapida";
  if (/melhor avaliad|mais bem avaliad|melhor nota/.test(t)) return "melhor_avaliada";
  if (/favorit|de sempre/.test(t)) return "favorita";
  if (/outr[ao]|troca|nao gostei/.test(t)) return "outra";
  return undefined;
}

function converterNumero(token: string): number | undefined {
  return /^\d+$/.test(token) ? Number(token) : NUMEROS[token];
}

function extrairPessoas(t: string, respondendo: boolean): number | undefined {
  const explicito = RE_PESSOAS_EXPLICITO.exec(t);
  if (explicito) return converterNumero(explicito[1]);
  if (!respondendo) return undefined;
  for (const palavra of t.split(/\W+/)) {
    const valor = converterNumero(palavra);
    if (valor !== undefined) return valor;
  }
  return undefined;
}

function assumidos(ocasiao: Ocasiao, necessidades: Necessidade[]): string[] {
  const out: string[] = [];
  const presente = necessidades.find((n) => n.vertical === "SHOPPING");
  if (presente && !presente.orcamento) { presente.orcamento = { max: 100, tipo: "flexivel" }; out.push("presente até cem reais"); }
  if (!ocasiao.pessoas && necessidades.length > 1) out.push("uma pessoa");
  return out;
}

const ORDEM: Nivel[] = ["L0", "L1", "L2"];
export function rebaixar(atual: Nivel | undefined, proposto: Nivel): Nivel {
  if (!atual) return proposto;
  return ORDEM.indexOf(proposto) < ORDEM.indexOf(atual) ? proposto : atual;
}
