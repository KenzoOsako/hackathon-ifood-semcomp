import { orderStatus } from "@/agent/agent";

export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId) return Response.json({ error: "orderId obrigatório" }, { status: 400 });
  try {
    return Response.json(await orderStatus(orderId));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 404 });
  }
}
