// Controle mínimo de gasto de voz (caracteres sintetizados) por processo.
// Para o total do time, vale o painel da ElevenLabs. 0 = sem limite.
const g = globalThis as unknown as { __voiceChars?: number };

export const ttsBudget = () => {
  const v = process.env.TTS_CHAR_BUDGET;
  return v === undefined || v === "" ? 100_000 : Number(v);
};

export const ttsUsed = () => g.__voiceChars ?? 0;

export function assertTtsBudget(chars: number): void {
  const limit = ttsBudget();
  if (limit > 0 && ttsUsed() + chars > limit) throw new Error("TTS_BUDGET_EXCEEDED");
}

export function recordTts(chars: number): void {
  g.__voiceChars = ttsUsed() + chars;
}

export function __resetTtsForTests(): void {
  g.__voiceChars = 0;
}
