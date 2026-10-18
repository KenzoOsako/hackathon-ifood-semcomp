import { describe, expect, it, vi } from "vitest";
import type { CandidatoJulgado, Necessidade, RelevancePort, Veredito } from "../types";
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

// Juiz falso: veredito por NOME do item.
const juiz = (v: Record<string, Veredito>): RelevancePort => ({ julgar: async (_n, cs: CandidatoJulgado[]) => new Map(cs.map((c) => [c.ref, v[c.item] ?? "nao_serve"])) });

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

describe("relevância na busca (mecanismo geral)", () => {
  const catalogo = () => new Catalogo({ churrasco: [item("1", "Pudim", 500, "Doces"), item("2", "X-Burger", 1500, "Lanches"), item("3", "Picanha 1kg", 6000, "Açougue")] });

  it("sem juiz o comportamento é o de antes: o mais barato vence, sem filtrar", async () => {
    const o = await new McpDomain(catalogo(), local).buscarNecessidade(nec("churrasco"), {});
    expect(o.map((x) => x.item)).toContain("Pudim");
    expect(o.every((x) => x.cobertura === undefined)).toBe(true);
  });

  it("com juiz, só o que SERVE entra: o item barato e errado não vence o certo e mais caro", async () => {
    const o = await new McpDomain(catalogo(), local).buscarNecessidade(nec("churrasco"), {}, { relevancia: juiz({ "Picanha 1kg": "serve", "X-Burger": "proximo" }) });
    expect(o.map((x) => x.item)).toEqual(["Picanha 1kg"]);
    expect(o[0].cobertura).toBeUndefined(); // exata
  });

  it("sem nada que sirva, o mais parecido entra marcado e rotulado como tal (nunca como 'mais barata')", async () => {
    const o = await new McpDomain(catalogo(), local).buscarNecessidade(nec("churrasco"), {}, { relevancia: juiz({ "X-Burger": "proximo" }) });
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ item: "X-Burger", cobertura: "proxima", rotulo: "mais parecida" });
    expect(o[0].motivo).toContain("não encontrei \"churrasco\"");
  });

  it("nada serve e nada é parecido: lista vazia (o Guide diz que não achou)", async () => {
    expect(await new McpDomain(catalogo(), local).buscarNecessidade(nec("churrasco"), {}, { relevancia: juiz({}) })).toEqual([]);
  });

  it("sugestão do próprio Guide nunca vira 'mais parecida'", async () => {
    const o = await new McpDomain(catalogo(), local).buscarNecessidade(nec("churrasco", { fonte: "inferido" }), {}, { relevancia: juiz({ "X-Burger": "proximo" }) });
    expect(o).toEqual([]);
  });

  it("o plano carrega a cobertura no bloco e a falta em naoAtendidas", async () => {
    const d = new McpDomain(catalogo(), local);
    const parecido = nec("churrasco");
    const opcoes = await d.buscarNecessidade(parecido, {}, { relevancia: juiz({ "X-Burger": "proximo" }) });
    const plano = await d.montarPlano({ subjectRef: "s", ocasiao: {}, itens: [{ necessidade: parecido, opcoes }] });
    expect(plano.blocos[0].cobertura).toBe("proxima");
    const vazio = nec("carvão", { id: "n2" });
    const sem = await d.buscarNecessidade(vazio, {}, { relevancia: juiz({}) });
    const plano2 = await d.montarPlano({ subjectRef: "s", ocasiao: {}, itens: [{ necessidade: vazio, opcoes: sem }] });
    expect(plano2.naoAtendidas.map((n) => n.categoria)).toEqual(["carvão"]);
  });

  it("o juiz avalia primeiro os itens de texto mais próximo do pedido", async () => {
    const julgar = vi.fn(async (_n: Necessidade, cs: CandidatoJulgado[]) => new Map(cs.map((c) => [c.ref, "serve" as Veredito])));
    await new McpDomain(new Catalogo({ leite: [item("1", "Pudim", 300), item("2", "Biscoito", 400), item("3", "Leite integral 1L", 600)] }), local).buscarNecessidade(nec("leite"), {}, { relevancia: { julgar } });
    expect(julgar.mock.calls[0][1][0].item).toBe("Leite integral 1L");
  });

  it("pool maior: o item certo, longe do topo do ranking por preço, ainda é encontrado", async () => {
    const baratos = Array.from({ length: 30 }, (_, i) => item(`b${i}`, `Bala ${i}`, 100 + i, "Doceria"));
    const catalogo2 = new Catalogo({ leite: [...baratos, item("x", "Leite integral 1L", 900, "Mercado")] });
    const com = await new McpDomain(catalogo2, local).buscarNecessidade(nec("leite"), {}, { relevancia: juiz({ "Leite integral 1L": "serve" }) });
    expect(com.map((o) => o.item)).toEqual(["Leite integral 1L"]);
    const sem = await new McpDomain(catalogo2, local).buscarNecessidade(nec("leite"), {});
    expect(sem.map((o) => o.item)).not.toContain("Leite integral 1L"); // antes: só os 10 mais baratos entravam
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
