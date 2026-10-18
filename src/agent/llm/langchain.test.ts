import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { describe, expect, it, vi } from "vitest";
import type { InterpretarInput, TurnoInterpretado } from "../types";
import { LangChainLlm } from "./langchain";

const turno = (over: Partial<TurnoInterpretado> = {}): TurnoInterpretado => ({ intencao: "pedido", nivel: "L1", ocasiao: {}, necessidades: [], assumido: [], ...over });
const ovos = { id: "n1", vertical: "GROCERIES" as const, categoria: "ovos", restricoes: [], consultas: ["ovos"] };

// Modelo falso: devolve, em ordem, os resultados (ou erros) pedidos.
function modelo(respostas: Array<TurnoInterpretado | Error>) {
  const invoke = vi.fn(async () => { const r = respostas.shift()!; if (r instanceof Error) throw r; return { parsed: r, raw: {} }; });
  return { m: { withStructuredOutput: () => ({ invoke }) } as unknown as BaseChatModel, invoke };
}
const entrada = (necessidades: InterpretarInput["session"]["necessidades"] = []): InterpretarInput => ({ texto: "quero ovos", pressaDetectada: false, session: { estado: "S0", perguntasFeitas: 0, ocasiao: {}, necessidades, history: [], opcoesFaladas: [] } });

describe("LangChainLlm.interpretar: confiabilidade do modelo", () => {
  it("pedido claro que volta SEM necessidades ganha uma nova tentativa, e vale a segunda se vier preenchida", async () => {
    const { m, invoke } = modelo([turno(), turno({ necessidades: [ovos] })]);
    const t = await new LangChainLlm(m, "teste", "x").interpretar(entrada());
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(t.necessidades).toHaveLength(1);
  });

  it("no máximo UMA nova tentativa: duas vazias devolvem a primeira, sem terceira chamada", async () => {
    const { m, invoke } = modelo([turno(), turno(), turno({ necessidades: [ovos] })]);
    const t = await new LangChainLlm(m, "teste", "x").interpretar(entrada());
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(t.necessidades).toHaveLength(0);
  });

  it("a nova tentativa que falha não perde a primeira resposta", async () => {
    const { m } = modelo([turno(), new Error("429")]);
    const t = await new LangChainLlm(m, "teste", "x").interpretar(entrada());
    expect(t.intencao).toBe("pedido");
  });

  it("não repete quando faz sentido vir sem necessidades: conversa, ou o estado já tinha necessidades", async () => {
    const a = modelo([turno({ intencao: "conversa" })]);
    await new LangChainLlm(a.m, "teste", "x").interpretar(entrada());
    expect(a.invoke).toHaveBeenCalledTimes(1);
    const b = modelo([turno()]);
    await new LangChainLlm(b.m, "teste", "x").interpretar(entrada([ovos]));
    expect(b.invoke).toHaveBeenCalledTimes(1);
  });

  it("não repete se o turno já foi cancelado", async () => {
    const { m, invoke } = modelo([turno(), turno({ necessidades: [ovos] })]);
    const ctrl = new AbortController(); ctrl.abort();
    await new LangChainLlm(m, "teste", "x").interpretar(entrada(), ctrl.signal);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("LangChainLlm: modelo de reserva", () => {
  it("principal sobrecarregado (503) vai direto à reserva, sem nova tentativa no mesmo modelo", async () => {
    const a = modelo([new Error("503 high demand")]);
    const b = modelo([turno({ necessidades: [ovos] })]);
    const t = await new LangChainLlm(a.m, "teste", "x", b.m).interpretar(entrada());
    expect(a.invoke).toHaveBeenCalledTimes(1);
    expect(b.invoke).toHaveBeenCalledTimes(1);
    expect(t.necessidades).toHaveLength(1);
  });

  it("sem reserva, o erro sobe (o orquestrador usa o plano B)", async () => {
    const a = modelo([new Error("503")]);
    await expect(new LangChainLlm(a.m, "teste", "x").interpretar(entrada())).rejects.toThrow("503");
  });

  it("turno cancelado não aciona a reserva", async () => {
    const a = modelo([new Error("abortado")]);
    const b = modelo([turno()]);
    const ctrl = new AbortController(); ctrl.abort();
    await expect(new LangChainLlm(a.m, "teste", "x", b.m).interpretar(entrada(), ctrl.signal)).rejects.toThrow();
    expect(b.invoke).not.toHaveBeenCalled();
  });
});

describe("LangChainLlm: reserva em paralelo quando o principal demora", () => {
  it("principal lento (3 s) perde para a reserva que chamamos após o atraso", async () => {
    const lento = { withStructuredOutput: () => ({ invoke: () => new Promise((r) => setTimeout(() => r({ parsed: turno(), raw: {} }), 3000)) }) } as unknown as BaseChatModel;
    const b = modelo([turno({ necessidades: [ovos] })]);
    const t0 = Date.now();
    const t = await new LangChainLlm(lento, "teste", "x", b.m).interpretar(entrada());
    expect(Date.now() - t0).toBeLessThan(2500);
    expect(t.necessidades).toHaveLength(1);
  });
});
