// Sem configuração: roda com o interpretador por regras (offline, determinístico).
// Com LLM real: EVAL_REAL=1 LLM_PROVIDER=... LLM_MODEL=... npx vitest run src/evals
import { describe, expect, it } from "vitest";
import { criarLlm } from "@/agent/llm";
import { RuleBasedLlm } from "@/agent/llm/rules";
import { CENARIOS } from "./cenarios";
import { rodarCenario } from "./runner";

const real = process.env.EVAL_REAL === "1";

describe(`evals do Guide (${real ? "LLM real" : "regras"})`, () => {
  for (const c of CENARIOS) {
    it(`${c.id} — ${c.descricao}`, { timeout: 60_000 }, async () => {
      const llm = real ? await criarLlm() : new RuleBasedLlm();
      const r = await rodarCenario(c, llm);
      if (real) console.info(JSON.stringify({ llm: llm.nome, ...r }));
      expect(r.turnos.flatMap((t) => t.falhas.map((f) => `"${t.usuario}" → "${t.resposta}": ${f}`))).toEqual([]);
    });
  }
});
