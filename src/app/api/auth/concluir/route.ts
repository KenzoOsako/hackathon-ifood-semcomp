import { visitorSessions } from "@/agent/visitor-session";
import { esquecerDominio } from "@/agent/domain-mcp/por-sujeito";
import { fecharCliente } from "@/mcp/real/client";
import { concluirLogin } from "@/mcp/real/oauth";

// Troca o código por token só se o cookie for do mesmo visitante que iniciou o login.
export async function GET(req: Request) {
  const state = new URL(req.url).searchParams.get("state") ?? "";
  try {
    const { visitor } = visitorSessions.resolve(req, false);
    const subjectRef = visitor.conversation.subjectRef;
    await concluirLogin(state, subjectRef);
    // Nova conta conectada: descartar cliente e domínio antigos desta sessão.
    esquecerDominio(subjectRef); await fecharCliente(subjectRef);
    return new Response(null, { status: 302, headers: { Location: "/agente?ifood=conectado", "Cache-Control": "no-store" } });
  } catch {
    return new Response("Não foi possível concluir o login iFood. Volte ao app e conecte de novo.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
