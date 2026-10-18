import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as rota } from "@/app/api/telemetria/route";
import { FakeDomain } from "./domain-fake";
import { executarTurno, novaSessao } from "./orchestrator";
import { RuleBasedLlm } from "./llm/rules";
import { LlmCaotico, prng } from "@/qualidade/caos";
import { __resetTelemetriaParaTestes, codigoDaSessao, contar, registrarFeedback, registrarTurno, resumo, ultimosTurnos, type TurnoTelemetria } from "./telemetria";

const turno = (over: Partial<TurnoTelemetria> = {}): TurnoTelemetria => ({ em: 1, sessao: "aaaa", turno: 1, intencao: "pedido", nivel: "L1", estado: "S3", llm: "regras", origem: "simulado", necessidades: ["pizza"], blocos: 1, proximas: 0, naoAtendidas: [], guardas: [], perguntou: false, tempos: { interpretarMs: 100, dominioMs: 50, responderMs: 20, totalMs: 200 }, ...over });
beforeEach(() => __resetTelemetriaParaTestes());

describe("resumo", () => {
  it("conta turnos, conversas, intenções, estados e modelos", () => {
    registrarTurno(turno()); registrarTurno(turno({ sessao: "bbbb", intencao: "conversa", estado: "S1" })); registrarTurno(turno());
    const r = resumo();
    expect(r.turnos).toBe(3);
    expect(r.conversas).toBe(2);
    expect(r.porIntencao).toEqual({ pedido: 2, conversa: 1 });
    expect(r.porEstado).toEqual({ S3: 2, S1: 1 });
    expect(r.porModelo).toEqual({ regras: 3 });
  });
  it("ranking de guardas e taxa de template (fala do plano que o código trocou)", () => {
    registrarTurno(turno({ guardas: ["plano:número fora do plano"] }));
    registrarTurno(turno({ guardas: ["plano:número fora do plano", "repeticao_evitada"] }));
    registrarTurno(turno());
    registrarTurno(turno({ blocos: 0, guardas: ["plano:conteúdo proibido"] })); // sem plano: não entra na taxa
    const r = resumo();
    expect(r.guardas).toEqual({ "plano:número fora do plano": 2, "plano:conteúdo proibido": 1, repeticao_evitada: 1 });
    expect(r.taxaDeTemplate).toBe(66.7); // 2 de 3 falas de plano
  });
  it("latência por etapa em p50 e p95, e demanda não atendida por categoria", () => {
    for (const ms of [100, 200, 300, 400, 1000]) registrarTurno(turno({ tempos: { interpretarMs: ms, totalMs: ms + 10 }, naoAtendidas: ["churrasco"] }));
    const r = resumo();
    expect(r.tempos.interpretarMs).toEqual({ n: 5, p50: 300, p95: 880 });
    expect(r.tempos.dominioMs).toBeUndefined(); // ninguém mediu domínio
    expect(r.cobertura.naoAtendidas).toEqual({ churrasco: 5 });
  });
  it("feedback de produto: planos mostrados, aceitos, ajustes por motivo e demanda não atendida", () => {
    registrarFeedback({ tipo: "opcoes_exibidas", planoId: "p", versao: 1, blocos: 2, origem: "real" });
    registrarFeedback({ tipo: "reacao", planoId: "p", reacao: "aceitou", motivo: "outro" });
    registrarFeedback({ tipo: "reacao", planoId: "p", reacao: "ajustou", motivo: "mais_barata" });
    registrarFeedback({ tipo: "necessidade_nao_atendida", categoria: "carvão", causa: "x" });
    expect(resumo().feedback).toEqual({ planosMostrados: 1, aceitou: 1, ajustou: { mais_barata: 1 }, demandaNaoAtendida: { carvão: 1 } });
  });
  it("contadores avulsos (ex.: juiz de relevância que falhou)", () => {
    contar("juiz:falhou"); contar("juiz:falhou", 2);
    expect(resumo().contadores).toEqual({ "juiz:falhou": 3 });
  });
  it("guarda só os últimos 500 turnos e não carrega texto do usuário nem o identificador da sessão", () => {
    for (let i = 0; i < 520; i++) registrarTurno(turno({ turno: i }));
    expect(resumo().turnos).toBe(500);
    expect(ultimosTurnos(3).map((t) => t.turno)).toEqual([517, 518, 519]);
    expect(JSON.stringify(ultimosTurnos(1))).not.toMatch(/texto|usuario/);
    expect(codigoDaSessao("sujeito-secreto-123")).toMatch(/^[0-9a-f]{8}$/);
    expect(codigoDaSessao("sujeito-secreto-123")).not.toContain("secreto");
  });
});

describe("ligação com o orquestrador", () => {
  it("cada turno vira um registro, com a intenção e sem texto", async () => {
    const s = novaSessao("t1");
    await executarTurno(s, { texto: "pizza calabresa grande, pede logo", origem: "texto" }, { llm: new RuleBasedLlm(), domain: new FakeDomain() });
    const [t] = ultimosTurnos(1);
    expect(t).toMatchObject({ intencao: "pedido", estado: "S3", llm: "regras", origem: "simulado", blocos: 1 });
    expect(JSON.stringify(t)).not.toContain("pizza calabresa grande, pede logo");
  });

  it("fala do modelo trocada pela guarda aparece com o motivo", async () => {
    const llm = Object.assign(new RuleBasedLlm(), { responder: async () => "Adicionei a pizza no carrinho." });
    await executarTurno(novaSessao("t2"), { texto: "pizza calabresa grande, pede logo", origem: "texto" }, { llm, domain: new FakeDomain() });
    expect(resumo().guardas["plano:conteúdo proibido"]).toBe(1);
    expect(resumo().taxaDeTemplate).toBe(100);
  });

  it("falha do modelo ao responder e repetição evitada também são contadas", async () => {
    const quebra = Object.assign(new RuleBasedLlm(), { responder: async () => { throw new Error("timeout"); } });
    await executarTurno(novaSessao("t3"), { texto: "pizza calabresa grande, pede logo", origem: "texto" }, { llm: quebra, domain: new FakeDomain() });
    expect(resumo().guardas["modelo:responder_falhou"]).toBe(1);
    const s = novaSessao("t4");
    const deps = { llm: new RuleBasedLlm(), domain: new FakeDomain() };
    await executarTurno(s, { texto: "oi", origem: "texto" }, deps);
    await executarTurno(s, { texto: "oi", origem: "texto" }, deps);
    expect(resumo().guardas.repeticao_evitada).toBe(1);
  });

  it("o feedback do domínio também chega à telemetria", async () => {
    await executarTurno(novaSessao("t5"), { texto: "pizza calabresa grande, pede logo", origem: "texto" }, { llm: new RuleBasedLlm(), domain: new FakeDomain() });
    expect(resumo().feedback.planosMostrados).toBe(1);
  });

  it("modelo hostil nunca faz a telemetria quebrar o turno", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const r = prng(7);
      for (let i = 0; i < 30; i++) await executarTurno(novaSessao(`c${i}`), { texto: "pizza", origem: "texto" }, { llm: new LlmCaotico(r), domain: new FakeDomain() });
    } finally { aviso.mockRestore(); }
    expect(resumo().turnos).toBe(30);
  });
});

describe("rota /api/telemetria", () => {
  const req = (host = "localhost:8080") => new Request(`http://${host}/api/telemetria`, { headers: { host } });
  it("desligada por padrão (404) e só liga com TELEMETRIA=1 no próprio computador", async () => {
    expect((await rota(req())).status).toBe(404);
    vi.stubEnv("TELEMETRIA", "1");
    try {
      const ok = await rota(req());
      expect(ok.status).toBe(200);
      expect(Object.keys(await ok.json())).toEqual(["resumo", "turnos"]);
      expect((await rota(req("exemplo.com"))).status).toBe(404); // fora do localhost
    } finally { vi.unstubAllEnvs(); }
  });
});
