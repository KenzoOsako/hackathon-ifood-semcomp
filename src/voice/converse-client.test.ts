import { describe, expect, it } from "vitest";
import { converseTurn, replyToEvents } from "./converse-client";
import { ConverseEventSchema, encodeEvent } from "./converse-events";

const collect = async <T,>(g: AsyncGenerator<T>) => { const out: T[] = []; for await (const e of g) out.push(e); return out; };
const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const input = { texto: "quero pizza", origem: "voz" as const };

describe("replyToEvents", () => {
  it("resposta curta vira um speech final seguido de done", () => {
    const ev = replyToEvents({ resposta: "Achei duas opções." }, "t1");
    expect(ev).toEqual([{ type: "speech", seq: 0, text: "Achei duas opções.", final: true }, { type: "done", turnId: "t1" }]);
  });
  it("resposta longa é dividida em pedaços numerados, só o último é final", () => {
    const ev = replyToEvents({ resposta: "Achei duas opções perto de você. A primeira custa R$ 39,90 e chega em 25 min. A segunda é mais barata, mas demora mais. Qual você prefere?" }, "t2");
    const speech = ev.filter((e) => e.type === "speech");
    expect(speech.length).toBeGreaterThan(1);
    expect(speech.map((e) => (e as { seq: number }).seq)).toEqual(speech.map((_, i) => i));
    expect(speech.filter((e) => (e as { final?: boolean }).final)).toHaveLength(1);
    expect((speech.at(-1) as { final?: boolean }).final).toBe(true);
    expect(speech.map((e) => (e as { text: string }).text).join(" ")).toContain("R$ 39,90");
  });
  it("frase de espera diferente da resposta vira ack; igual à resposta não repete", () => {
    expect(replyToEvents({ resposta: "Pronto.", fraseEspera: "Deixa eu ver." }, "t")[0]).toEqual({ type: "ack", text: "Deixa eu ver." });
    expect(replyToEvents({ resposta: "Pronto.", fraseEspera: "Pronto." }, "t").some((e) => e.type === "ack")).toBe(false);
  });
  it("tela vira evento screen, antes do done", () => {
    const plano = { planoId: "p1", versao: 1, blocos: [], naoAtendidas: [] };
    const ev = replyToEvents({ resposta: "Aqui está.", tela: { tipo: "mostrar_plano", plano: plano as never } }, "t");
    expect(ev.map((e) => e.type)).toEqual(["speech", "screen", "done"]);
    expect(ev[1]).toMatchObject({ event: "mostrar_plano", payload: plano });
  });
});

describe("converseTurn", () => {
  it("backend em JSON (formato atual): converte em eventos e manda origem e sinais", async () => {
    let sent: { texto?: string; origem?: string } = {};
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => { sent = JSON.parse(String(init?.body)); return jsonRes({ estado: "S2", nivel: "L1", resposta: "Qual tamanho?", origem: "simulado", llm: "rules", tempos: { interpretarMs: 1, totalMs: 2 } }); }) as typeof fetch;
    const ev = await collect(converseTurn(input, { fetchImpl, newTurnId: () => "t9" }));
    expect(sent).toMatchObject({ texto: "quero pizza", origem: "voz" });
    expect(ev).toEqual([{ type: "speech", seq: 0, text: "Qual tamanho?", final: true }, { type: "done", turnId: "t9" }]);
  });
  it("backend em NDJSON (formato alvo): repassa os eventos na ordem", async () => {
    const lines = [encodeEvent({ type: "ack", text: "Já vejo." }), encodeEvent({ type: "speech", seq: 0, text: "Achei duas.", final: true }), encodeEvent({ type: "done", turnId: "x" })].join("");
    const fetchImpl = (async () => new Response(lines, { status: 200, headers: { "content-type": "application/x-ndjson" } })) as typeof fetch;
    const ev = await collect(converseTurn(input, { fetchImpl }));
    expect(ev.map((e) => e.type)).toEqual(["ack", "speech", "done"]);
  });
  it("falha do backend vira um evento error com frase segura (a do backend, se houver)", async () => {
    const fetchImpl = (async () => jsonRes({ state: "FALHA", code: "AUTH_REQUIRED", reply: "Sessão ou origem inválida." }, 403)) as typeof fetch;
    const ev = await collect(converseTurn(input, { fetchImpl }));
    expect(ev).toEqual([{ type: "error", code: "AUTH_REQUIRED", reply: "Sessão ou origem inválida." }]);
  });
  it("rede caída vira error genérico; turno abortado pela pessoa não fala nada", async () => {
    const down = (async () => { throw new TypeError("network"); }) as typeof fetch;
    expect((await collect(converseTurn(input, { fetchImpl: down })))[0]).toMatchObject({ type: "error", code: "REDE" });
    const ctrl = new AbortController(); ctrl.abort();
    expect(await collect(converseTurn(input, { fetchImpl: down, signal: ctrl.signal }))).toEqual([]);
  });
  it("resposta sem texto ou não-JSON não quebra: error", async () => {
    expect((await collect(converseTurn(input, { fetchImpl: (async () => jsonRes({ estado: "S0" })) as typeof fetch })))[0].type).toBe("error");
    expect((await collect(converseTurn(input, { fetchImpl: (async () => new Response("<html>", { status: 502 })) as typeof fetch })))[0]).toMatchObject({ type: "error", code: "RESPOSTA_INVALIDA" });
  });
});


describe("login do iFood", () => {
  const login = (loginUrl: unknown) => (async () => jsonRes({ state: "FALHA", code: "IFOOD_LOGIN", reply: "Conecte sua conta iFood.", loginUrl }, 401)) as typeof fetch;
  it("401 com caminho relativo vira error com loginUrl (a tela mostra o botão)", async () => {
    const ev = await collect(converseTurn(input, { fetchImpl: login("/api/auth/login") }));
    expect(ev).toEqual([{ type: "error", code: "IFOOD_LOGIN", reply: "Conecte sua conta iFood.", loginUrl: "/api/auth/login" }]);
  });
  it("URL externa ou protocolo-relativo NUNCA vira link", async () => {
    for (const bad of ["https://evil.example/login", "//evil.example", "javascript:alert(1)", "/x y", 42]) {
      const ev = await collect(converseTurn(input, { fetchImpl: login(bad) }));
      expect(ev[0]).not.toHaveProperty("loginUrl");
    }
  });
  it("o contrato de eventos só aceita caminho relativo", () => {
    const base = { type: "error", code: "X", reply: "r" };
    expect(ConverseEventSchema.safeParse({ ...base, loginUrl: "/api/auth/login" }).success).toBe(true);
    expect(ConverseEventSchema.safeParse({ ...base, loginUrl: "//evil.example" }).success).toBe(false);
    expect(ConverseEventSchema.safeParse({ ...base, loginUrl: "https://evil.example" }).success).toBe(false);
  });
});


describe("metadados do agente (observabilidade)", () => {
  it("entrega modelo, estado, nível e tempos pelo gancho, sem mudar os eventos", async () => {
    const got: unknown[] = [];
    const fetchImpl = (async () => jsonRes({ estado: "S3", nivel: "L0", resposta: "Montei o plano.", origem: "simulado", llm: "google:gemini-3.5-flash-lite", tempos: { interpretarMs: 1100, totalMs: 1600 } })) as typeof fetch;
    const ev = await collect(converseTurn(input, { fetchImpl, newTurnId: () => "t1", onMeta: (m) => got.push(m) }));
    expect(got).toEqual([{ llm: "google:gemini-3.5-flash-lite", estado: "S3", nivel: "L0", origem: "simulado", tempos: { interpretarMs: 1100, totalMs: 1600 } }]);
    expect(ev.map((e) => e.type)).toEqual(["speech", "done"]);
  });
  it("resposta sem metadados completos não chama o gancho; falha do backend também não", async () => {
    const got: unknown[] = [];
    await collect(converseTurn(input, { fetchImpl: (async () => jsonRes({ resposta: "oi", estado: "S1" })) as typeof fetch, onMeta: (m) => got.push(m) }));
    await collect(converseTurn(input, { fetchImpl: (async () => jsonRes({ state: "FALHA", code: "X", reply: "r" }, 503)) as typeof fetch, onMeta: (m) => got.push(m) }));
    expect(got).toEqual([]);
  });
});
