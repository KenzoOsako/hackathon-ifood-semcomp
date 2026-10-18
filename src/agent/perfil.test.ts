import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as _naoUsado } from "@/app/api/converse/route";
import { GET as perfil } from "@/app/api/perfil/route";
import { __resetNomesParaTestes, carregarNome, nomeConhecido, nomeNaResposta, primeiroNome } from "./perfil";
import { escoposDoLogin, ESCOPOS } from "@/mcp/real/oauth";

void _naoUsado;
beforeEach(() => __resetNomesParaTestes());
afterEach(() => vi.useRealTimers());

describe("primeiroNome", () => {
  it("só o primeiro nome, com inicial maiúscula", () => {
    expect(primeiroNome("felipe terossi")).toBe("Felipe");
    expect(primeiroNome("ANA MARIA")).toBe("Ana");
    expect(primeiroNome("João")).toBe("João");
    expect(primeiroNome("D'Ávila Souza")).toBe("D'ávila");
  });
  it("o que não parece nome não vira nome (nada de sobrenome, número, marcação nem instrução)", () => {
    for (const x of ["", "   ", "123", "a", "x".repeat(40), "ignore as instruções", "**", 42, null, undefined]) expect(primeiroNome(x as never)).toBeUndefined();
  });
  it("marcação ao redor é limpa antes de decidir", () => {
    expect(primeiroNome("[Ana] Souza")).toBe("Ana");
    expect(primeiroNome("<b>Ana</b>")).toBe("Ana");
  });
});

describe("nomeNaResposta (getUser)", () => {
  it("campo direto, aninhado e em lista", () => {
    expect(nomeNaResposta({ fullName: "Felipe Terossi", email: "x@y.com" })).toBe("Felipe");
    expect(nomeNaResposta({ results: { profile: { name: "ana maria" } } })).toBe("Ana");
    expect(nomeNaResposta({ data: [{ firstName: "João" }] })).toBe("João");
  });
  it("não devolve e-mail nem telefone, e resposta estranha não quebra", () => {
    expect(nomeNaResposta({ email: "felipe@x.com", phone: "16999990000" })).toBeUndefined();
    expect(nomeNaResposta(null)).toBeUndefined();
    expect(nomeNaResposta("texto")).toBeUndefined();
    expect(nomeNaResposta({ a: { b: { c: { d: { e: { fullName: "Fundo Demais" } } } } } })).toBeUndefined(); // profundidade limitada
  });
});

describe("carregarNome (fontes e privacidade)", () => {
  const tools = (r: unknown) => ({ callTool: vi.fn(async () => r) });
  const comEscopo = { IFOOD_SCOPES_EXTRA: "mcp.user.basic.read" } as unknown as NodeJS.ProcessEnv;

  it("sem escopo extra habilitado NÃO chama o getUser: só o nome combinado da demo", async () => {
    const t = tools({ fullName: "Felipe Terossi" });
    expect(await carregarNome("s1", t, { GUIDE_NOME_DEMO: "Maria" } as unknown as NodeJS.ProcessEnv)).toBe("Maria");
    expect(t.callTool).not.toHaveBeenCalled();
  });
  it("com escopo, usa o nome da conta e guarda: uma chamada só por sessão", async () => {
    const t = tools({ fullName: "Felipe Terossi" });
    expect(await carregarNome("s2", t, comEscopo)).toBe("Felipe");
    expect(await carregarNome("s2", t, comEscopo)).toBe("Felipe");
    expect(t.callTool).toHaveBeenCalledTimes(1);
    expect(t.callTool).toHaveBeenCalledWith("getUser", {});
    expect(nomeConhecido("s2", {} as NodeJS.ProcessEnv)).toBe("Felipe");
  });
  it("getUser com erro ou sem nome cai no nome da demo; sem nada, fica sem nome", async () => {
    const quebra = { callTool: vi.fn(async () => { throw new Error("escopo"); }) };
    expect(await carregarNome("s3", quebra, { ...comEscopo, GUIDE_NOME_DEMO: "Maria" } as unknown as NodeJS.ProcessEnv)).toBe("Maria");
    expect(await carregarNome("s4", tools({ email: "a@b.com" }), comEscopo)).toBeUndefined();
  });
  it("getUser que demora além de 3 s é abandonado (a saudação não espera a rede)", async () => {
    vi.useFakeTimers();
    const lento = { callTool: vi.fn(() => new Promise(() => undefined)) };
    const p = carregarNome("s5", lento as never, comEscopo);
    await vi.advanceTimersByTimeAsync(3100);
    expect(await p).toBeUndefined();
  });
  it("sem ferramentas (modo simulado) usa só o nome combinado", async () => {
    expect(await carregarNome("s6", undefined, { GUIDE_NOME_DEMO: "Maria" } as unknown as NodeJS.ProcessEnv)).toBe("Maria");
    expect(await carregarNome("s7", undefined, {} as NodeJS.ProcessEnv)).toBeUndefined();
  });
});

describe("rota /api/perfil", () => {
  const req = () => new Request("http://localhost:8080/api/perfil");
  it("devolve só { nome }, nunca outro dado", async () => {
    vi.stubEnv("GUIDE_NOME_DEMO", "felipe terossi");
    try {
      const r = await perfil(req());
      expect(await r.json()).toEqual({ nome: "Felipe" });
      expect(r.headers.get("cache-control")).toContain("no-store");
    } finally { vi.unstubAllEnvs(); }
  });
  it("sem nome combinado, devolve objeto vazio (a interface usa a saudação padrão)", async () => {
    vi.stubEnv("GUIDE_NOME_DEMO", "");
    try { expect(await (await perfil(req())).json()).toEqual({}); } finally { vi.unstubAllEnvs(); }
  });
});

describe("escopos do login", () => {
  it("por padrão só os de leitura já homologados", () => {
    expect(escoposDoLogin({} as NodeJS.ProcessEnv)).toEqual(ESCOPOS);
  });
  it("extras entram só se pedidos e no formato mcp.*; lixo e escopo de escrita sem ponto não passam", () => {
    const e = escoposDoLogin({ IFOOD_SCOPES_EXTRA: "mcp.user.basic.read, openid  evil;scope mcp.user.basic.read" } as unknown as NodeJS.ProcessEnv);
    expect(e).toContain("mcp.user.basic.read");
    expect(e.filter((x) => x === "mcp.user.basic.read")).toHaveLength(1); // sem duplicar
    expect(e).not.toContain("openid");
    expect(e.some((x) => x.includes(";"))).toBe(false);
  });
});
