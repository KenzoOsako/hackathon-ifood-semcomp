import { describe, expect, it } from "vitest";
import type { Necessidade } from "../types";
import { McpDomain, consultasDe, type McpTools } from ".";

// Catálogo falso: o que cada CONSULTA devolve. Item com loja aberta, entrega e nota, para passar pelos filtros do Kenzo.
const item = (id: string, nome: string, preco: number, loja = "Loja A") => ({
  itemId: id, itemName: nome, unitPrice: preco,
  merchant: { merchantId: `m-${loja}`, merchantName: loja, isOpen: true, reviewRating: 4.5, ratingCount: 100, straightLineDistanceKm: 1, deliveryMethod: { fee: 5, estimatedMinutes: { min: 20, max: 30 } } },
});

class Catalogo implements McpTools {
  readonly consultas: string[] = [];
  constructor(private readonly porConsulta: Record<string, ReturnType<typeof item>[] | Error>) {}
  async callTool(_name: string, args: Record<string, unknown>) {
    const q = String(args.query);
    this.consultas.push(q);
    const r = this.porConsulta[q];
    if (r instanceof Error) throw r;
    return { results: r ?? [] };
  }
}

const local = { latitude: -22.0069, longitude: -47.8946, fonte: "fixa" as const };
const nec = (categoria: string, extra: Partial<Necessidade> = {}): Necessidade => ({ id: "n1", vertical: "GROCERIES", categoria, restricoes: [], ...extra });


describe("consultasDe", () => {
  it("usa as consultas do planejador, depois a categoria, sem repetir, no máximo 3", () => {
    expect(consultasDe({ categoria: "churrasco", consultas: ["picanha", "costela"] })).toEqual(["picanha", "costela", "churrasco"]);
    expect(consultasDe({ categoria: "leite", consultas: ["Leite", " leite  integral "] })).toEqual(["Leite", "leite integral"]);
    expect(consultasDe({ categoria: "pizza" })).toEqual(["pizza"]);
    expect(consultasDe({ categoria: "x", consultas: ["a", "b", "c", "d"] })).toEqual(["a", "b", "c"]);
  });
});

describe("busca por várias consultas", () => {
  it("uma chamada ao MCP por consulta, em paralelo, juntando os resultados sem repetir o mesmo item", async () => {
    const tools = new Catalogo({ picanha: [item("1", "Picanha 1kg", 6000), item("2", "Costela 2kg", 5000)], costela: [item("2", "Costela 2kg", 5000), item("3", "Costela suína", 3000)] });
    const opcoes = await new McpDomain(tools, local).buscarNecessidade(nec("churrasco", { consultas: ["picanha", "costela"] }), {});
    expect(tools.consultas.sort()).toEqual(["churrasco", "costela", "picanha"]);
    expect(opcoes.map((o) => o.item).sort()).toEqual(["Costela 2kg", "Costela suína", "Picanha 1kg"]);
  });

  it("uma consulta que falha não derruba a necessidade; se TODAS falham, o erro sobe", async () => {
    const ok = new Catalogo({ picanha: new Error("MCP fora"), costela: [item("2", "Costela 2kg", 5000)] });
    expect((await new McpDomain(ok, local).buscarNecessidade(nec("x", { consultas: ["picanha", "costela"] }), {})).length).toBe(1);
    const tudo = new Catalogo({ a: new Error("fora"), b: new Error("fora") });
    await expect(new McpDomain(tudo, local).buscarNecessidade(nec("a", { consultas: ["b"] }), {})).rejects.toThrow("fora");
  });
});

describe("cartão de sugestão: campos do estabelecimento, só do que o MCP devolveu", () => {
  it("opção real traz descrição de uma linha e os campos estruturados", async () => {
    const [o] = await new McpDomain(new Catalogo({ leite: [item("1", "Leite integral 1L", 600, "Mercado")] }), local).buscarNecessidade(nec("leite"), {});
    expect(o.descricao).toBe("nota 4,5 (100 avaliações) · a 1 km · entrega até 30 minutos · frete R$ 5,00");
    expect(o).toMatchObject({ distanciaKm: 1, avaliacoes: 100 });
  });
  it("promoção real aparece como preço original; sem promoção, o campo não existe", async () => {
    // O MCP devolve preço em REAIS (5,00); o domínio converte para centavos.
    const promo = { ...item("2", "Leite promo", 5, "Mercado"), promotionalUnitPrice: 4 };
    const [o] = await new McpDomain(new Catalogo({ leite: [promo] }), local).buscarNecessidade(nec("leite"), {});
    expect(o.precoOriginalCents).toBe(500);
    const [p] = await new McpDomain(new Catalogo({ leite: [item("3", "Leite normal", 5, "Mercado")] }), local).buscarNecessidade(nec("leite"), {});
    expect(p.precoOriginalCents).toBeUndefined();
  });
});
