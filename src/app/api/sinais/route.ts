import { jsonResponse } from "@/agent/http";
import { agregarSinais } from "@/data/sinais";
import { connection } from "next/server";

// Só agregados (contagens), nunca sinais individuais.
export async function GET() {
  // Contagens em RAM devem ser lidas por requisição, nunca congeladas no build.
  await connection();
  // Com o catálogo simulado, "sem oferta" fala do mock e não do iFood: o painel precisa dizer isso.
  const origem = (process.env.MCP_MODE ?? "mock") === "real" ? "real" : "simulado";
  return jsonResponse({ origem, agregados: agregarSinais() });
}
