import { visitorSessions } from "@/agent/visitor-session";
import { jsonResponse } from "@/agent/http";
import { carregarNome } from "@/agent/perfil";
import { mcpToolsDo } from "@/mcp/real/client";
import { conectado } from "@/mcp/real/oauth";

// Primeiro nome da pessoa para a saudação ({ nome } ou {}). Nunca devolve sobrenome, e-mail nem telefone.
export async function GET(req: Request) {
  const real = (process.env.MCP_MODE ?? "mock") === "real";
  try {
    const subjectRef = visitorSessions.resolve(req, false).visitor.conversation.subjectRef;
    const nome = await carregarNome(subjectRef, real && conectado(subjectRef) ? mcpToolsDo(subjectRef) : undefined);
    return jsonResponse(nome ? { nome } : {});
  } catch {
    // Sem sessão ainda: só o nome combinado da demo, se houver.
    const nome = await carregarNome("sem-sessao", undefined);
    return jsonResponse(nome ? { nome } : {});
  }
}
