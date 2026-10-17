// Interpretador por regras: modo degradado sem chave de LLM e linha de base dos evals.
// Cobre o roteiro da demo; não tenta entender linguagem livre.
import { respostaTemplate } from "@/prompts/responder";
import type { Criterio, InterpretarInput, LlmPort, Necessidade, Nivel, Ocasiao, ResponderInput, TurnoInterpretado } from "../types";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NUMEROS: Record<string, number> = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12, quinze: 15, vinte: 20 };

const CATALOGO: { re: RegExp; vertical: Necessidade["vertical"]; categoria: (t: string) => string }[] = [
  { re: /pizza/, vertical: "RESTAURANT", categoria: (t) => (/calabresa/.test(t) ? "pizza calabresa" : /margherita|marguerita/.test(t) ? "pizza margherita" : "pizza") },
  { re: /hamburguer|burger|lanche|smash/, vertical: "RESTAURANT", categoria: () => "hamburguer" },
  { re: /pipoca|filme/, vertical: "GROCERIES", categoria: () => "pipoca" },
  { re: /refrigerante|refri\b/, vertical: "GROCERIES", categoria: () => "refrigerante" },
  { re: /copo/, vertical: "GROCERIES", categoria: () => "copos" },
  { re: /presente|aniversario/, vertical: "SHOPPING", categoria: () => "presente" },
];

export const PRESSA = /tanto faz|qualquer (um|uma)|pede logo|pode escolher|escolhe (voce|vc|ai)|so faz|faz isso logo|rapidinho|to com pressa|sem pergunta/;

export class RuleBasedLlm implements LlmPort {
  readonly nome = "regras";

  async interpretar(input: InterpretarInput): Promise<TurnoInterpretado> {
    const t = norm(input.texto);
    const s = input.session;
    const base = { ocasiao: { ...s.ocasiao }, necessidades: s.necessidades.map((n) => ({ ...n })), assumido: [] as string[] };
    const nivelAtual: Nivel = s.nivel ?? "L1";

    if (/cerveja|vinho|vodka|alcool|remedio|dipirona|medic|farmacia/.test(t)) {
      return { ...base, intencao: "fora_escopo", nivel: nivelAtual, resposta: "Isso eu não consigo ajudar. Posso ajudar com refeição, mercado ou presente?" };
    }
    if (/(aprovo|confirmo) o plano/.test(t)) return { ...base, intencao: "aprovar", nivel: nivelAtual };
    if (/o que voce faz|quem e voce|^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(t) && !CATALOGO.some((c) => c.re.test(t))) {
      return { ...base, intencao: "conversa", nivel: nivelAtual, resposta: "Eu ajudo com refeição, mercado e presentes, e monto um plano para você aprovar. O que você quer resolver?" };
    }

    const ajuste = criterioAjuste(t);
    if (s.estado !== "S0" && s.necessidades.length > 0 && ajuste && s.opcoesFaladas.length > 0) {
      const categoria = s.necessidades.find((n) => t.includes(norm(n.categoria).split(" ")[0]))?.categoria;
      return { ...base, intencao: "ajustar", nivel: nivelAtual, ajuste: { criterio: ajuste, ...(categoria ? { categoria } : {}) } };
    }

    // Extração incremental por cima do estado atual (o contrato pede estado completo).
    const ocasiao: Ocasiao = base.ocasiao;
    if (/aniversario/.test(t)) ocasiao.tipo = "aniversario";
    if (/em casa/.test(t)) ocasiao.local = "casa";
    if (/\bhoje\b/.test(t)) ocasiao.quando = "hoje";
    const pessoas = extrairPessoas(t, s.estado === "S2");
    if (pessoas) ocasiao.pessoas = pessoas;

    const necessidades = base.necessidades;
    for (const c of CATALOGO) {
      if (!c.re.test(t)) continue;
      const categoria = c.categoria(t);
      const existente = necessidades.find((n) => n.vertical === c.vertical && norm(n.categoria).split(" ")[0] === categoria.split(" ")[0]);
      if (existente) existente.categoria = categoria;
      else necessidades.push({ id: `n${necessidades.length + 1}`, vertical: c.vertical, categoria, restricoes: [] });
    }
    const valor = t.match(/(?:ate|no maximo|maximo)\s*r?\$?\s*(\d+)/)?.[1];
    const presente = necessidades.find((n) => n.vertical === "SHOPPING");
    if (valor && presente) presente.orcamento = { max: Number(valor), tipo: /no maximo|maximo/.test(t) ? "teto" : "flexivel" };
    for (const r of ["lactose", "amendoim", "gluten", "camarao"]) {
      if (t.includes(r)) necessidades.forEach((n) => { if (n.vertical !== "SHOPPING" && !n.restricoes.includes(r)) n.restricoes.push(r); });
    }

    const pressa = input.pressaDetectada || PRESSA.test(t);
    const novo = necessidades.length !== s.necessidades.length || pessoas !== undefined || valor !== undefined;
    if (!novo && pressa) return { ...base, ocasiao, necessidades, intencao: "consentir", nivel: "L0", assumido: assumidos(ocasiao, necessidades) };
    if (!novo && /^(sim|pode|isso|fechou|fechado|ok|beleza|monta|pode montar|faz)\b/.test(t)) {
      return { ...base, ocasiao, necessidades, intencao: "consentir", nivel: nivelAtual, assumido: assumidos(ocasiao, necessidades) };
    }
    if (!novo) {
      const parecida = s.opcoesFaladas.find((o) => norm(o).split(" ").some((p) => p.length > 4 && t.includes(p.slice(0, 4))));
      return { ...base, intencao: "incerto", nivel: nivelAtual, confirmacao: parecida ? `Foi ${parecida}?` : "Pode repetir só o nome?" };
    }

    const especifico = /calabresa|margherita|x-burger|smash|classico/.test(t);
    let nivel: Nivel = pressa || especifico ? "L0" : necessidades.length > 1 || ocasiao.tipo ? "L2" : "L1";
    nivel = rebaixar(s.nivel, nivel);
    const intencao = s.estado === "S2" ? "responder" : "pedido";
    if (nivel === "L0") return { ...base, ocasiao, necessidades, intencao, nivel, assumido: assumidos(ocasiao, necessidades) };

    const temRestaurante = necessidades.some((n) => n.vertical === "RESTAURANT" || n.vertical === "GROCERIES");
    if (temRestaurante && !ocasiao.pessoas && nivel === "L2") {
      return { ...base, ocasiao, necessidades, intencao, nivel, pergunta: "Quantas pessoas, mais ou menos? Ou posso escolher por você." };
    }
    if (presente && !presente.orcamento && nivel === "L2") {
      return { ...base, ocasiao, necessidades, intencao, nivel, pergunta: "Quer um valor para o presente, ou escolho até cem reais?" };
    }
    return { ...base, ocasiao, necessidades, intencao, nivel, assumido: assumidos(ocasiao, necessidades) };
  }

  async responder(input: ResponderInput): Promise<string> {
    return respostaTemplate(input);
  }
}

function criterioAjuste(t: string): Criterio | undefined {
  if (/mais barat|mais em conta|economic/.test(t)) return "mais_barata";
  if (/mais rapid|chega antes|mais cedo/.test(t)) return "mais_rapida";
  if (/melhor avaliad|mais bem avaliad|melhor nota/.test(t)) return "melhor_avaliada";
  if (/favorit|de sempre/.test(t)) return "favorita";
  if (/outr[ao]|troca|nao gostei/.test(t)) return "outra";
  return undefined;
}

function extrairPessoas(t: string, respondendo: boolean): number | undefined {
  const m = t.match(/(\d+|\b(?:uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|doze|quinze|vinte)\b)\s*(?:pessoas|amigos|convidados)?/);
  if (!m) return undefined;
  const n = /\d/.test(m[1]) ? Number(m[1]) : NUMEROS[m[1]];
  // Número solto só conta como pessoas quando é resposta à pergunta de pessoas.
  return /pessoas|amigos|convidados/.test(m[0]) || respondendo ? n : undefined;
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
