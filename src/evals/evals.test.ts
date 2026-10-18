// Sem configuração: roda com o interpretador por regras (offline, determinístico).
// Com LLM real: EVAL_REAL=1 LLM_PROVIDER=... LLM_MODEL=... npx vitest run src/evals
// Cota gratuita: cada turno faz até 2 chamadas; a pausa padrão (15 s por turno) fica em ~8 chamadas/min.
// Um cenário só: acrescente -t C6.
import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { criarLlm } from "@/agent/llm";
import { RuleBasedLlm } from "@/agent/llm/rules";
import { CENARIOS } from "./cenarios";
import { rodarCenario } from "./runner";

const real = process.env.EVAL_REAL === "1";
const pausaMs = Number(process.env.EVAL_PAUSA_MS ?? (real ? 15_000 : 0));

describe(`evals do Guide (${real ? "LLM real" : "regras"})`, () => {
  for (const c of CENARIOS) {
    it.skipIf(c.soLlmReal && !real)(`${c.id} — ${c.descricao}`, { timeout: 60_000 + c.turnos.length * pausaMs }, async () => {
      const llm = real ? await criarLlm() : new RuleBasedLlm();
      const r = await rodarCenario(c, llm, pausaMs);
      if (real) console.info(JSON.stringify({ llm: llm.nome, ...r }));
      // Prova das conversas, inclusive das que passam (o Vitest só mostra a saída das que falham).
      if (process.env.EVAL_LOG) appendFileSync(process.env.EVAL_LOG, JSON.stringify({ llm: llm.nome, ...r }) + "\n");
      expect(r.turnos.flatMap((t) => t.falhas.map((f) => `"${t.usuario}" → "${t.resposta}": ${f}`))).toEqual([]);
    });
  }
});
