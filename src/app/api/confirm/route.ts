import { confirmOrder } from "@/agent/agent";

// `explicit` só é true quando a INTERFACE registrou uma ação clara da pessoa (botão ou frase validada).
export async function POST(req: Request) {
  const { sessionId, explicit } = (await req.json()) as { sessionId: string; explicit: boolean };
  try {
    return Response.json(await confirmOrder(sessionId, explicit === true));
  } catch (e) {
    return Response.json({ state: "FALHA", reply: `Algo deu errado: ${(e as Error).message}` }, { status: 500 });
  }
}
