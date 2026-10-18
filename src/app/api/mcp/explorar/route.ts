import { mkdirSync, writeFileSync } from "node:fs";
import { visitorSessions } from "@/agent/visitor-session";
import { jsonResponse } from "@/agent/http";
import { explorar } from "@/agent/mcp-explorar";
import { listarFerramentas, mcpToolsDo } from "@/mcp/real/client";
import { conectado } from "@/mcp/real/oauth";

const LOGIN = { state: "FALHA", code: "IFOOD_LOGIN", reply: "Faça o login do iFood primeiro.", loginUrl: "/api/auth/login" };

// Varredura do MCP real (formato das respostas, sem valores pessoais). SÓ no seu computador, com TELEMETRIA=1, MCP_MODE=real
// e a conta do iFood conectada (/api/auth/login). ?gravar=1 salva o resultado em quality/mcp-formas.json.
export async function GET(req: Request) {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  if (process.env.TELEMETRIA !== "1" || (process.env.MCP_MODE ?? "mock") !== "real" || !["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    return jsonResponse({ state: "FALHA", code: "DESLIGADA", reply: "Varredura desligada: precisa de TELEMETRIA=1, MCP_MODE=real e localhost." }, 404);
  }
  let subjectRef: string;
  try { subjectRef = visitorSessions.resolve(req, false).visitor.conversation.subjectRef; } catch { return jsonResponse(LOGIN, 401); }
  if (!conectado(subjectRef)) return jsonResponse(LOGIN, 401);
  const vivas = await listarFerramentas(subjectRef).catch(() => []);
  const v = await explorar(mcpToolsDo(subjectRef), vivas, Date.now, 8000);
  if (new URL(req.url).searchParams.get("gravar") === "1") {
    mkdirSync("quality", { recursive: true });
    writeFileSync("quality/mcp-formas.json", JSON.stringify(v, null, 2));
  }
  return jsonResponse(v);
}
