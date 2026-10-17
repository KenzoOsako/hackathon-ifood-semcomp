import { handleMessage } from "@/agent/agent";

export async function POST(req: Request) {
  const { sessionId, message } = (await req.json()) as { sessionId: string; message: string };
  try {
    return Response.json(await handleMessage(sessionId, message));
  } catch (e) {
    return Response.json({ state: "FALHA", reply: `Algo deu errado: ${(e as Error).message}` }, { status: 500 });
  }
}
