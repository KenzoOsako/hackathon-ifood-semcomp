// Estado da conversa por sujeito da sessão de visitante (mesmo processo; RAM, como D-010).
import type { AgentSession } from "./types";

const MAX_SESSOES = 2000;

export function novaSessao(subjectRef: string): AgentSession {
  return { subjectRef, estado: "S0", perguntasFeitas: 0, confirmacoesSeguidas: 0, restricoes: [], turnos: 0, encaminhado: false, history: [], ocasiao: {}, necessidades: [], recusadas: [] };
}

const g = globalThis as unknown as { __guideSessions?: Map<string, AgentSession> };
const sessoes = (g.__guideSessions ??= new Map());

export function sessaoDo(subjectRef: string): AgentSession {
  const s = sessoes.get(subjectRef) ?? novaSessao(subjectRef);
  // Reinserir move para o fim: o descarte por capacidade tira a menos usada, não a mais antiga.
  sessoes.delete(subjectRef); sessoes.set(subjectRef, s);
  if (sessoes.size > MAX_SESSOES) sessoes.delete(sessoes.keys().next().value!);
  return s;
}

// Conversa nova para o mesmo visitante. Login iFood não é afetado.
export function reiniciarSessao(subjectRef: string): AgentSession {
  sessoes.delete(subjectRef);
  return sessaoDo(subjectRef);
}
