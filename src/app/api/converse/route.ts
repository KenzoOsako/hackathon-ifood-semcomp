import { visitorSessions } from "@/agent/visitor-session";
import { failureResponse, jsonBody, jsonResponse, requireMockRequest, requireSameOriginJson } from "@/agent/http";
import { FakeDomain } from "@/agent/domain-fake";
import { dominioRealDo } from "@/agent/domain-mcp/por-sujeito";
import { PROVEDORES, criarModelo, type Provedor } from "@/agent/llm/langchain";
import { executarAtendente, reiniciarAtendente } from "@/agent/atendente";
import { nomeConhecido } from "@/agent/perfil";
import { reiniciarSessao, sessaoDo } from "@/agent/sessao";
import { ConverseInputSchema, type DomainPort } from "@/agent/types";
import { conectado } from "@/mcp/real/oauth";

// Mesmos guardas do chat (origem, JSON limitado, sessão por cookie). Identidade nunca vem do body.
// MCP_MODE=real: dados do MCP do iFood, só para a sessão que fez login iFood (/api/auth/login).
// O atendente (src/agent/atendente) conduz a conversa: o LLM decide e pesquisa com ferramentas; o código só guarda.
const g = globalThis as unknown as { __guideDomain?: FakeDomain };
const fake = (g.__guideDomain ??= new FakeDomain());

const LOGIN = { state: "FALHA", code: "IFOOD_LOGIN", reply: "Conecte sua conta iFood para eu buscar opções reais.", loginUrl: "/api/auth/login" };
const SEM_LLM = { state: "FALHA", code: "LLM_NAO_CONFIGURADO", reply: "O assistente está sem modelo configurado agora." };

export async function POST(req: Request) {
  let cookie: string | undefined;
  try {
    const real = (process.env.MCP_MODE ?? "mock") === "real";
    if (real) requireSameOriginJson(req); else requireMockRequest(req);
    const input = ConverseInputSchema.parse(await jsonBody(req));
    const resolved = visitorSessions.resolve(req, true); cookie = resolved.cookie;
    const subjectRef = resolved.visitor.conversation.subjectRef;
    if (real && !conectado(subjectRef)) return jsonResponse(LOGIN, 401, cookie);
    const provedor = process.env.LLM_PROVIDER;
    const nomeModelo = process.env.ATENDENTE_MODEL || process.env.LLM_MODEL;
    if (!provedor || !PROVEDORES.has(provedor) || !nomeModelo) return jsonResponse(SEM_LLM, 503, cookie);
    const domain: DomainPort = real ? await dominioRealDo(subjectRef) : fake;
    // O modelo é criado a cada turno (barato): nada de objeto antigo em cache segurando prompt ou configuração velhos.
    const modelo = await criarModelo(provedor as Provedor, nomeModelo);
    // Reserva opcional (mesmo provedor): assume quando o titular falha por cota, sobrecarga ou tempo.
    const nomeReserva = process.env.LLM_MODEL_RESERVA;
    const modeloReserva = nomeReserva && nomeReserva !== nomeModelo ? await criarModelo(provedor as Provedor, nomeReserva) : undefined;
    const reply = await visitorSessions.run(resolved.visitor, async (conversation) => {
      if (input.reiniciar) reiniciarAtendente(conversation.subjectRef);
      const s = (input.reiniciar ? reiniciarSessao : sessaoDo)(conversation.subjectRef);
      return executarAtendente(s, input, { modelo, nomeModelo, ...(modeloReserva ? { modeloReserva, nomeReserva } : {}), domain, nome: nomeConhecido(subjectRef) });
    });
    console.info(`[converse] mcp=${real ? "real" : "mock"} llm=${reply.llm} estado=${reply.estado} modelo=${reply.tempos.interpretarMs}ms dominio=${reply.tempos.dominioMs ?? "-"}ms total=${reply.tempos.totalMs}ms`);
    return jsonResponse(reply, 200, cookie);
  } catch (error) { return failureResponse(error, cookie); }
}
