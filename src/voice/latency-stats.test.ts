import { describe, expect, it } from "vitest";
import { percentile, summarizeRounds } from "./latency";

describe("percentil", () => {
  it("mediana e p95 por interpolação", () => {
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([100, 200, 300, 400, 500], 0.95)).toBeCloseTo(480);
  });
  it("não depende da ordem e lida com um valor só e com vazio", () => {
    expect(percentile([50, 10, 30], 0.5)).toBe(30);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([], 0.5)).toBeNaN();
  });
});

describe("summarizeRounds", () => {
  const rounds = [
    { sttMs: 2000, backendFirstChunkMs: 900, ttsFirstByteMs: 800, timeToFirstAudioMs: 4000 }, // 1ª: aquecimento
    { sttMs: 500, backendFirstChunkMs: 100, ttsFirstByteMs: 300, timeToFirstAudioMs: 900 },
    { sttMs: 600, backendFirstChunkMs: 200, ttsFirstByteMs: 350, timeToFirstAudioMs: 1100 },
    { sttMs: 700, backendFirstChunkMs: 300, ttsFirstByteMs: 400, timeToFirstAudioMs: 1300 },
  ];
  it("descarta a 1ª rodada quando pedido", () => {
    const s = summarizeRounds(rounds, { skipFirst: true });
    expect(s.sttMs).toEqual({ n: 3, p50: 600, p95: 690, max: 700 });
    expect(s.timeToFirstAudioMs?.p50).toBe(1100);
  });
  it("sem descartar, o aquecimento entra nas contas", () => {
    expect(summarizeRounds(rounds).sttMs?.max).toBe(2000);
  });
  it("etapa ausente em alguma rodada é ignorada, e sem dados não inventa estatística", () => {
    const s = summarizeRounds([{ sttMs: 500 }, { sttMs: 700, timeToFirstAudioMs: 1000 }]);
    expect(s.sttMs?.n).toBe(2);
    expect(s.timeToFirstAudioMs?.n).toBe(1);
    expect(s.ttsFirstByteMs).toBeUndefined();
    expect(summarizeRounds([])).toEqual({});
  });
});
