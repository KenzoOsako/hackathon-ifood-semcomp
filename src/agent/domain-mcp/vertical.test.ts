import { describe, expect, it } from "vitest";
import amostras from "./__fixtures__/search-sao-carlos.json";
import { McpDomain, type McpTools } from ".";
import type { LlmPort, Necessidade, Veredito } from "../types";
import { criarRelevancia } from "../relevancia";

const local = { latitude: -22.0069, longitude: -47.8946, fonte: "fixa" as const };
const pipoca: Necessidade = { id: "n1", vertical: "GROCERIES", categoria: "pipoca", restricoes: [] };

// Região sem catálogo de mercado: GROCERIES vem vazio, RESTAURANT tem tudo.
class SoRestaurante implements McpTools {
  readonly tipos: string[] = [];
  async callTool(_n: string, args: Record<string, unknown>) {
    this.tipos.push(String(args.merchantType));
    return args.merchantType === "RESTAURANT" ? amostras.pipoca : { results: [] };
  }
}

describe("vertical sem catálogo na região", () => {
  it("busca na alternativa e, depois de 2 vazios, nem tenta mais a vertical vazia", async () => {
    const tools = new SoRestaurante();
    const d = new McpDomain(tools, local);
    expect((await d.buscarNecessidade(pipoca, {})).length).toBeGreaterThan(0);
    expect(tools.tipos).toEqual(["GROCERIES", "RESTAURANT"]);
    await d.buscarNecessidade(pipoca, {});
    tools.tipos.length = 0;
    await d.buscarNecessidade(pipoca, {});
    expect(tools.tipos).toEqual(["RESTAURANT"]); // aprendeu: sem chamada à toa
  });
});

describe("item avulso só aparece sem o item completo", () => {
  const juiz = (v: (item: string) => Veredito): Pick<LlmPort, "julgar"> => ({ julgar: async ({ candidatos }) => Object.fromEntries(candidatos.map((c) => [c.ref, v((c as unknown as { item: string }).item)])) });
  const itens = amostras.pizza.results.map((r) => r.itemName);

  it("com um completo, o avulso sai", async () => {
    const completo = itens[0];
    const rel = criarRelevancia(juiz((i) => (i === completo ? "serve" : "avulso")));
    const o = await new McpDomain({ callTool: async () => amostras.pizza }, local).buscarNecessidade({ id: "n", vertical: "RESTAURANT", categoria: "pizza", restricoes: [] }, {}, { relevancia: rel });
    expect(o.length).toBeGreaterThan(0);
    expect(o.every((x) => x.item === completo)).toBe(true);
  });

  it("sem nenhum completo, o avulso entra como exato", async () => {
    const rel = criarRelevancia(juiz(() => "avulso"));
    const o = await new McpDomain({ callTool: async () => amostras.pizza }, local).buscarNecessidade({ id: "n", vertical: "RESTAURANT", categoria: "pizza", restricoes: [] }, {}, { relevancia: rel });
    expect(o.length).toBeGreaterThan(0);
    expect(o[0].cobertura).toBeUndefined();
  });
});

import { escolhaEquilibrada } from ".";

describe("a frente da lista não é a mais barata", () => {
  const c = (ref: string, precoCents: number, nota?: number) => ({ precoCents, nota, opcao: { ref, loja: "L", item: ref, precoCents, rotulo: "", motivo: "", origem: "real" as const } }) as never;
  it("preço muito abaixo da mediana (suspeito de parcial) vai para trás, mesmo sendo o mais barato", () => {
    const l = escolhaEquilibrada([c("esfiha", 600, 4.7), c("churrasco-a", 4500, 4.5), c("churrasco-b", 5200, 4.6), c("churrasco-c", 4800, 4.2)]);
    expect(l.map((x: { opcao: { ref: string } }) => x.opcao.ref)).toEqual(["churrasco-b", "churrasco-a", "churrasco-c", "esfiha"]);
  });
  it("lista curta não é reordenada", () => {
    const l = [c("a", 600, 4.7), c("b", 4500, 4.5)];
    expect(escolhaEquilibrada(l)).toEqual(l);
  });
});

describe("sonda de catálogo", () => {
  it("vertical que não devolve nada aqui entra em semCatalogo", async () => {
    const tools: McpTools = { callTool: async (_n, a) => (a.merchantType === "GROCERIES" ? { results: [] } : amostras.pizza) };
    const d = new McpDomain(tools, { latitude: 1.23, longitude: 4.56, fonte: "fixa" });
    await d.sondarCatalogo();
    expect(d.semCatalogo()).toEqual(["GROCERIES"]);
  });
});
