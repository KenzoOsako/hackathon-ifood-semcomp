import { handleMessage } from "@/agent/agent";
import { z } from "zod";
import { visitorSessions } from "@/agent/visitor-session";
import { failureResponse, jsonBody, jsonResponse, requireMockRequest } from "@/agent/http";

// sessionId legado aceito apenas para compatibilidade; nunca define identidade.
const ChatSchema = z.strictObject({ message: z.string().trim().min(1).max(4000), sessionId: z.string().max(100).optional() });

export async function POST(req: Request) {
  let cookie: string | undefined;
  try {
    requireMockRequest(req);
    const { message } = ChatSchema.parse(await jsonBody(req));
    const resolved = visitorSessions.resolve(req, true); cookie = resolved.cookie;
    const turn = await visitorSessions.run(resolved.visitor, (conversation) => handleMessage(conversation, message));
    return jsonResponse(turn, 200, cookie);
  } catch (error) { return failureResponse(error, cookie); }
}
