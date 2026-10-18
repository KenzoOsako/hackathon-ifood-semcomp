import { visitorSessions } from "@/agent/visitor-session";
import { failureResponse, jsonBody, jsonResponse, requireSameOriginJson } from "@/agent/http";
import { dominioRealDo } from "@/agent/domain-mcp/por-sujeito";
import { criarLlm } from "@/agent/llm";
import { nomeConhecido } from "@/agent/perfil";
import { executarTurno, reiniciarSessao, sessaoDo } from "@/agent/orchestrator";
import { ConverseInputSchema, type DomainPort, type LlmPort } from "@/agent/types";
import { conectado } from "@/mcp/real/oauth";

// Mesmos guardas do chat (origem, JSON limitado, sessão por cookie). Identidade nunca vem do body.
// Só dados reais do MCP do iFood, e só para a sessão que fez login iFood (/api/auth/login). Não há modo simulado.
const g = globalThis as unknown as { __guideLlm?: Promise<LlmPort> };
// Falha ao criar o LLM não fica em cache: a próxima requisição tenta de novo.
function llm(): Promise<LlmPort> {
  g.__guideLlm ??= criarLlm().catch((error) => { g.__guideLlm = undefined; throw error; });
  return g.__guideLlm;
}

const LOGIN = { state: "FALHA", code: "IFOOD_LOGIN", reply: "Conecte sua conta iFood para eu buscar opções reais.", loginUrl: "/api/auth/login" };

export async function POST(req: Request) {
  let cookie: string | undefined;
  try {
    requireSameOriginJson(req);
    const input = ConverseInputSchema.parse(await jsonBody(req));
    const resolved = visitorSessions.resolve(req, true); cookie = resolved.cookie;
    const subjectRef = resolved.visitor.conversation.subjectRef;
    if (!conectado(subjectRef)) return jsonResponse(LOGIN, 401, cookie);
    const domain: DomainPort = await dominioRealDo(subjectRef);
    const deps = { llm: await llm(), domain, nome: nomeConhecido(subjectRef) };
    const reply = await visitorSessions.run(resolved.visitor, (conversation) => executarTurno((input.reiniciar ? reiniciarSessao : sessaoDo)(conversation.subjectRef), input, deps));
    console.info(`[converse] mcp=real llm=${reply.llm} estado=${reply.estado} interpretar=${reply.tempos.interpretarMs}ms dominio=${reply.tempos.dominioMs ?? "-"}ms responder=${reply.tempos.responderMs ?? "-"}ms total=${reply.tempos.totalMs}ms`);
    return jsonResponse(reply, 200, cookie);
  } catch (error) { return failureResponse(error, cookie); }
}
