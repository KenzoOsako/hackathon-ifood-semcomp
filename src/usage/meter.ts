// Controle de gastos: mede tokens (LLM), caracteres (TTS) e segundos (STT) POR PESSOA, localmente.
// Grava em .usage/usage.jsonl (ignorado pelo git). O total do TIME vem dos painéis dos provedores;
// aqui o objetivo é cada um enxergar o próprio consumo e parar antes de estourar o limite.
//
// Como usar (frente Agente e MCP / Voz):
//   assertBudget("llm");                              // ANTES de chamar o modelo
//   const r = await chamarModelo(...);
//   record({ kind: "llm", provider: "anthropic", model, inputTokens, outputTokens });  // DEPOIS
import fs from "node:fs";
import path from "node:path";

export type UsageKind = "llm" | "tts" | "stt";

export interface UsageEvent {
  at: string;
  dev: string;
  kind: UsageKind;
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  chars?: number; // TTS
  seconds?: number; // STT
  note?: string;
}

const g = globalThis as unknown as { __usage?: UsageEvent[] };

function file() {
  return process.env.USAGE_FILE ?? path.join(process.cwd(), ".usage", "usage.jsonl");
}

function load(): UsageEvent[] {
  if (g.__usage) return g.__usage;
  g.__usage = [];
  try {
    const raw = fs.readFileSync(file(), "utf-8");
    g.__usage = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as UsageEvent);
  } catch {
    // sem arquivo ainda
  }
  return g.__usage;
}

export function record(e: Omit<UsageEvent, "at" | "dev">) {
  const ev: UsageEvent = { at: new Date().toISOString(), dev: process.env.DEV_NAME ?? "dev", ...e };
  load().push(ev);
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.appendFileSync(file(), JSON.stringify(ev) + "\n");
  } catch {
    // medir não pode derrubar a demo
  }
  return ev;
}

const num = (v: string | undefined, def: number) => (v === undefined || v === "" ? def : Number(v));

export function budgets() {
  return {
    llmTokens: num(process.env.LLM_TOKEN_BUDGET, 2_000_000),
    ttsChars: num(process.env.TTS_CHAR_BUDGET, 200_000),
    sttSeconds: num(process.env.STT_SECONDS_BUDGET, 3_600),
  };
}

export function totals() {
  const ev = load();
  const sum = (k: UsageKind, f: (e: UsageEvent) => number) => ev.filter((e) => e.kind === k).reduce((a, e) => a + f(e), 0);
  const input = sum("llm", (e) => e.inputTokens ?? 0);
  const output = sum("llm", (e) => e.outputTokens ?? 0);
  const pin = num(process.env.LLM_PRICE_IN_PER_MTOK, NaN);
  const pout = num(process.env.LLM_PRICE_OUT_PER_MTOK, NaN);
  const b = budgets();
  const costUsd = Number.isNaN(pin) || Number.isNaN(pout) ? null : (input * pin + output * pout) / 1_000_000;
  const chars = sum("tts", (e) => e.chars ?? 0);
  const seconds = sum("stt", (e) => e.seconds ?? 0);
  return {
    dev: process.env.DEV_NAME ?? "dev",
    llm: { inputTokens: input, outputTokens: output, totalTokens: input + output, budget: b.llmTokens, costUsd },
    tts: { chars, budget: b.ttsChars },
    stt: { seconds, budget: b.sttSeconds },
  };
}

// Lança erro quando o limite da pessoa é atingido (0 = sem limite). Mostre a mensagem ao usuário.
export function assertBudget(kind: UsageKind) {
  const t = totals();
  const b = budgets();
  const over =
    (kind === "llm" && b.llmTokens > 0 && t.llm.totalTokens >= b.llmTokens) ||
    (kind === "tts" && b.ttsChars > 0 && t.tts.chars >= b.ttsChars) ||
    (kind === "stt" && b.sttSeconds > 0 && t.stt.seconds >= b.sttSeconds);
  if (over) throw new Error(`Limite de gasto atingido (${kind}). Ajuste no .env ou fale com o time.`);
}

// Só para testes.
export function __resetForTests() {
  g.__usage = undefined;
}
