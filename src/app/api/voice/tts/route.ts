import { z } from "zod";
import { VoiceError, synthesize } from "@/voice/tts";
import { VoiceHttpError, readJson, requireSameOrigin, voiceHttpErrorResponse, withVisitorCookie } from "@/voice/http-guard";
import { identifyVoiceVisitor, voiceLimits } from "@/voice/rate-limit";

// Mesma política de origem do chat, mais limite por visitante, sem depender de MCP_MODE. O cliente cai para a voz
// do navegador quando esta rota responde 503/429; a conversa nunca depende da voz.
const Schema = z.strictObject({
  text: z.string().trim().min(1).max(1200),
  previousText: z.string().trim().max(600).optional(),
  nextText: z.string().trim().max(600).optional(),
});
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const who = identifyVoiceVisitor(req);
  const done = (res: Response) => withVisitorCookie(res, who.setCookie);
  try {
    requireSameOrigin(req, ["application/json"]);
    const { text, previousText, nextText } = Schema.parse(await readJson(req));
    const lim = voiceLimits().check(who.id, who.isNew, "tts", text.length);
    if (!lim.ok) throw new VoiceHttpError("RATE_LIMITED", lim.retryAfterMs);
    const audio = await synthesize(text, undefined, req.signal, { previousText, nextText });
    return done(new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg", ...NO_STORE } }));
  } catch (error) {
    if (error instanceof VoiceHttpError) return done(voiceHttpErrorResponse(error));
    if (error instanceof z.ZodError) return done(voiceHttpErrorResponse(new VoiceHttpError("BAD_REQUEST")));
    if (error instanceof VoiceError) {
      const reply = error.code === "BUDGET" ? "Limite de voz atingido. Seguindo em texto." : "Voz indisponível. Seguindo em texto.";
      return done(Response.json({ state: "FALHA", code: "VOICE_" + error.code, reply }, { status: 503, headers: NO_STORE }));
    }
    return done(Response.json({ state: "FALHA", code: "UNAVAILABLE", reply: "Recurso indisponível." }, { status: 503, headers: NO_STORE }));
  }
}
