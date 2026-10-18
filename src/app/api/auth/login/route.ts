import { visitorSessions } from "@/agent/visitor-session";
import { iniciarLogin, OAuthError } from "@/mcp/real/oauth";

// Navegação de topo (link "Conectar iFood"): cria/usa a sessão de visitante e manda para o login do iFood.
export async function GET(req: Request) {
  try {
    const resolved = visitorSessions.resolve(req, true);
    const url = iniciarLogin(resolved.visitor.conversation.subjectRef);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", ...(resolved.cookie ? { "Set-Cookie": resolved.cookie } : {}) } });
  } catch (error) {
    const msg = error instanceof OAuthError && error.code === "CONFIG" ? "Login iFood não configurado neste servidor." : "Não foi possível iniciar o login iFood.";
    return new Response(msg, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
