import { describe, expect, it } from "vitest";
import amostras from "./__fixtures__/search-sao-carlos.json";
import { McpDomain, type McpTools } from ".";

// Respostas reais gravadas do searchOffers (USP São Carlos, sábado ~22h): pizza com lojas abertas,
// pipoca com abertas e fechadas, presente só com lojas fechadas.
class ToolsGravadas implements McpTools {
  readonly chamadas: { name: string; args: Record<string, unknown> }[] = [];
  async callTool(name: string, args: Record<string, unknown>) {
    this.chamadas.push({ name, args });
    const q = String(args.query ?? "");
    const chave = (["pizza", "pipoca", "presente"] as const).find((k) => q.includes(k));
    return chave ? amostras[chave] : { results: [] };
  }
}

const local = { latitude: -22.0069, longitude: -47.8946, fonte: "fixa" as const };
const pizza = { id: "n1", vertical: "RESTAURANT" as const, categoria: "pizza", restricoes: [] };

describe("McpDomain com respostas reais gravadas", () => {
  it("não exclui ofertas por teto de preço legado", async () => {
    const d = new McpDomain(new ToolsGravadas(), local);
    const semTeto = await d.buscarNecessidade(pizza, {});
    const comTeto = await d.buscarNecessidade({ ...pizza, orcamento: { max: 1, tipo: "teto" } }, {});
    expect(comTeto.map(o => o.ref)).toEqual(semTeto.map(o => o.ref));
    expect(comTeto.some(o => o.precoCents > 100)).toBe(true);
  });
  it("chama searchOffers com o contrato real e só devolve lojas abertas com entrega", async () => {
    const tools = new ToolsGravadas();
    const opcoes = await new McpDomain(tools, local).buscarNecessidade(pizza, {});
    expect(tools.chamadas[0]).toMatchObject({ name: "searchOffers", args: { query: "pizza", resultKind: "ITEM", merchantType: "RESTAURANT", userLocation: { latitude: -22.0069, longitude: -47.8946 }, refinements: { onlyOpen: true } } });
    expect(opcoes.length).toBeGreaterThan(0);
    expect(opcoes.every((o) => o.origem === "real")).toBe(true);
    const abertas = new Set(amostras.pizza.results.filter((r) => r.merchant.isOpen).map((r) => r.merchant.merchantName));
    expect(opcoes.every((o) => abertas.has(o.loja))).toBe(true);
  });

  it("rótulo e motivo vêm de campo real e a nota é arredondada", async () => {
    const opcoes = await new McpDomain(new ToolsGravadas(), local).buscarNecessidade(pizza, {});
    const principal = opcoes[0];
    expect(["mais barata", "mais rápida", "melhor avaliada"]).toContain(principal.rotulo);
    for (const o of opcoes) if (o.nota !== undefined) expect(String(o.nota)).toMatch(/^\d(\.\d)?$/);
    const custo = (o: typeof principal) => o.precoCents + (o.freteCents ?? 0);
    if (principal.rotulo === "mais barata") expect(custo(principal)).toBe(Math.min(...opcoes.map(custo)));
  });

  it("presente só com lojas fechadas vira necessidade não atendida, não opção", async () => {
    const d = new McpDomain(new ToolsGravadas(), local);
    const n = { id: "n3", vertical: "SHOPPING" as const, categoria: "presente", restricoes: [] };
    const opcoes = await d.buscarNecessidade(n, {});
    expect(opcoes).toEqual([]);
    const plano = await d.montarPlano({ subjectRef: "s", ocasiao: {}, itens: [{ necessidade: n, opcoes }] });
    expect(plano.naoAtendidas.map((x) => x.categoria)).toEqual(["presente"]);
  });

  it("alergia sem filtro oficial nem composição exclui tudo em vez de arriscar", async () => {
    const opcoes = await new McpDomain(new ToolsGravadas(), local).buscarNecessidade({ ...pizza, restricoes: ["amendoim"] }, {});
    expect(opcoes).toEqual([]);
  });

  it("lactose vai para o filtro oficial do MCP e o plano pede confirmação", async () => {
    const tools = new ToolsGravadas();
    const d = new McpDomain(tools, local);
    const n = { ...pizza, restricoes: ["lactose"] };
    const opcoes = await d.buscarNecessidade(n, {});
    expect(tools.chamadas[0].args.refinements).toMatchObject({ itemRestrictions: ["LAC_FREE"] });
    const plano = await d.montarPlano({ subjectRef: "s", ocasiao: {}, itens: [{ necessidade: n, opcoes }] });
    expect(plano.pendencias.join(" ")).toMatch(/composição/);
  });

  it("ajuste reordena com os candidatos guardados, sem nova chamada ao MCP", async () => {
    const tools = new ToolsGravadas();
    const d = new McpDomain(tools, local);
    const opcoes = await d.buscarNecessidade(pizza, {});
    const v1 = await d.montarPlano({ subjectRef: "s", ocasiao: { pessoas: 6 }, itens: [{ necessidade: pizza, opcoes }] });
    const chamadasAntes = tools.chamadas.length;
    const v2 = await d.ajustarPlano({ subjectRef: "s", planoId: v1.planoId, versao: 1, categoria: "pizza", criterio: "melhor_avaliada" });
    expect(tools.chamadas.length).toBe(chamadasAntes);
    expect(v1.blocos[0].quantidade).toBe(2);
    if (v2.versao === 2) expect(v2.blocos[0].principal.rotulo).toBe("melhor avaliada");
    await expect(d.ajustarPlano({ subjectRef: "outro", planoId: v1.planoId, versao: v2.versao, criterio: "outra" })).rejects.toThrow("PLANO_INEXISTENTE");
    await expect(d.ajustarPlano({ subjectRef: "s", planoId: v1.planoId, versao: v2.versao, criterio: "favorita" })).rejects.toThrow("SEM_DADO_CRITERIO");
  });

});
