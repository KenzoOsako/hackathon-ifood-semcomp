import { totals } from "@/usage/meter";

// Consumo desta máquina/pessoa. O total do time está nos painéis dos provedores.
export async function GET() {
  return Response.json(totals());
}
