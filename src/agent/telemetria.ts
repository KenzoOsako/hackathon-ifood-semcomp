// OBSERVABILIDADE do agente, simples e sem texto do usuário: um registro por turno (o que o agente decidiu, em quanto
// tempo, quais GUARDAS dispararam) mais os eventos de feedback (o que foi mostrado, aceito, ajustado e o que NÃO foi
// atendido: demanda real que o iFood não está cobrindo). Fica em memória (últimos 500 turnos); nada vai a log nem a
// terceiros. A sessão aparece só como um código curto derivado (não reversível). Lido por GET /api/telemetria e pela /voz.
//
// Cada guarda que dispara é um sinal: "plano:número fora do plano" quer dizer que o modelo falou um número que não estava
// no plano e o template assumiu. Taxa alta de guarda = prompt ou modelo precisando de ajuste.
import { createHash } from "node:crypto";
import { percentile } from "@/voice/latency";
import type { EventoFeedback } from "./types";

export interface TurnoTelemetria {
  em: number;
  sessao: string;
  turno: number;
  intencao?: string;
  nivel: string;
  estado: string;
  llm: string;
  origem: string;
  necessidades: string[];
  blocos: number;
  proximas: number;
  naoAtendidas: string[];
  guardas: string[];
  perguntou: boolean;
  tempos: { interpretarMs: number; dominioMs?: number; responderMs?: number; totalMs: number };
}

interface Estado { turnos: TurnoTelemetria[]; contadores: Map<string, number>; feedback: EventoFeedback[] }
const g = globalThis as unknown as { __guideTelemetria?: Estado };
const inicial: Estado = { turnos: [], contadores: new Map(), feedback: [] };
const st = (g.__guideTelemetria ??= inicial);
const MAX_TURNOS = 500;
const MAX_FEEDBACK = 2000;

export const codigoDaSessao = (subjectRef: string) => createHash("sha256").update(subjectRef).digest("hex").slice(0, 8);

export function registrarTurno(t: TurnoTelemetria): void {
  st.turnos.push(t);
  if (st.turnos.length > MAX_TURNOS) st.turnos.shift();
}

// Eventos fora de um turno (ex.: o juiz de relevância falhou). Nunca lança.
export function contar(chave: string, n = 1): void {
  st.contadores.set(chave, (st.contadores.get(chave) ?? 0) + n);
}

export function registrarFeedback(e: EventoFeedback): void {
  st.feedback.push(e);
  if (st.feedback.length > MAX_FEEDBACK) st.feedback.shift();
}

const por = <T>(xs: T[], chave: (x: T) => string | undefined) => {
  const m: Record<string, number> = {};
  for (const x of xs) { const k = chave(x); if (k) m[k] = (m[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const pct = (xs: number[]) => (xs.length ? { n: xs.length, p50: Math.round(percentile(xs, 0.5)), p95: Math.round(percentile(xs, 0.95)) } : undefined);

export function resumo() {
  const t = st.turnos;
  const comPlano = t.filter((x) => x.blocos > 0);
  const guardas = por(t.flatMap((x) => x.guardas.map((motivo) => ({ motivo }))), (x) => x.motivo);
  const falasDePlano = comPlano.length;
  const porTemplate = comPlano.filter((x) => x.guardas.some((g) => g.startsWith("plano:") || g === "fala_minima" || g === "responder:falha")).length;
  const naoAtendidas = por(t.flatMap((x) => x.naoAtendidas.map((categoria) => ({ categoria }))), (x) => x.categoria);
  const fb = st.feedback;
  return {
    geradoEm: new Date().toISOString(),
    turnos: t.length,
    conversas: new Set(t.map((x) => x.sessao)).size,
    porIntencao: por(t, (x) => x.intencao),
    porEstado: por(t, (x) => x.estado),
    porModelo: por(t, (x) => x.llm),
    guardas,
    // Fala do plano que o modelo escreveu e o código trocou pelo template: quanto menor, melhor o prompt.
    taxaDeTemplate: falasDePlano ? Math.round((porTemplate / falasDePlano) * 1000) / 10 : 0,
    contadores: Object.fromEntries(st.contadores),
    cobertura: { turnosComPlano: falasDePlano, blocosAproximados: comPlano.reduce((a, x) => a + x.proximas, 0), naoAtendidas },
    perguntasPorConversa: (() => { const c = new Set(t.map((x) => x.sessao)).size; return c ? Math.round((t.filter((x) => x.perguntou).length / c) * 100) / 100 : 0; })(),
    tempos: {
      interpretarMs: pct(t.map((x) => x.tempos.interpretarMs)),
      dominioMs: pct(t.flatMap((x) => (x.tempos.dominioMs !== undefined ? [x.tempos.dominioMs] : []))),
      responderMs: pct(t.flatMap((x) => (x.tempos.responderMs !== undefined ? [x.tempos.responderMs] : []))),
      totalMs: pct(t.map((x) => x.tempos.totalMs)),
    },
    // Dados de produto: o que a pessoa viu, aceitou, ajustou e o que o iFood NÃO conseguiu atender.
    feedback: {
      planosMostrados: fb.filter((e) => e.tipo === "opcoes_exibidas").length,
      aceitou: fb.filter((e) => e.tipo === "reacao" && e.reacao === "aceitou").length,
      ajustou: por(fb.filter((e) => e.tipo === "reacao" && e.reacao === "ajustou") as Extract<EventoFeedback, { tipo: "reacao" }>[], (e) => e.motivo),
      demandaNaoAtendida: por(fb.filter((e) => e.tipo === "necessidade_nao_atendida") as Extract<EventoFeedback, { tipo: "necessidade_nao_atendida" }>[], (e) => e.categoria),
    },
  };
}

export const ultimosTurnos = (n = 50) => st.turnos.slice(-n);
export function __resetTelemetriaParaTestes(): void { st.turnos.length = 0; st.contadores.clear(); st.feedback.length = 0; }
