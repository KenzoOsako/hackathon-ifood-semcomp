// Controle mínimo de gasto de voz por processo (TTS em caracteres, STT em segundos).
// Para o total do time, vale o painel da ElevenLabs. 0 = sem limite.
const g = globalThis as unknown as { __voiceChars?: number; __voiceSecs?: number };

const num = (v: string | undefined, def: number) => (v === undefined || v === "" ? def : Number(v));

export const ttsBudget = () => num(process.env.TTS_CHAR_BUDGET, 100_000);
export const ttsUsed = () => g.__voiceChars ?? 0;

export function assertTtsBudget(chars: number): void {
  const limit = ttsBudget();
  if (limit > 0 && ttsUsed() + chars > limit) throw new Error("TTS_BUDGET_EXCEEDED");
}

export function recordTts(chars: number): void {
  g.__voiceChars = ttsUsed() + chars;
}

export const sttBudget = () => num(process.env.STT_SECONDS_BUDGET, 3_600);
export const sttUsed = () => g.__voiceSecs ?? 0;

// A duração só é conhecida depois da transcrição; antes, bloqueia se o limite já foi atingido.
export function assertSttBudget(): void {
  const limit = sttBudget();
  if (limit > 0 && sttUsed() >= limit) throw new Error("STT_BUDGET_EXCEEDED");
}

export function recordStt(seconds: number): void {
  g.__voiceSecs = sttUsed() + Math.max(0, seconds);
}

export function __resetTtsForTests(): void {
  g.__voiceChars = 0;
  g.__voiceSecs = 0;
}
