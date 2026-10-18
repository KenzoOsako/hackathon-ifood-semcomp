import { visitorSessions } from "@/agent/visitor-session";
import { jsonResponse } from "@/agent/http";
import { conectado } from "@/mcp/real/oauth";

// Para a UI saber se mostra "Conectar iFood". Não expõe token nem dado da conta.
export async function GET(req: Request) {
  const modo = "real"; // o Guide só usa dados reais do iFood
  try {
    const { visitor } = visitorSessions.resolve(req, false);
    return jsonResponse({ modo, conectado: conectado(visitor.conversation.subjectRef) });
  } catch {
    return jsonResponse({ modo, conectado: false });
  }
}
