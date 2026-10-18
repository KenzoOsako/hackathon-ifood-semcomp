// Sinais que a voz entrega ao agente para ele decidir a profundidade da conversa (L0/L1/L2).
// Quem decide o nível é o Hyago (src/agent); aqui só medimos, sem interpretar.
import { z } from "zod";

export const VoiceSignalsSchema = z.strictObject({
  origem: z.enum(["voz", "texto"]),
  // palavras por segundo; ausente em texto ou quando não deu para medir
  velocidadeFala: z.number().nonnegative().max(20).optional(),
  // ms entre o microfone abrir e a primeira palavra
  silencioMs: z.number().int().nonnegative().max(120_000).optional(),
  // o usuário começou a falar por cima do agente
  interrompeu: z.boolean(),
  palavras: z.number().int().nonnegative().max(1000).optional(),
  // confiança do reconhecimento (0 a 1). Abaixo do limite da voz a fala nem chega ao agente; entre o limite e ~0,9 o agente pode confirmar.
  confianca: z.number().min(0).max(1).optional(),
});
export type VoiceSignals = z.infer<typeof VoiceSignalsSchema>;

export interface Utterance {
  transcript: string;
  micOpenedAt: number; // ms (performance.now ou Date.now, só a diferença importa)
  firstWordAt?: number;
  lastWordAt?: number;
  interrupted: boolean;
  confianca?: number;
}

export const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

export function computeSignals(u: Utterance): VoiceSignals {
  const palavras = countWords(u.transcript);
  const silencioMs = u.firstWordAt === undefined ? undefined : Math.max(0, Math.round(u.firstWordAt - u.micOpenedAt));
  const duracaoS = u.firstWordAt !== undefined && u.lastWordAt !== undefined ? (u.lastWordAt - u.firstWordAt) / 1000 : 0;
  // Frases curtas (<3 palavras) ou muito rápidas demais não dão taxa confiável.
  const velocidadeFala = palavras >= 3 && duracaoS >= 0.5 ? Math.min(20, Number((palavras / duracaoS).toFixed(2))) : undefined;
  return { origem: "voz", interrompeu: u.interrupted, palavras, ...(silencioMs !== undefined ? { silencioMs } : {}), ...(velocidadeFala !== undefined ? { velocidadeFala } : {}), ...(u.confianca !== undefined ? { confianca: Math.min(1, Math.max(0, Number(u.confianca.toFixed(3)))) } : {}) };
}

export const textSignals = (text: string): VoiceSignals => ({ origem: "texto", interrompeu: false, palavras: Math.min(1000, countWords(text)) });
