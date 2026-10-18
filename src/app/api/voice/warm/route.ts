import { VoiceHttpError, requireSameOrigin, voiceHttpErrorResponse, withVisitorCookie } from "@/voice/http-guard";
import { identifyVoiceVisitor, voiceLimits } from "@/voice/rate-limit";
import { warmUp } from "@/voice/tts";

// Chamada quando o usuário abre o microfone: aquece a conexão com o provedor de voz para a primeira fala
// não pagar a conexão fria. Sempre 204 (é só otimização) e não consome o limite de gasto.
export function POST(req: Request) {
  const who = identifyVoiceVisitor(req);
  const done = (res: Response) => withVisitorCookie(res, who.setCookie);
  try {
    requireSameOrigin(req, ["application/json"]);
    const lim = voiceLimits().check(who.id, who.isNew, "warm");
    if (!lim.ok) throw new VoiceHttpError("RATE_LIMITED", lim.retryAfterMs);
  } catch (error) {
    if (error instanceof VoiceHttpError) return done(voiceHttpErrorResponse(error));
    throw error;
  }
  // Sinal próprio: o da requisição aborta assim que a resposta sai e cancelaria o aquecimento antes de ele valer.
  void warmUp(undefined, AbortSignal.timeout(4000));
  return done(new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }));
}
