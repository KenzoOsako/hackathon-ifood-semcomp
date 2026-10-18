// Síntese de fala no SERVIDOR (a chave nunca vai ao navegador). ElevenLabs, em fluxo.
import { assertTtsBudget, recordTts } from "./budget";
import { toSpeech } from "./speech-text";

export class VoiceError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "BUDGET" | "PROVIDER") {
    super(code);
  }
}

export interface TtsConfig {
  apiKey?: string;
  voiceId?: string;
  modelId: string;
}

export function ttsConfig(env: NodeJS.ProcessEnv = process.env): TtsConfig {
  return {
    apiKey: env.ELEVENLABS_API_KEY || undefined,
    voiceId: env.ELEVENLABS_VOICE_ID || undefined,
    // Flash: menor latência; o modelo é trocável por variável de ambiente.
    modelId: env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
  };
}

// Devolve o corpo de áudio (mp3) do provedor para ser repassado em fluxo.
// `context` (texto vizinho) ajuda o modelo a manter a entonação entre pedaços de uma mesma resposta.
export interface TtsContext {
  previousText?: string;
  nextText?: string;
}

export async function synthesize(text: string, cfg: TtsConfig = ttsConfig(), signal?: AbortSignal, context: TtsContext = {}): Promise<ReadableStream<Uint8Array>> {
  if (!cfg.apiKey || !cfg.voiceId) throw new VoiceError("NOT_CONFIGURED");
  const spoken = toSpeech(text);
  if (!spoken) throw new VoiceError("PROVIDER");
  try {
    assertTtsBudget(spoken.length);
  } catch {
    throw new VoiceError("BUDGET");
  }
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.voiceId)}/stream?output_format=mp3_44100_64`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": cfg.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: spoken,
        model_id: cfg.modelId,
        language_code: "pt",
        ...(context.previousText ? { previous_text: toSpeech(context.previousText) } : {}),
        ...(context.nextText ? { next_text: toSpeech(context.nextText) } : {}),
      }),
      signal,
    });
  } catch {
    throw new VoiceError("PROVIDER");
  }
  if (!res.ok || !res.body) throw new VoiceError("PROVIDER");
  recordTts(spoken.length);
  return res.body;
}

// Abre a conexão com o provedor antes de a primeira fala precisar dela (a primeira chamada fria custa ~1 s a mais).
// Chamada autenticada e sem custo de síntese; falha silenciosa: é só otimização.
export async function warmUp(cfg: TtsConfig = ttsConfig(), signal?: AbortSignal): Promise<void> {
  if (!cfg.apiKey) return;
  try {
    await fetch("https://api.elevenlabs.io/v1/models", { headers: { "xi-api-key": cfg.apiKey }, signal });
  } catch {
    // sem efeito: a fala funciona do mesmo jeito, só pode demorar mais na primeira vez
  }
}
