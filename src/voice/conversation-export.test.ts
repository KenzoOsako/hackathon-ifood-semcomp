import { describe, expect, it } from "vitest";
import { buildConversationExport, metaFrom, semLlm, type TurnLog } from "./conversation-export";

describe("metaFrom", () => {
  it("lê modelo, estado, nível e tempos de uma resposta do agente", () => {
    const m = metaFrom({ resposta: "x", llm: "google:gemini-3.5-flash-lite", estado: "S3", nivel: "L1", origem: "simulado", tempos: { interpretarMs: 1200, dominioMs: 40, totalMs: 1700 }, aprovacao: { planoId: "p1", versao: 2 } });
    expect(m).toEqual({ llm: "google:gemini-3.5-flash-lite", estado: "S3", nivel: "L1", origem: "simulado", tempos: { interpretarMs: 1200, dominioMs: 40, totalMs: 1700 }, aprovacao: { planoId: "p1", versao: 2 } });
  });
  it("campo faltando ou formato estranho nunca derruba: devolve undefined ou ignora o campo", () => {
    expect(metaFrom(null)).toBeUndefined();
    expect(metaFrom("x")).toBeUndefined();
    expect(metaFrom({ estado: "S1", nivel: "L0" })).toBeUndefined(); // sem llm
    const m = metaFrom({ llm: "regras", estado: "S1", nivel: "L0", tempos: { totalMs: "rápido", interpretarMs: NaN, dominioMs: 12.4 }, aprovacao: { planoId: 3 } });
    expect(m).toEqual({ llm: "regras", estado: "S1", nivel: "L0", tempos: { dominioMs: 12 } });
  });
  it("detecta o modo de reserva", () => {
    expect(semLlm(metaFrom({ llm: "regras", estado: "S0", nivel: "L0" }))).toBe(true);
    expect(semLlm(metaFrom({ llm: "google:gemini-3.5-flash-lite", estado: "S0", nivel: "L0" }))).toBe(false);
    expect(semLlm(undefined)).toBe(false);
  });
});

describe("buildConversationExport", () => {
  const turns: TurnLog[] = [
    { id: "t1", usuario: "oi", origem: "voz", confianca: 0.97, resposta: "Eu ajudo com refeição.", meta: { llm: "regras", estado: "S1", nivel: "L1", tempos: { totalMs: 5 } } },
    { id: "t2", usuario: "pizza", origem: "texto" },
  ];
  it("exporta turno a turno, com o agente que respondeu", () => {
    const x = buildConversationExport(turns, { dados: "mock", geradoEm: "2026-10-18T00:00:00Z" });
    expect(x.agente).toEqual({ llm: "regras", dados: "mock" });
    expect(x.turnos).toHaveLength(2);
    expect(x.turnos[0]).toMatchObject({ n: 1, usuario: "oi", origem: "voz", confianca: 0.97, estado: "S1", nivel: "L1", llm: "regras" });
    expect(x.turnos[1]).toEqual({ n: 2, usuario: "pizza", origem: "texto", resposta: null }); // sem resposta ainda: não inventa metadados
  });
  it("sem nenhuma resposta, o agente aparece como desconhecido", () => {
    expect(buildConversationExport([{ id: "t", usuario: "oi", origem: "texto" }]).agente.llm).toBe("desconhecido");
  });
});
