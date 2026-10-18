// Proteções da ida ao MCP do iFood (medido em 18/10: rajada de chamadas simultâneas devolve INTERNAL):
// limite de concorrência, uma nova tentativa em INTERNAL, falha parcial visível e cache só de resultado com itens.
import { afterEach, describe, expect, it } from "vitest";
import { novoRelatorio, type Necessidade } from "../types";
import { McpDomain, comLimite, type McpTools } from ".";

const item = (id: string, nome: string, preco: number) => ({
  itemId: id, itemName: nome, unitPrice: preco,
  merchant: { merchantId: "m-A", merchantName: "Loja A", isOpen: true, reviewRating: 4.5, ratingCount: 100, straightLineDistanceKm: 1, deliveryMethod: { fee: 5, estimatedMinutes: { min: 20, max: 30 } } },
});
const local = { latitude: -22.0069, longitude: -47.8946, fonte: "fixa" as const };
const nec = (categoria: string, consultas?: string[]): Necessidade => ({ id: "n1", vertical: "RESTAURANT", categoria, restricoes: [], ...(consultas ? { consultas } : {}) });
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => { delete process.env.ATENDENTE_CACHE; });

describe("limite de concorrência", () => {
  it("nunca passa de 3 chamadas ao mesmo tempo e todas terminam", async () => {
    let ativos = 0, pico = 0;
    const tarefas = Array.from({ length: 9 }, () => comLimite(async () => { ativos++; pico = Math.max(pico, ativos); await pausa(5); ativos--; return 1; }, 3));
    expect((await Promise.all(tarefas)).length).toBe(9);
    expect(pico).toBeLessThanOrEqual(3);
  });
});

describe("nova tentativa em INTERNAL", () => {
  it("tenta uma segunda vez e conta no relatório; outros erros não repetem", async () => {
    let chamadas = 0;
    const tools: McpTools = { callTool: async () => { chamadas++; if (chamadas === 1) throw new Error('MCP_TOOL_ERRO:searchOffers:{"code": "INTERNAL"}'); return { results: [item("1", "Pizza X", 3000)] }; } };
    const rel = novoRelatorio();
    const opcoes = await new McpDomain(tools, local).buscarNecessidade(nec("pizza"), {}, rel);
    expect(opcoes.length).toBe(1);
    expect(chamadas).toBe(2);
    expect(rel.retries).toBe(1);

    let c2 = 0;
    const ruim: McpTools = { callTool: async () => { c2++; throw new Error("INVALID_ARGUMENT"); } };
    await expect(new McpDomain(ruim, local).buscarNecessidade(nec("pizza"), {})).rejects.toThrow("INVALID_ARGUMENT");
    expect(c2).toBe(1);
  });
});

describe("falha parcial visível", () => {
  it("a consulta que caiu aparece no relatório e a busca segue com as outras", async () => {
    const tools: McpTools = { callTool: async (_n, a) => { if (a.query === "ruim") throw new Error("MCP fora"); return { results: [item("1", "Pizza X", 3000)] }; } };
    const rel = novoRelatorio();
    const opcoes = await new McpDomain(tools, local).buscarNecessidade(nec("pizza", ["ruim"]), {}, rel);
    expect(opcoes.length).toBe(1);
    expect(rel.falhas).toHaveLength(1);
    expect(rel.falhas[0]).toMatch(/ruim/);
  });
});

describe("cache de busca", () => {
  const contando = (resposta: (q: string, n: number) => unknown) => {
    const chamadas: string[] = [];
    const tools: McpTools = { callTool: async (_n, a) => { chamadas.push(String(a.query)); return resposta(String(a.query), chamadas.length); } };
    return { tools, chamadas };
  };

  it("resultado com itens é reaproveitado na segunda busca igual", async () => {
    const { tools, chamadas } = contando(() => ({ results: [item("1", "Pizza X", 3000)] }));
    const d = new McpDomain(tools, local);
    await d.buscarNecessidade(nec("pizza"), {});
    const rel = novoRelatorio();
    const de = await d.buscarNecessidade(nec("pizza"), {}, rel);
    expect(chamadas).toHaveLength(1);
    expect(rel.cache).toBe(1);
    expect(de.length).toBe(1);
  });

  it("vazio NÃO é cacheado (poderia ser erro do iFood parecendo 'não existe')", async () => {
    const { tools, chamadas } = contando((_q, n) => (n === 1 ? { results: [] } : { results: [item("1", "Pizza X", 3000)] }));
    const d = new McpDomain(tools, local);
    expect((await d.buscarNecessidade(nec("pizza"), {})).length).toBe(0);
    expect((await d.buscarNecessidade(nec("pizza"), {})).length).toBe(1); // buscou de novo e achou
    expect(chamadas).toHaveLength(2);
  });

  it("erro NÃO é cacheado", async () => {
    let n = 0;
    const tools: McpTools = { callTool: async () => { n++; if (n === 1) throw new Error("MCP fora"); return { results: [item("1", "Pizza X", 3000)] }; } };
    const d = new McpDomain(tools, local);
    await expect(d.buscarNecessidade(nec("pizza"), {})).rejects.toThrow();
    expect((await d.buscarNecessidade(nec("pizza"), {})).length).toBe(1);
  });

  it("consulta, vertical ou restrição diferentes não compartilham cache; ATENDENTE_CACHE=off desliga", async () => {
    const { tools, chamadas } = contando(() => ({ results: [item("1", "Pizza X", 3000)] }));
    const d = new McpDomain(tools, local);
    await d.buscarNecessidade(nec("pizza"), {});
    await d.buscarNecessidade({ ...nec("pizza"), vertical: "GROCERIES" }, {});
    await d.buscarNecessidade({ ...nec("pizza"), restricoes: ["lactose"] }, {});
    expect(chamadas).toHaveLength(3);
    process.env.ATENDENTE_CACHE = "off";
    await d.buscarNecessidade(nec("pizza"), {});
    await d.buscarNecessidade(nec("pizza"), {});
    expect(chamadas).toHaveLength(5);
  });
});
