import { jsonResponse } from "@/agent/http";
import { agregarSinais } from "@/data/sinais";

// Só agregados (contagens), nunca sinais individuais.
export function GET() {
  // Com o catálogo simulado, "sem oferta" fala do mock e não do iFood: o painel precisa dizer isso.
  const origem = (process.env.MCP_MODE ?? "mock") === "real" ? "real" : "simulado";
  return jsonResponse({ origem, agregados: agregarSinais() });
}
