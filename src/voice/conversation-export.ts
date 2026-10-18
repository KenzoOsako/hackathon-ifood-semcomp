// O que o AGENTE decidiu em um turno (vem da resposta do /api/converse; a voz só repassa). Serve para ver o "cérebro":
// qual modelo respondeu, em que estado da conversa, com que nível e quanto tempo cada etapa levou.
export interface AgentMeta {
  llm: string; // "regras" (sem LLM) ou o modelo (ex.: google:gemini-3.5-flash-lite)
  estado: string; // S0–S7
  nivel: string; // L0 | L1 | L2
  origem?: string; // simulado | real (dados)
  tempos?: Record<string, number>; // interpretarMs, dominioMs, responderMs, totalMs
  aprovacao?: { planoId: string; versao: number };
}

const text = (v: unknown, max = 80): string | undefined => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : undefined);

// Lê os metadados de uma resposta do agente sem confiar no formato: campo estranho é ignorado, nunca derruba o turno.
export function metaFrom(body: unknown): AgentMeta | undefined {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return undefined;
  const llm = text(b.llm);
  const estado = text(b.estado, 8);
  const nivel = text(b.nivel, 8);
  if (!llm || !estado || !nivel) return undefined;
  const tempos: Record<string, number> = {};
  if (b.tempos && typeof b.tempos === "object") {
    for (const [k, v] of Object.entries(b.tempos as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v)) tempos[k.slice(0, 24)] = Math.round(v);
  }
  const ap = b.aprovacao as { planoId?: unknown; versao?: unknown } | undefined;
  return {
    llm, estado, nivel,
    ...(text(b.origem, 16) ? { origem: text(b.origem, 16) } : {}),
    ...(Object.keys(tempos).length ? { tempos } : {}),
    ...(ap && typeof ap.planoId === "string" && typeof ap.versao === "number" ? { aprovacao: { planoId: ap.planoId.slice(0, 64), versao: ap.versao } } : {}),
  };
}

export interface TurnLog {
  id: string;
  usuario: string;
  origem: "voz" | "texto";
  confianca?: number;
  resposta?: string;
  meta?: AgentMeta;
}

// O agente está no modo de reserva por regras (sem LLM)? Importa saber: os testes de conversa só valem com o LLM real.
export const semLlm = (meta?: AgentMeta): boolean => meta?.llm === "regras";

// Conversa inteira em JSON: cada teste falado vira um exemplo reproduzível (e base para cenários de avaliação).
export function buildConversationExport(turns: TurnLog[], ctx: { dados?: string; geradoEm?: string } = {}) {
  const ultimo = [...turns].reverse().find((t) => t.meta)?.meta;
  return {
    geradoEm: ctx.geradoEm ?? new Date().toISOString(),
    agente: { llm: ultimo?.llm ?? "desconhecido", dados: ctx.dados ?? "desconhecido" },
    turnos: turns.map((t, i) => ({
      n: i + 1,
      usuario: t.usuario,
      origem: t.origem,
      ...(t.confianca !== undefined ? { confianca: t.confianca } : {}),
      resposta: t.resposta ?? null,
      ...(t.meta ? { estado: t.meta.estado, nivel: t.meta.nivel, llm: t.meta.llm, tempos: t.meta.tempos, aprovacao: t.meta.aprovacao } : {}),
    })),
  };
}
