import { requireSameOrigin, voiceHttpErrorResponse, VoiceHttpError } from "@/voice/http-guard";
import { warmUp } from "@/voice/tts";

// Chamada quando o usuário abre o microfone: aquece a conexão com o provedor de voz para a primeira fala
// não pagar a conexão fria. Sempre 204 (é só otimização) e não consome o limite de gasto.
export async function POST(req: Request) {
  try {
    requireSameOrigin(req, ["application/json"]);
  } catch (error) {
    if (error instanceof VoiceHttpError) return voiceHttpErrorResponse(error);
    throw error;
  }
  // Sinal próprio: o da requisição aborta assim que a resposta sai e cancelaria o aquecimento antes de ele valer.
  void warmUp(undefined, AbortSignal.timeout(4000));
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
