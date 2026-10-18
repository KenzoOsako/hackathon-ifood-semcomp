import { describe, expect, it, vi } from "vitest";
import { DOCUMENTADAS, LEITURA, NAO_CHAMADAS, explorar, formaDe, mesclar, type Ferramenta } from "./mcp-explorar";
import type { McpTools } from "./domain-mcp";

const catalogo = { ocultarValores: false, exemplos: true };
const pessoal = { ocultarValores: true, exemplos: false };

describe("formaDe", () => {
  it("descreve tipos, tamanho e faixa, e mescla itens de uma lista (campo ausente = opcional, nulo = anulável)", () => {
    const f = formaDe({ results: [{ itemName: "Pizza", unitPrice: 39.9, promo: null }, { itemName: "Pudim", unitPrice: 8 }] }, catalogo);
    expect(f).toMatchObject({ tipo: "objeto", campos: { results: { tipo: "lista", tamanho: 2, item: { tipo: "objeto", campos: {
      itemName: { tipo: "texto", exemplos: ["Pizza", "Pudim"] },
      unitPrice: { tipo: "numero", min: 8, max: 39.9 },
      promo: { tipo: "nulo", opcional: true },
    } } } } });
  });
  it("dados da pessoa: valor oculto em campo sensível, mas o formato continua", () => {
    const f = formaDe({ fullName: "Felipe Terossi", email: "f@x.com", coordinates: { latitude: -22, longitude: -47 }, hasClub: true, count: 3 }, pessoal);
    expect(JSON.stringify(f)).not.toMatch(/Felipe|f@x|-22|-47/);
    expect(f).toMatchObject({ campos: { fullName: { tipo: "oculto" }, email: { tipo: "oculto" }, hasClub: { tipo: "booleano" }, count: { tipo: "numero" } } });
  });
  it("catálogo: nome de loja e item entram como exemplo, mas campo sensível não", () => {
    const f = formaDe({ merchantName: "Forno e Cia", phone: "16999990000" }, catalogo);
    expect(f).toMatchObject({ campos: { merchantName: { tipo: "texto", exemplos: ["Forno e Cia"] }, phone: { tipo: "oculto" } } });
  });
  it("tipos misturados e lista vazia não quebram", () => {
    expect(mesclar([{ tipo: "texto", comprimentoMax: 1 }, { tipo: "numero", min: 1, max: 1 }])).toEqual({ tipo: "misto", tipos: ["texto", "numero"] });
    expect(formaDe({ a: [] }, catalogo)).toMatchObject({ campos: { a: { tipo: "lista", tamanho: 0 } } });
    expect(formaDe(null, catalogo)).toEqual({ tipo: "nulo" });
  });
  it("profundidade limitada (resposta gigante não explode)", () => {
    let o: Record<string, unknown> = { fim: 1 };
    for (let i = 0; i < 30; i++) o = { a: o };
    expect(JSON.stringify(formaDe(o, catalogo)).length).toBeLessThan(2000);
  });
});

describe("explorar: só leitura, nada pessoal sai", () => {
  const vivas: Ferramenta[] = DOCUMENTADAS.map((name) => ({ name, description: "", obrigatorios: [], parametros: {} }));
  const fake = () => {
    const chamadas: string[] = [];
    const tools: McpTools = {
      async callTool(nome, args) {
        chamadas.push(nome);
        if (nome === "listAddresses") return { results: [{ addressId: "a1", alias: "Casa", street: "Rua das Flores", coordinates: { latitude: -22.5, longitude: -47.5 }, ordersByMerchantTypeWeekdayAndShift: { RESTAURANT: { MON: { NIGHT: "3" } } } }] };
        if (nome === "getUser") return { data: { fullName: "Felipe Terossi", email: "f@x.com", phone: "16999990000" } };
        if (nome === "getRecommendations" && (args as { contentMode: string }).contentMode === "RECENT_ORDERS") return { results: [{ itemName: "X-Burger", lastOrderedAt: "2026-10-01", timesOrdered: "4", lastOrderId: "ord-secreto-1", merchant: { merchantId: "m1", merchantName: "Burger do Zé" } }] };
        if (nome === "searchOffers" || nome === "browseOffers") return { results: [{ itemId: "i1", itemName: "Pizza", unitPrice: 39.9, merchant: { merchantId: "m1", merchantName: "Forno" } }] };
        return { results: [] };
      },
    };
    return { tools, chamadas };
  };

  it("nunca chama ferramenta de escrita (carrinho, endereço, checkout)", async () => {
    const { tools, chamadas } = fake();
    await explorar(tools, vivas);
    expect(chamadas.length).toBeGreaterThan(20);
    for (const c of chamadas) expect(LEITURA.has(c), c).toBe(true);
    for (const n of NAO_CHAMADAS) expect(chamadas).not.toContain(n.ferramenta);
  });

  it("o resultado não carrega nome, e-mail, telefone, rua, coordenadas, nem identificador de pedido", async () => {
    const { tools } = fake();
    const v = await explorar(tools, vivas);
    const texto = JSON.stringify(v);
    for (const segredo of ["Felipe", "Terossi", "f@x.com", "16999990000", "Rua das Flores", "-22.5", "-47.5", "ord-secreto-1", "Casa"]) expect(texto).not.toContain(segredo);
    // Mas o formato dos hábitos aparece: é o que interessa aos testes.
    expect(texto).toContain("ordersByMerchantTypeWeekdayAndShift");
    expect(texto).toContain("timesOrdered");
  });

  it("usa o id do último pedido só por dentro (getOrder e trackOrder são chamados, sem expor o id)", async () => {
    const { tools, chamadas } = fake();
    const v = await explorar(tools, vivas);
    expect(chamadas).toEqual(expect.arrayContaining(["getOrder", "trackOrder"]));
    expect(v.sondagens.find((s) => s.ferramenta === "getOrder")?.argumentos).toEqual({ orderId: "<id>" });
  });

  it("tenta todos os modos de recomendação e os tipos de loja", async () => {
    const { tools } = fake();
    const v = await explorar(tools, vivas);
    const modos = new Set(v.sondagens.filter((s) => s.ferramenta === "getRecommendations").map((s) => s.argumentos.contentMode));
    expect([...modos].sort()).toEqual(["BEST_DEALS", "FAVORITE_MERCHANTS", "FEATURED_LOCAL", "RECENT_ORDERS", "RECOMMENDED"]);
    const tipos = new Set(v.sondagens.filter((s) => s.ferramenta === "browseOffers").map((s) => s.argumentos.merchantType));
    expect(tipos.size).toBe(6);
  });

  it("uma ferramenta que falha vira erro registrado, e a varredura segue", async () => {
    const tools: McpTools = { callTool: vi.fn(async (n) => { if (n === "getUser") throw new Error("escopo ausente"); return { results: [] }; }) };
    const v = await explorar(tools, vivas);
    expect(v.sondagens.find((s) => s.ferramenta === "getUser")).toMatchObject({ ok: false, erro: "escopo ausente" });
    expect(v.sondagens.length).toBeGreaterThan(20);
  });

  it("aponta divergência entre a documentação e o MCP ao vivo (nos dois sentidos)", async () => {
    const { tools } = fake();
    const v = await explorar(tools, [...vivas.filter((f) => f.name !== "getUser"), { name: "ferramentaNova", description: "", obrigatorios: [], parametros: {} }]);
    expect(v.divergenciasComADoc).toEqual(expect.arrayContaining(["documentada mas AUSENTE no MCP ao vivo: getUser", "no MCP ao vivo mas NÃO documentada: ferramentaNova"]));
  });

  it("DOCUMENTADAS tem as 24 ferramentas", () => expect(new Set(DOCUMENTADAS).size).toBe(24));
});
