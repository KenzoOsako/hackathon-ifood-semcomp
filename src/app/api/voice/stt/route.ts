import { SttError, transcribe } from "@/voice/stt";
import { VoiceHttpError, readLimited, requireSameOrigin, voiceHttpErrorResponse } from "@/voice/http-guard";

// Recebe o áudio de UMA fala no corpo (audio/*) e devolve o texto. Mesma política de origem do chat.
// Se a voz falhar (503), a tela segue em texto: a conversa nunca depende do reconhecimento.
const MAX_BYTES = 2_000_000; // ~1 minuto de áudio comprimido
const MIN_BYTES = 800; // abaixo disso não há fala
const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"];

export async function POST(req: Request) {
  try {
    requireSameOrigin(req, AUDIO_TYPES);
    const mime = req.headers.get("content-type")!.split(";")[0].trim().toLowerCase();
    const audio = await readLimited(req, MAX_BYTES);
    if (audio.byteLength < MIN_BYTES) throw new VoiceHttpError("BAD_REQUEST");
    const result = await transcribe(audio, mime, undefined, req.signal);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VoiceHttpError) return voiceHttpErrorResponse(error);
    if (error instanceof SttError) {
      if (error.code === "EMPTY") return Response.json({ state: "FALHA", code: "VOICE_EMPTY", reply: "Não consegui ouvir. Pode repetir?" }, { status: 422, headers: { "Cache-Control": "no-store" } });
      const reply = error.code === "BUDGET" ? "Limite de voz atingido. Seguindo em texto." : "Reconhecimento indisponível. Seguindo em texto.";
      return Response.json({ state: "FALHA", code: "VOICE_" + error.code, reply }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ state: "FALHA", code: "UNAVAILABLE", reply: "Recurso indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
