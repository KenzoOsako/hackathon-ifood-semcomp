import { describe, expect, it } from "vitest";
import { FRASES, FRASES_FIXAS } from "@/agent/frases";
import { NEUTRAL_FILLER, PRELOAD_PHRASES, UNCLEAR_PHRASE } from "./phrases";
import { speakableIssues } from "./speakable";

describe("frases fixas da voz", () => {
  it("inclui as do agente (import direto: se um texto mudar lá, o cache acompanha)", () => {
    for (const f of FRASES_FIXAS) expect(PRELOAD_PHRASES).toContain(f);
    expect(PRELOAD_PHRASES).toContain(FRASES.espera);
  });
  it("inclui as duas da própria voz, sem repetição", () => {
    expect(PRELOAD_PHRASES).toContain(NEUTRAL_FILLER);
    expect(PRELOAD_PHRASES).toContain(UNCLEAR_PHRASE);
    expect(new Set(PRELOAD_PHRASES).size).toBe(PRELOAD_PHRASES.length);
  });
  it("todas servem para ser faladas e cabem no limite da rota de TTS", () => {
    for (const f of PRELOAD_PHRASES) {
      expect(speakableIssues(f), f).toEqual([]);
      expect(f.length).toBeLessThanOrEqual(600);
    }
  });
});
