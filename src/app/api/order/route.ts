import { jsonResponse } from "@/agent/http";

export async function GET() {
  return jsonResponse({ code: "NOT_SUPPORTED", reply: "Mimo não envia pedidos. Compra e acompanhamento final ocorrem no iFood; tracking externo não foi validado." }, 410);
}
