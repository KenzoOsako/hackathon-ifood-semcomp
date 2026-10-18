// Cache em memória do áudio das FRASES FIXAS (phrases.ts). Só aceita texto dessa lista: ninguém consegue encher a
// memória pedindo textos novos. Um acerto não chama a ElevenLabs nem gasta a cota de caracteres do visitante.
// Fica em globalThis para sobreviver ao recarregamento do servidor de desenvolvimento.
import { PRELOAD_PHRASES } from "./phrases";

const MAX_BYTES = 300_000; // uma frase curta em mp3 tem dezenas de KB; acima disso algo está errado
const g = globalThis as unknown as { __guideTtsCache?: Map<string, Uint8Array<ArrayBuffer>> };
const store = (g.__guideTtsCache ??= new Map());
const allowed = new Set<string>(PRELOAD_PHRASES);

export const isCacheablePhrase = (text: string): boolean => allowed.has(text);

export function getCachedAudio(text: string): Uint8Array<ArrayBuffer> | undefined {
  return store.get(text);
}

export function setCachedAudio(text: string, bytes: Uint8Array<ArrayBuffer>): void {
  if (!allowed.has(text) || bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return;
  store.set(text, bytes);
}

export function __resetTtsCacheForTests(): void {
  store.clear();
}
