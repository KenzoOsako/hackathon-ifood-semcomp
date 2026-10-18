import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/converse/route";
import { executarAtendente } from "./atendente";
import { agregarSinais, limparSinais } from "@/data/sinais";

vi.mock("./llm/langchain", () => ({ PROVEDORES: new Set(["google"]), criarModelo: vi.fn(async () => ({})) }));
vi.mock("./atendente", () => ({ reiniciarAtendente: vi.fn(), executarAtendente: vi.fn(async (_s, _input, deps) => {
  deps.sinal?.({ tipo: "busca", vertical: "RESTAURANT", categoria: "pizza", restricoes: [], resultados: 1 });
  return { estado: "S1", nivel: "L1", resposta: "Escolha uma opção.", origem: "simulado", llm: "roteiro", tempos: { interpretarMs: 0, totalMs: 0 } };
}) }));
afterEach(() => { vi.unstubAllEnvs(); limparSinais(); });
it("só coleta com consentimento explícito e interrompe novos registros quando retirado", async () => {
  vi.stubEnv("MCP_MODE", "mock"); vi.stubEnv("LLM_PROVIDER", "google"); vi.stubEnv("LLM_MODEL", "roteiro");
  limparSinais();
  const enviar = (consentimentoSinais?: boolean) => POST(new Request("http://localhost:3000/api/converse", {
    method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({ texto: "quero pizza", origem: "texto", ...(consentimentoSinais === undefined ? {} : { consentimentoSinais }) }),
  }));
  expect((await enviar()).status).toBe(200);
  expect(agregarSinais().buscas).toBe(0);
  expect((await enviar(true)).status).toBe(200);
  expect(agregarSinais().buscas).toBe(1);
  expect((await enviar(false)).status).toBe(200);
  expect(agregarSinais().buscas).toBe(1);
  expect(executarAtendente).toHaveBeenCalledTimes(3);
});
