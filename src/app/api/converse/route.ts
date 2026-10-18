import { visitorSessions } from "@/agent/visitor-session";
import { failureResponse, jsonBody, jsonResponse, requireMockRequest } from "@/agent/http";
import { FakeDomain } from "@/agent/domain-fake";
import { criarLlm } from "@/agent/llm";
import { executarTurno, sessaoDo } from "@/agent/orchestrator";
import { ConverseInputSchema, type LlmPort } from "@/agent/types";

// Mesmos guardas do chat (origem, JSON limitado, sessão por cookie). Identidade nunca vem do body.
const g = globalThis as unknown as { __guideDomain?: FakeDomain; __guideLlm?: Promise<LlmPort> };
const domain = (g.__guideDomain ??= new FakeDomain());
// Falha ao criar o LLM não fica em cache: a próxima requisição tenta de novo.
function llm(): Promise<LlmPort> {
  g.__guideLlm ??= criarLlm().catch((error) => { g.__guideLlm = undefined; throw error; });
  return g.__guideLlm;
}

export async function POST(req: Request) {
  let cookie: string | undefined;
  try {
    requireMockRequest(req);
    const input = ConverseInputSchema.parse(await jsonBody(req));
    const resolved = visitorSessions.resolve(req, true); cookie = resolved.cookie;
    const deps = { llm: await llm(), domain };
    const reply = await visitorSessions.run(resolved.visitor, (conversation) => executarTurno(sessaoDo(conversation.subjectRef), input, deps));
    console.info(`[converse] llm=${reply.llm} estado=${reply.estado} interpretar=${reply.tempos.interpretarMs}ms dominio=${reply.tempos.dominioMs ?? "-"}ms responder=${reply.tempos.responderMs ?? "-"}ms total=${reply.tempos.totalMs}ms`);
    return jsonResponse(reply, 200, cookie);
  } catch (error) { return failureResponse(error, cookie); }
}
