// GUARDAS DA FALA: tudo que o Guide fala (e mostra) passa por aqui. Mecanismo geral, sem lista de casos:
//  1) SANEAR NA FRONTEIRA: nome de categoria, loja e item vem do modelo e do catálogo, que não são confiáveis. Antes de
//     entrar no plano (e, portanto, na fala e na tela) é limpo: sem marcação, link, emoji, endereço, telefone nem instrução.
//  2) FALA VINCULADA AO PLANO: a fala do LLM só vale se for falável, sem ação de compra, sem número ou nome fora do plano
//     e se citar o plano; se faltar algo ou houver opção aproximada, tem de dizer. Senão cai no template.
// O oráculo de testes (src/qualidade/invariantes.ts) confere o resultado com regras próprias: duas camadas independentes.
import { speakableIssues } from "@/voice/speakable";
import { falaRespeitaSnapshot } from "@/prompts/responder";
import { temDadoPessoal } from "./privacidade";
import { MAX_NECESSIDADES } from "./limites";
import type { OpcaoPlano, PlanoSnapshot, TurnoInterpretado } from "./types";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// A fala não pode afirmar o que o Guide não faz (ele monta um plano; quem aprova é o usuário) nem vazar dado sensível.
export const PROIBIDO = /\b(adicionei|adicionado|adicionada|coloquei|comprei|reservei|finalizei|fechei o pedido)\b|carrinho|pedido (foi )?(feito|realizado|enviado|confirmado)|compra (foi )?(feita|realizada|concluida|concluída)|\bcpf\b|cart[aã]o|senha|[[\]*#]/i;

// Texto que tenta dar ordem ao Guide (vindo do modelo, do catálogo ou do usuário) não pode ser falado nem exibido.
const INSTRUCAO = /ignor(e|ar|em) (tod[oa]s )?(as )?(instru|regras)|esque[cç]a tudo|voc[eê] agora [ée]|system\s*:|aprovo o plano|<\/?instru/i;

const MARCACAO = /<[^>]*>|[<>[\]{}*_#`\\|~^]/g;
const LINK = /https?:\/\/\S+|www\.\S+/gi;
const EMOJI = /\p{Extended_Pictographic}/gu;

// Nome de categoria, loja ou item pronto para ser falado: sem marcação, link, emoji, endereço, telefone ou instrução.
// Devolve "" quando não sobra nada confiável (quem chama escolhe uma palavra neutra).
// Imagem do catálogo: só https do CDN do iFood (um catálogo hostil não pode apontar a interface para outro site).
export function urlDoIfood(u: unknown): string | undefined {
  return typeof u === "string" && u.length <= 400 && /^https:\/\/static\.ifood-static\.com\.br\/[\w\-./%?=&,]+$/.test(u) ? u : undefined;
}

export function limparNome(texto: string, max = 60): string {
  let t = String(texto ?? "").normalize("NFC").replace(LINK, " ").replace(MARCACAO, " ").replace(EMOJI, " ").replace(/\s+/g, " ").trim();
  if (INSTRUCAO.test(t) || temDadoPessoal(t)) return "";
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, "").trim();
  return t;
}

const ou = (s: string, vazio: string, max?: number) => limparNome(s, max) || vazio;

function sanearOpcao(o: OpcaoPlano): OpcaoPlano {
  const out: OpcaoPlano = { ...o, loja: ou(o.loja, "essa loja", 50), item: ou(o.item, "esse item", 70), rotulo: ou(o.rotulo, "opção", 30), motivo: ou(o.motivo, "opção disponível", 120), precoCents: Math.round(o.precoCents) };
  if (o.freteCents !== undefined) { if (Number.isFinite(o.freteCents) && o.freteCents >= 0) out.freteCents = Math.round(o.freteCents); else delete out.freteCents; }
  if (o.nota !== undefined && !(Number.isFinite(o.nota) && o.nota >= 0 && o.nota <= 5)) delete out.nota;
  if (o.prazo !== undefined) { const p = limparNome(o.prazo, 40); if (p) out.prazo = p; else delete out.prazo; }
  if (o.descricao !== undefined) { const d = limparNome(o.descricao, 200); if (d) out.descricao = d; else delete out.descricao; }
  for (const k of ["imagemUrl", "logoUrl"] as const) { if (o[k] !== undefined && !urlDoIfood(o[k])) delete out[k]; }
  for (const k of ["distanciaKm", "avaliacoes", "pedidoMinimoCents", "precoOriginalCents"] as const) {
    const v = o[k];
    if (v !== undefined && !(Number.isFinite(v) && v >= 0)) delete out[k];
  }
  return out;
}

// O plano que o domínio devolveu, limpo. Vale para qualquer domínio (simulado, MCP real ou hostil): a fala e a tela só
// veem o plano saneado.
// Preço desconhecido não vira "grátis": candidato com preço inválido (NaN, infinito, negativo) é descartado. Zero informado
// pela origem é um valor válido e fica. Se não sobra candidato, a categoria vira "não atendida" (e não entra na aprovação).
const precoValido = (o: OpcaoPlano) => typeof o.precoCents === "number" && Number.isFinite(o.precoCents) && o.precoCents >= 0;

export function sanearPlano(p: PlanoSnapshot): PlanoSnapshot {
  const semPreco: { categoria: string; motivo: string }[] = [];
  const blocos: PlanoSnapshot["blocos"] = [];
  for (const b of p.blocos) {
    const [principal, ...alternativas] = [b.principal, ...b.alternativas].filter(precoValido);
    if (!principal) { semPreco.push({ categoria: ou(b.categoria, "esse pedido", 60), motivo: "sem preço confiável" }); continue; }
    blocos.push({ ...b, categoria: ou(b.categoria, "item", 60), quantidade: Math.min(99, Math.max(1, Math.round(Number.isFinite(b.quantidade) ? b.quantidade : 1))), principal: sanearOpcao(principal), alternativas: alternativas.map(sanearOpcao) });
  }
  return {
    ...p,
    blocos,
    naoAtendidas: [...p.naoAtendidas.map((n) => ({ ...n, categoria: ou(n.categoria, "esse pedido", 60) })), ...semPreco],
    pendencias: p.pendencias.map((x) => limparNome(x, 140)).filter(Boolean),
  };
}

const PERMITIDOS = new Set(["ifood", "guide", "casa", "trabalho"]);
const textoDoPlano = (p: PlanoSnapshot) => norm(p.blocos.flatMap((b) => [b.categoria, ...[b.principal, ...b.alternativas].flatMap((o) => [o.loja, o.item])]).join(" "));

// Nome próprio na fala (inicial maiúscula fora do começo de frase) que não está no plano: nome inventado.
export function nomesForaDoPlano(fala: string, plano: PlanoSnapshot, permitidos: string[] = []): string[] {
  const doPlano = textoDoPlano(plano);
  const extras = new Set(permitidos.map(norm));
  const fora: string[] = [];
  for (const m of fala.matchAll(/(?<![.!?:]\s)(?<!^)\b([A-ZÀ-Ý][\p{L}]{2,})\b/gu)) {
    const w = norm(m[1]);
    if (!doPlano.includes(w) && !PERMITIDOS.has(w) && !extras.has(w)) fora.push(m[1]);
  }
  return fora;
}

// A fala sobre um plano cita pelo menos uma loja, item ou categoria dele (fala solta não descreve o plano).
export function mencionaOPlano(fala: string, plano: PlanoSnapshot): boolean {
  const f = norm(fala);
  const palavras = textoDoPlano(plano).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  return palavras.some((w) => f.includes(w));
}

export interface ResultadoGuarda { ok: boolean; motivo?: string }

// Pergunta, confirmação ou resposta curta do modelo: só vale se for falável e segura.
export function falaSegura(texto: string): boolean {
  return Boolean(texto.trim()) && !PROIBIDO.test(texto) && !temDadoPessoal(texto) && !INSTRUCAO.test(texto) && speakableIssues(texto).length === 0;
}

// Fala do LLM sobre um plano: vale só se vinculada aos fatos do plano.
export function falaDoPlanoValida(fala: string, plano: PlanoSnapshot, permitidos: string[] = []): ResultadoGuarda {
  if (!fala.trim()) return { ok: false, motivo: "vazia" };
  if (PROIBIDO.test(fala) || INSTRUCAO.test(fala)) return { ok: false, motivo: "conteúdo proibido" };
  if (temDadoPessoal(fala)) return { ok: false, motivo: "dado pessoal" };
  if (/muito pedid|\bnov[oa]\b/i.test(fala)) return { ok: false, motivo: "afirmação sem dado" };
  const issues = speakableIssues(fala);
  if (issues.length) return { ok: false, motivo: issues.join("; ") };
  if (!falaRespeitaSnapshot(fala, plano)) return { ok: false, motivo: "número fora do plano" };
  if (plano.blocos.length > 0 && !mencionaOPlano(fala, plano)) return { ok: false, motivo: "não cita o plano" };
  const fora = nomesForaDoPlano(fala, plano, permitidos);
  if (fora.length) return { ok: false, motivo: `nome fora do plano: ${fora.join(", ")}` };
  const f = norm(fala);
  if (plano.blocos.some((b) => b.cobertura === "proxima") && !/parecid|proxim|nao (achei|encontrei)/.test(f)) return { ok: false, motivo: "aproximado dito como o pedido" };
  if (plano.naoAtendidas.length > 0 && !/ainda nao tenho|nao (achei|encontrei|tenho)/.test(f)) return { ok: false, motivo: "falta não dita" };
  return { ok: true };
}

// O que o MODELO devolveu, limpo logo na entrada, antes de qualquer caminho (confirmação, estado, busca) usar: categoria,
// consultas, restrições, ocasião e o que ele "assumiu" nunca carregam marcação, endereço nem instrução.
export function higienizarTurno(t: TurnoInterpretado): TurnoInterpretado {
  const necessidades = t.necessidades
    .map((n) => ({
      ...n,
      categoria: limparNome(n.categoria),
      restricoes: n.restricoes.map((r) => limparNome(r)).filter(Boolean),
      ...(n.consultas ? { consultas: n.consultas.map((c) => limparNome(c, 80)).filter(Boolean) } : {}),
    }))
    .filter((n) => n.categoria.length > 0)
    .slice(0, MAX_NECESSIDADES);
  const ocasiao = { ...t.ocasiao };
  for (const k of ["tipo", "quando", "local"] as const) if (ocasiao[k] !== undefined) { const v = limparNome(ocasiao[k] as string, 60); if (v) ocasiao[k] = v; else delete ocasiao[k]; }
  return { ...t, necessidades, ocasiao, assumido: t.assumido.map((a) => limparNome(a, 120)).filter(Boolean), ...(t.ajuste ? { ajuste: higienizarAjuste(t.ajuste) } : {}) };
}

// Último recurso quando nem o template serve: curta, verdadeira e que ainda diz o que faltou (cobertura honesta).
export function falaMinima(plano: PlanoSnapshot): string {
  const partes = ["Montei o plano e ele está na sua tela."];
  if (plano.blocos.some((b) => b.cobertura === "proxima")) partes.push("Em alguns itens não achei exatamente o que você pediu; veja o mais parecido na tela.");
  if (plano.naoAtendidas.length > 0) partes.push("Ainda não tenho opção para alguns itens.");
  partes.push("Quer ajustar algo?");
  return partes.join(" ");
}

// Ajuste pedido pelo modelo: a categoria também é texto do modelo.
export function higienizarAjuste(a: TurnoInterpretado["ajuste"]): TurnoInterpretado["ajuste"] {
  if (!a) return a;
  const categoria = a.categoria ? limparNome(a.categoria, 60) : undefined;
  return { criterio: a.criterio, ...(categoria ? { categoria } : {}) };
}
