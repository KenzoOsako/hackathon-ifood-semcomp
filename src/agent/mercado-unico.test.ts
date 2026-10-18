import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { FakeDomain } from "./domain-fake";
import { executarAtendente, reiniciarAtendente } from "./atendente";
import { novaSessao } from "./sessao";
import { pendenciasDeMinimo, rankingMercados, unificarMercado } from "./mercado-unico";
import type { BlocoPlano, OpcaoPlano, PlanoSnapshot } from "./types";

const op = (ref: string, lojaId: string, precoCents: number, extra: Partial<OpcaoPlano> = {}): OpcaoPlano =>
  ({ ref, loja: `Loja ${lojaId}`, lojaId, item: ref, precoCents, freteCents: 500, rotulo: "", motivo: "", origem: "real", ...extra });
const bloco = (id: string, opcoes: OpcaoPlano[], vertical: BlocoPlano["vertical"] = "GROCERIES"): BlocoPlano =>
  ({ necessidadeId: id, vertical, categoria: id, quantidade: 1, principal: opcoes[0], alternativas: opcoes.slice(1, 3) });
const plano = (blocos: BlocoPlano[]): PlanoSnapshot => ({ planoId: "p", versao: 1, blocos, naoAtendidas: [], pendencias: [], origem: "real" });

describe("mercado único", () => {
  // Sem unificar, cada ingrediente fica com a primeira opção da sua busca: farinha num mercado, leite em outro.
  const listas: Record<string, OpcaoPlano[]> = {
    farinha: [op("A-farinha", "A", 500), op("B-farinha", "B", 550)],
    ovos: [op("A-ovos", "A", 1100), op("B-ovos", "B", 1200)],
    leite: [op("B-leite", "B", 550), op("C-leite", "C", 500)],
    fermento: [op("B-fermento", "B", 450)],
  };
  const espalhado = () => plano(Object.entries(listas).map(([id, l]) => bloco(id, l)));

  it("escolhe o mercado que tem mais itens e põe a lista toda nele", async () => {
    expect(rankingMercados(Object.values(listas))[0].lojaId).toBe("B");
    const { plano: p, faltas } = await unificarMercado(espalhado(), (id) => listas[id], new Set());
    expect(p.blocos.map((b) => b.principal.lojaId)).toEqual(["B", "B", "B", "B"]);
    // A opção que saiu continua como alternativa (trocar tocando).
    expect(p.blocos[0].alternativas.map((o) => o.ref)).toContain("A-farinha");
    expect(faltas).toEqual([]);
  });

  it("completa no mercado escolhido com a busca dentro da loja", async () => {
    const semFermentoEmA: Record<string, OpcaoPlano[]> = { ...listas, fermento: [op("C-fermento", "C", 400)] };
    const pedidas: string[] = [];
    const { plano: p } = await unificarMercado(plano(Object.entries(semFermentoEmA).map(([id, l]) => bloco(id, l))), (id) => semFermentoEmA[id], new Set(),
      async (b, lojaId) => { pedidas.push(`${b.categoria}@${lojaId}`); return lojaId === "B" ? [op("B-fermento-2", "B", 480)] : []; });
    expect(pedidas).toContain("fermento@B");
    expect(p.blocos.every((b) => b.principal.lojaId === "B")).toBe(true);
  });

  it("o que o mercado não tem não vem de outro sozinho: vira falta, com as opções de fora para a pessoa decidir", async () => {
    const soEmC: Record<string, OpcaoPlano[]> = { ...listas, fermento: [op("C-fermento", "C", 400)] };
    const { plano: p, faltas } = await unificarMercado(plano(Object.entries(soEmC).map(([id, l]) => bloco(id, l))), (id) => soEmC[id], new Set(), async () => []);
    expect(new Set(p.blocos.map((b) => b.principal.lojaId))).toEqual(new Set(["B"]));
    expect(p.blocos.map((b) => b.categoria)).not.toContain("fermento");
    expect(p.naoAtendidas).toEqual([expect.objectContaining({ categoria: "fermento", motivo: expect.stringMatching(/outro pedido/) })]);
    expect(faltas[0].foraDaLoja.map((o) => o.ref)).toEqual(["C-fermento"]);
  });

  it("não troca o que a pessoa escolheu, e o mercado dela vira o da lista", async () => {
    const p0 = espalhado();
    p0.blocos[0] = { ...p0.blocos[0], principal: listas.farinha[0] }; // escolheu a farinha do A
    const { plano: p } = await unificarMercado(p0, (id) => listas[id], new Set(["farinha"]));
    expect(p.blocos.find((b) => b.categoria === "farinha")!.principal.ref).toBe("A-farinha");
    expect(p.blocos.find((b) => b.categoria === "ovos")!.principal.lojaId).toBe("A");
  });

  it("não mexe em restaurante nem shopping, nem num plano com um item de mercado só", async () => {
    const p0 = plano([bloco("bolo", [op("X-bolo", "X", 7000)], "RESTAURANT"), bloco("flores", [op("Y-flor", "Y", 9000)], "SHOPPING"), bloco("leite", listas.leite)]);
    const { plano: p } = await unificarMercado(p0, () => [], new Set());
    expect(p).toBe(p0);
  });

  it("pedido mínimo é somado por loja", () => {
    const b = (id: string, preco: number) => bloco(id, [op(id, "B", preco, { pedidoMinimoCents: 2000 })]);
    expect(pendenciasDeMinimo([b("a", 900), b("b", 900)], ["Loja B tem pedido mínimo de R$ 20,00", "outra"])).toEqual(["Loja B tem pedido mínimo de R$ 20,00", "outra"]);
    expect(pendenciasDeMinimo([b("a", 1200), b("b", 900)], ["Loja B tem pedido mínimo de R$ 20,00", "outra"])).toEqual(["outra"]);
  });
});

describe("mercado único no atendente (mock)", () => {
  it("pedido mínimo é o da loja escolhida, não o da 1ª opção da busca", async () => {
    // Pipoca: a 1ª do mock é a do Mercado do Bairro (mínimo R$ 25); a pessoa escolhe a do Mercado Central (mínimo R$ 30).
    const fila = [
      new AIMessage({ content: "", tool_calls: [{ id: "t", type: "tool_call" as const, name: "mostrar_plano", args: { itens: [{ categoria: "pipoca", vertical: "GROCERIES", ref: "central-pipoca" }] } }] }),
      new AIMessage("Montei. É isso?"),
    ];
    const modelo = { bindTools: () => ({ invoke: async () => fila.shift()! }) } as unknown as BaseChatModel;
    const s = novaSessao(`minimo-${Math.random()}`);
    reiniciarAtendente(s.subjectRef);
    const r = await executarAtendente(s, { texto: "quero pipoca", origem: "texto" }, { modelo, nomeModelo: "roteiro", domain: new FakeDomain() });
    const pend = r.tela!.plano.pendencias.join(" | ");
    expect(r.tela!.plano.blocos[0].principal.loja).toBe("Mercado Central");
    expect(pend).toMatch(/Mercado Central tem pedido mínimo de R\$ 30,00/);
    expect(pend).not.toMatch(/Mercado do Bairro/);
  });

  it("ingredientes do bolo saem de um mercado só; as flores continuam na floricultura", async () => {
    // Prova de que o mock espalha: sozinha, a farinha mais rápida é do Empório, não do Mercado do Bairro.
    expect((await new FakeDomain().buscarNecessidade({ id: "n", categoria: "farinha de trigo", vertical: "GROCERIES", restricoes: [] }, {}))[0].loja).toBe("Empório Express");
    const ingredientes = ["farinha de trigo", "ovos", "açúcar", "chocolate em pó", "leite", "manteiga", "fermento em pó"].map((categoria) => ({ categoria, vertical: "GROCERIES" }));
    const fila = [
      new AIMessage({ content: "", tool_calls: [{ id: "t", type: "tool_call" as const, name: "mostrar_plano", args: { itens: [...ingredientes, { categoria: "rosas", vertical: "SHOPPING" }] } }] }),
      new AIMessage("Montei a lista. É isso?"),
    ];
    const modelo = { bindTools: () => ({ invoke: async () => fila.shift()! }) } as unknown as BaseChatModel;
    const s = novaSessao(`mercado-${Math.random()}`);
    reiniciarAtendente(s.subjectRef);
    const r = await executarAtendente(s, { texto: "quero fazer o bolo", origem: "texto" }, { modelo, nomeModelo: "roteiro", domain: new FakeDomain() });
    const blocos = r.tela!.plano.blocos;
    expect(blocos.filter((b) => b.vertical === "GROCERIES")).toHaveLength(7);
    expect(new Set(blocos.filter((b) => b.vertical === "GROCERIES").map((b) => b.principal.loja))).toEqual(new Set(["Mercado do Bairro"]));
    expect(blocos.find((b) => b.vertical === "SHOPPING")!.principal.loja).toBe("Casa dos Presentes");
  });
});
