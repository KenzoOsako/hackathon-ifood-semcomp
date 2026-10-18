import { SttError, transcribe } from "@/voice/stt";
import { VoiceHttpError, readLimited, requireSameOrigin, voiceHttpErrorResponse, withVisitorCookie } from "@/voice/http-guard";
import { termsFromUrl } from "@/voice/keyterms";
import { identifyVoiceVisitor, voiceLimits } from "@/voice/rate-limit";

// Recebe o áudio de UMA fala no corpo (audio/*) e devolve o texto. Mesma política de origem do chat, mais limite
// por visitante. Se a voz falhar (503), a tela segue em texto: a conversa nunca depende do reconhecimento.
const MAX_BYTES = 2_000_000; // ~1 minuto de áudio comprimido
const MIN_BYTES = 800; // abaixo disso não há fala
const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"];
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const who = identifyVoiceVisitor(req);
  const done = (res: Response) => withVisitorCookie(res, who.setCookie);
  try {
    requireSameOrigin(req, AUDIO_TYPES);
    const lim = voiceLimits().check(who.id, who.isNew, "stt");
    if (!lim.ok) throw new VoiceHttpError("RATE_LIMITED", lim.retryAfterMs);
    const mime = req.headers.get("content-type")!.split(";")[0].trim().toLowerCase();
    const audio = await readLimited(req, MAX_BYTES);
    if (audio.byteLength < MIN_BYTES) throw new VoiceHttpError("BAD_REQUEST");
    const result = await transcribe(audio, mime, undefined, req.signal, termsFromUrl(req.url));
    return done(Response.json(result, { headers: NO_STORE }));
  } catch (error) {
    if (error instanceof VoiceHttpError) return done(voiceHttpErrorResponse(error));
    if (error instanceof SttError) {
      if (error.code === "EMPTY") return done(Response.json({ state: "FALHA", code: "VOICE_EMPTY", reply: "Não consegui ouvir. Pode repetir?" }, { status: 422, headers: NO_STORE }));
      const reply = error.code === "BUDGET" ? "Limite de voz atingido. Seguindo em texto." : "Reconhecimento indisponível. Seguindo em texto.";
      return done(Response.json({ state: "FALHA", code: "VOICE_" + error.code, reply }, { status: 503, headers: NO_STORE }));
    }
    return done(Response.json({ state: "FALHA", code: "UNAVAILABLE", reply: "Recurso indisponível." }, { status: 503, headers: NO_STORE }));
  }
}
