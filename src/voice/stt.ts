// Reconhecimento de fala no SERVIDOR (a chave nunca vai ao navegador). ElevenLabs Scribe, em lote:
// o navegador manda o áudio de UMA fala (segurar para falar) e recebe o texto.
import { assertSttBudget, recordStt } from "./budget";
import { looksLikeInjection, redactSensitive } from "./guard";

export class SttError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "BUDGET" | "PROVIDER" | "EMPTY") {
    super(code);
  }
}

export interface SttConfig {
  apiKey?: string;
  modelId: string;
}

export function sttConfig(env: NodeJS.ProcessEnv = process.env): SttConfig {
  return { apiKey: env.ELEVENLABS_API_KEY || undefined, modelId: env.ELEVENLABS_STT_MODEL || "scribe_v2" };
}

export interface SttResult {
  texto: string; // já sem dados sensíveis
  confianca?: number; // 0 a 1, média da confiança por palavra
  duracaoS?: number;
  redacoes: string[]; // tipos de dado sensível removidos (nunca o valor)
  injecao: boolean; // heurística: tentativa de manipular o agente
}

interface ScribeWord {
  type?: string;
  logprob?: number;
}
interface ScribeResponse {
  text?: string;
  audio_duration_secs?: number;
  words?: ScribeWord[];
}

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav" };

export function confidenceFrom(words: ScribeWord[] | undefined): number | undefined {
  const lp = (words ?? []).filter((w) => w.type === "word" && typeof w.logprob === "number").map((w) => w.logprob as number);
  if (lp.length === 0) return undefined;
  const mean = lp.reduce((a, b) => a + b, 0) / lp.length;
  return Math.min(1, Math.max(0, Number(Math.exp(mean).toFixed(3))));
}

// Uma chamada ao provedor. Devolve o JSON ou lança PROVIDER.
async function callScribe(audio: Uint8Array, mime: string, cfg: SttConfig, keyterms: string[], signal?: AbortSignal): Promise<ScribeResponse> {
  const form = new FormData();
  form.append("model_id", cfg.modelId);
  form.append("language_code", "por");
  form.append("tag_audio_events", "false"); // sem "(risos)" no meio da transcrição
  for (const k of keyterms) form.append("keyterms", k); // vocabulário do contexto (lojas, itens)
  form.append("file", new Blob([audio as BlobPart], { type: mime }), `fala.${EXT[mime] ?? "webm"}`);
  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": cfg.apiKey! }, body: form, signal });
  } catch {
    throw new SttError("PROVIDER");
  }
  if (!res.ok) {
    // Só o status (nunca o corpo nem o áudio): para saber, no log do servidor, por que o provedor recusou.
    console.warn(`[stt] provedor respondeu ${res.status} (palavras-chave: ${keyterms.length})`);
    throw new SttError("PROVIDER");
  }
  try {
    return (await res.json()) as ScribeResponse;
  } catch {
    throw new SttError("PROVIDER");
  }
}

export async function transcribe(audio: Uint8Array, mime: string, cfg: SttConfig = sttConfig(), signal?: AbortSignal, keyterms: string[] = []): Promise<SttResult> {
  if (!cfg.apiKey) throw new SttError("NOT_CONFIGURED");
  try {
    assertSttBudget();
  } catch {
    throw new SttError("BUDGET");
  }
  let data: ScribeResponse;
  let retriedWithoutTerms = false; // a nova tentativa sem palavras-chave só acontece uma vez, por qualquer motivo
  try {
    data = await callScribe(audio, mime, cfg, keyterms, signal);
  } catch (error) {
    // O provedor pode recusar as palavras-chave (limites que mudam); sem elas a fala ainda é reconhecida.
    if (!(error instanceof SttError) || error.code !== "PROVIDER" || keyterms.length === 0 || signal?.aborted) throw error;
    retriedWithoutTerms = true;
    data = await callScribe(audio, mime, cfg, [], signal);
  }
  // Medido na bateria de 17/10: com palavras-chave, uma fala saiu VAZIA e sem elas saiu certa. Tenta uma vez sem
  // (a menos que a tentativa sem palavras-chave já tenha acontecido acima: aí vazio é vazio, no máximo duas chamadas).
  if (!(data.text ?? "").trim() && keyterms.length > 0 && !retriedWithoutTerms) data = await callScribe(audio, mime, cfg, [], signal);
  if (data.audio_duration_secs) recordStt(data.audio_duration_secs);
  const raw = (data.text ?? "").trim();
  if (!raw) throw new SttError("EMPTY");
  const injecao = looksLikeInjection(raw);
  const red = redactSensitive(raw);
  return { texto: red.text, confianca: confidenceFrom(data.words), duracaoS: data.audio_duration_secs, redacoes: red.found, injecao };
}
