import { z } from "zod";
import { VoiceError, synthesize } from "@/voice/tts";
import { VoiceHttpError, readJson, requireSameOrigin, voiceHttpErrorResponse } from "@/voice/http-guard";

// Mesma política de origem do chat, sem depender de MCP_MODE. O cliente cai para a voz do navegador
// quando esta rota responde 503; a conversa nunca depende da voz.
const Schema = z.strictObject({
  text: z.string().trim().min(1).max(1200),
  previousText: z.string().trim().max(600).optional(),
  nextText: z.string().trim().max(600).optional(),
});

export async function POST(req: Request) {
  try {
    requireSameOrigin(req, ["application/json"]);
    const { text, previousText, nextText } = Schema.parse(await readJson(req));
    const audio = await synthesize(text, undefined, req.signal, { previousText, nextText });
    return new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VoiceHttpError) return voiceHttpErrorResponse(error);
    if (error instanceof z.ZodError) return voiceHttpErrorResponse(new VoiceHttpError("BAD_REQUEST"));
    if (error instanceof VoiceError) {
      const reply = error.code === "BUDGET" ? "Limite de voz atingido. Seguindo em texto." : "Voz indisponível. Seguindo em texto.";
      return Response.json({ state: "FALHA", code: "VOICE_" + error.code, reply }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ state: "FALHA", code: "UNAVAILABLE", reply: "Recurso indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
