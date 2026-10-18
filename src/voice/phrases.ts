// Frases que a VOZ fala por conta própria ou que o agente repete sempre iguais. Ficam sintetizadas de antemão:
// no servidor (tts-cache.ts, vale para todos os visitantes) e no navegador (player.preload).
// As do agente vêm de src/agent/frases.ts (contrato com o Hyago): se um texto mudar lá, o cache acompanha sozinho.
import { FRASES, FRASES_FIXAS } from "@/agent/frases";

// Tocada logo depois da fala reconhecida, quando o agente demora: neutra, serve para qualquer pedido.
// Reconhecimento duvidoso: a fala nem chega ao agente.
export const UNCLEAR_PHRASE = "Não entendi bem. Pode repetir?";

export const PRELOAD_PHRASES: readonly string[] = [UNCLEAR_PHRASE, ...FRASES_FIXAS];

// Frases de ESPERA (da voz e do agente): preenchem o silêncio, não são a resposta. Contam como "primeiro som" na medida
// de latência, mas nunca como "primeira palavra útil".
export const FILLER_TEXTS: ReadonlySet<string> = new Set([FRASES.espera]);
