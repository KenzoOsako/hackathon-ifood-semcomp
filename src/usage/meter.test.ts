import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { __resetForTests, assertBudget, record, totals } from "./meter";

beforeEach(() => {
  process.env.USAGE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "usage-")), "u.jsonl");
  process.env.LLM_TOKEN_BUDGET = "1000";
  process.env.TTS_CHAR_BUDGET = "500";
  delete process.env.LLM_PRICE_IN_PER_MTOK;
  delete process.env.LLM_PRICE_OUT_PER_MTOK;
  __resetForTests();
});

describe("meter", () => {
  it("soma tokens, caracteres e segundos", () => {
    record({ kind: "llm", provider: "x", inputTokens: 100, outputTokens: 50 });
    record({ kind: "tts", provider: "elevenlabs", chars: 120 });
    record({ kind: "stt", provider: "elevenlabs", seconds: 8 });
    const t = totals();
    expect(t.llm.totalTokens).toBe(150);
    expect(t.tts.chars).toBe(120);
    expect(t.stt.seconds).toBe(8);
    expect(t.llm.costUsd).toBeNull();
  });

  it("estima custo só quando os preços estão configurados", () => {
    process.env.LLM_PRICE_IN_PER_MTOK = "3";
    process.env.LLM_PRICE_OUT_PER_MTOK = "15";
    record({ kind: "llm", provider: "x", inputTokens: 1_000_000, outputTokens: 100_000 });
    expect(totals().llm.costUsd).toBeCloseTo(4.5);
  });

  it("bloqueia ao atingir o limite", () => {
    record({ kind: "llm", provider: "x", inputTokens: 900, outputTokens: 100 });
    expect(() => assertBudget("llm")).toThrow(/Limite de gasto/);
    expect(() => assertBudget("tts")).not.toThrow();
  });

  it("restaura o consumo do arquivo depois de reiniciar", () => {
    record({ kind: "llm", provider: "x", inputTokens: 10, outputTokens: 5 });
    __resetForTests();
    expect(totals().llm.totalTokens).toBe(15);
  });
});
