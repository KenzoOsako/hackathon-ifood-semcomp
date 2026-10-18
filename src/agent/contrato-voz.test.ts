// Contrato voz × agente (docs/PLANO_INTEGRACAO_VOZ_AGENTE.md, Fase 0). Quebrou aqui: avise o Felipe.
import { describe, expect, it } from "vitest";
import { replyToEvents } from "@/voice/converse-client";
import { FRASES, FRASES_FIXAS, LIMIARES_CONFIANCA } from "./frases";
import { ConverseInputSchema } from "./types";

const sinais = { origem: "voz" as const, interrompeu: false, palavras: 5 };

describe("contrato voz × agente", () => {
  it("aceita a confiança do STT nos sinais e recusa valor fora de 0 a 1", () => {
    expect(ConverseInputSchema.parse({ texto: "pizza", origem: "voz", sinais: { ...sinais, confianca: 0.72 } }).sinais?.confianca).toBe(0.72);
    expect(ConverseInputSchema.safeParse({ texto: "pizza", origem: "voz", sinais: { ...sinais, confianca: 1.5 } }).success).toBe(false);
    expect(ConverseInputSchema.parse({ texto: "pizza", origem: "voz", sinais }).sinais?.confianca).toBeUndefined();
  });

  it("faixas de confiança em ordem dentro de 0 a 1", () => {
    expect(0 < LIMIARES_CONFIANCA.repetir && LIMIARES_CONFIANCA.repetir < LIMIARES_CONFIANCA.confirmar && LIMIARES_CONFIANCA.confirmar < 1).toBe(true);
  });

  it("frases fixas cabem num pedaço de fala, sem markdown e sem repetição", () => {
    for (const f of FRASES_FIXAS) {
      expect(f.length).toBeLessThanOrEqual(600);
      expect(f).not.toMatch(/[[\]*#]/);
    }
    expect(new Set(FRASES_FIXAS).size).toBe(FRASES_FIXAS.length);
  });

  it("a frase de espera do agente vira ack no cliente da voz, antes da fala", () => {
    const ev = replyToEvents({ resposta: "Montei o plano.", fraseEspera: FRASES.espera }, "t1");
    expect(ev[0]).toEqual({ type: "ack", text: FRASES.espera });
    expect(ev.at(-1)).toEqual({ type: "done", turnId: "t1" });
  });
});
