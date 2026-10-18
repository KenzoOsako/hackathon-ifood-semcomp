import { z } from "zod";
import { failureResponse, jsonBody, jsonResponse, requireMockRequest } from "@/agent/http";
import { VoiceError, synthesize } from "@/voice/tts";

// Mesmos guardas do chat (origem, JSON limitado, sem cache). O cliente cai para a voz do navegador
// quando esta rota responde 503; a conversa nunca depende da voz.
const Schema = z.strictObject({ text: z.string().trim().min(1).max(1200) });

export async function POST(req: Request) {
  try {
    requireMockRequest(req);
    const { text } = Schema.parse(await jsonBody(req));
    const audio = await synthesize(text, undefined, req.signal);
    return new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VoiceError) {
      const reply = error.code === "BUDGET" ? "Limite de voz atingido. Seguindo em texto." : "Voz indisponível. Seguindo em texto.";
      return jsonResponse({ state: "FALHA", code: "VOICE_" + error.code, reply }, 503);
    }
    return failureResponse(error);
  }
}
