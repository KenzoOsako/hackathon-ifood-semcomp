import { describe, expect, it } from "vitest";
import { SYSTEM_RESPONDER, falaRespeitaSnapshot } from "@/prompts/responder";
import { speakableIssues } from "@/voice/speakable";
import { FakeDomain } from "../domain-fake";
import { RuleBasedLlm } from "../llm/rules";
import { FRASES, executarTurno, novaSessao } from ".";

// Conversas inteiras pelo orquestrador (agente por regras + domínio de exemplo): toda resposta tem que servir para ser FALADA
// e, quando há plano na tela, cada número falado tem que existir no plano.
const CONVERSAS: Record<string, string[]> = {
  "pedido rápido": ["pizza calabresa grande, pede logo", "pode", "quero mudar para a mais rápida"],
  "ocasião guiada": ["hoje é aniversário de um amigo, vamos comer pizza e ver um filme", "umas seis pessoas", "pode escolher", "pode"],
  "cumprimento e escopo": ["oi, tudo bem?", "o que você faz?", "me vê uma cerveja"],
  "cancelar": ["pizza calabresa grande, pede logo", "cancelar"],
};

describe("fala válida em conversas inteiras", () => {
  for (const [nome, falas] of Object.entries(CONVERSAS)) {
    it(nome, async () => {
      const domain = new FakeDomain();
      const s = novaSessao(`sujeito-${nome}`);
      const llm = new RuleBasedLlm();
      for (const texto of falas) {
        const r = await executarTurno(s, { texto, origem: "voz" }, { llm, domain });
        expect(speakableIssues(r.resposta), `"${texto}" → "${r.resposta}"`).toEqual([]);
        if (r.tela) expect(falaRespeitaSnapshot(r.resposta, r.tela.plano), `número fora do plano em "${r.resposta}"`).toBe(true);
      }
    });
  }

  it("todas as frases fixas do orquestrador servem para ser faladas", () => {
    for (const [k, frase] of Object.entries(FRASES)) expect(speakableIssues(frase), `${k}: ${frase}`).toEqual([]);
  });

  it("o prompt de resposta manda escrever números em algarismos (senão o guarda de números não tem o que conferir)", () => {
    expect(SYSTEM_RESPONDER).toMatch(/algarismos/);
  });
});
