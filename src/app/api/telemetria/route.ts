import { jsonResponse } from "@/agent/http";
import { resumo, ultimosTurnos } from "@/agent/telemetria";

// Observabilidade do agente (resumo + últimos turnos, SEM texto do usuário). Desligada por padrão: só responde com
// TELEMETRIA=1 e a partir do próprio computador (localhost). O Host é só uma trava de demo (forjável): antes de publicar, trocar por autorização e restrição de ambiente. Não vai a nenhum terceiro.
export async function GET(req: Request) {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  if (process.env.TELEMETRIA !== "1" || !["localhost", "127.0.0.1", "[::1]"].includes(host)) return jsonResponse({ state: "FALHA", code: "DESLIGADA", reply: "Telemetria desligada." }, 404);
  return jsonResponse({ resumo: resumo(), turnos: ultimosTurnos(50) });
}
