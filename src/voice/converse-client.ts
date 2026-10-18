// Cliente do /api/converse para a voz. Entrega SEMPRE o mesmo fluxo de eventos (converse-events.ts), seja qual for
// o formato que o backend devolve hoje:
//   - NDJSON (content-type application/x-ndjson): eventos na ordem em que o backend os produz (alvo, ver D-015);
//   - JSON único (AgentReply do orquestrador atual): convertido em eventos aqui.
// Assim o Hyago pode migrar a rota para streaming sem mexer na voz, e a voz já fala o agente real hoje.
import type { AgentReply, ConverseInput } from "@/agent/types";
import { splitSpeechChunks } from "./chunker";
import { metaFrom, type AgentMeta } from "./conversation-export";
import { readConverseStream, type ConverseEvent } from "./converse-events";

type ReplyLike = Pick<AgentReply, "resposta" | "fraseEspera" | "tela">;

// Converte a resposta única do orquestrador em eventos. Pura e testável.
export function replyToEvents(reply: ReplyLike, turnId: string): ConverseEvent[] {
  const events: ConverseEvent[] = [];
  // Quando a fala de espera vem junto da resposta final ela já não é "espera": só vira ack se for diferente do texto.
  if (reply.fraseEspera && reply.fraseEspera !== reply.resposta) events.push({ type: "ack", text: reply.fraseEspera });
  const chunks = splitSpeechChunks(reply.resposta);
  chunks.forEach((text, seq) => events.push({ type: "speech", seq, text: text.slice(0, 600), ...(seq === chunks.length - 1 ? { final: true } : {}) }));
  if (reply.tela) events.push({ type: "screen", event: reply.tela.tipo, payload: reply.tela.plano });
  events.push({ type: "done", turnId });
  return events;
}

const GENERIC_ERROR = "Não consegui responder agora. Pode tentar de novo?";

// Só caminho relativo do próprio app ("/api/auth/login"); URL externa ou "//host" nunca vira link.
const SAFE_LOGIN = /^\/(?!\/)[\w\-./?=&%]{0,199}$/;

function errorEvent(code: string, reply?: unknown, loginUrl?: unknown): ConverseEvent {
  const text = typeof reply === "string" && reply.trim() ? reply.trim().slice(0, 300) : GENERIC_ERROR;
  return { type: "error", code: code.slice(0, 40) || "ERRO", reply: text, ...(typeof loginUrl === "string" && SAFE_LOGIN.test(loginUrl) ? { loginUrl } : {}) };
}

export interface ConverseOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  newTurnId?: () => string;
  onMeta?: (meta: AgentMeta) => void; // quem respondeu e como (modelo, estado, nível, tempos); só no formato JSON atual
}

export async function* converseTurn(input: Pick<ConverseInput, "texto" | "origem" | "sinais" | "hipoteses" | "configuracao">, opts: ConverseOptions = {}): AsyncGenerator<ConverseEvent> {
  const doFetch = opts.fetchImpl ?? fetch;
  const turnId = (opts.newTurnId ?? (() => `t${Date.now().toString(36)}`))();
  let res: Response;
  try {
    res = await doFetch("/api/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson, application/json" },
      body: JSON.stringify(input),
      signal: opts.signal,
    });
  } catch {
    if (opts.signal?.aborted) return; // turno interrompido pela pessoa: sem erro falado
    yield errorEvent("REDE");
    return;
  }

  const type = res.headers.get("content-type") ?? "";
  if (res.ok && res.body && type.includes("application/x-ndjson")) {
    yield* readConverseStream(res.body);
    return;
  }

  let body: unknown;
  try { body = await res.json(); } catch { yield errorEvent("RESPOSTA_INVALIDA"); return; }
  const b = (body ?? {}) as Partial<AgentReply> & { code?: string; reply?: string; state?: string; loginUrl?: string };
  if (!res.ok || b.state === "FALHA" || typeof b.resposta !== "string" || !b.resposta.trim()) {
    yield errorEvent(b.code ?? `HTTP_${res.status}`, b.reply, b.loginUrl);
    return;
  }
  const meta = metaFrom(body);
  if (meta) opts.onMeta?.(meta);
  yield* replyToEvents({ resposta: b.resposta, fraseEspera: b.fraseEspera, tela: b.tela }, turnId);
}
