// Frases que a VOZ fala por conta própria ou que o agente repete sempre iguais. Ficam sintetizadas de antemão:
// no servidor (tts-cache.ts, vale para todos os visitantes) e no navegador (player.preload).
// As do agente vêm de src/agent/frases.ts (contrato com o Hyago): se um texto mudar lá, o cache acompanha sozinho.
import { FRASES_FIXAS } from "@/agent/frases";

// Tocada logo depois da fala reconhecida, quando o agente demora: neutra, serve para qualquer pedido.
export const NEUTRAL_FILLER = "Hum, um instante.";
// Reconhecimento duvidoso: a fala nem chega ao agente.
export const UNCLEAR_PHRASE = "Não entendi bem. Pode repetir?";

export const PRELOAD_PHRASES: readonly string[] = [NEUTRAL_FILLER, UNCLEAR_PHRASE, ...FRASES_FIXAS];
