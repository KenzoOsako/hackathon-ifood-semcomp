import { describe, expect, it } from "vitest";
import { adicionalCents, configurarItem, impedimentosPlano, normalizarComplementos, validarSelecoes } from "./complementos";
import { montarSacola } from "./sacola";
import { McpDomain } from "./domain-mcp";
import type { ConfiguracaoItem, OpcaoPlano, PlanoSnapshot } from "./types";

// Fixture sintética seguindo os campos do exemplo oficial Discovery/getItem, sem IDs de usuário.
const detalhe = { itemId: "item", merchantId: "loja", unitPrice: 10, optionGroups: [
  { optionGroupId: "molho", name: "Molho", minSelections: 1, maxSelections: 1, options: [
    { optionId: "sem", name: "Sem molho", additionalPrice: 0 },
    { optionId: "maionese", name: "Maionese", additionalPrice: 1.5 },
    { optionId: "acabou", name: "Indisponível", additionalPrice: 2, available: false },
  ] },
  { optionGroupId: "extras", name: "Extras", minSelections: 0, maxSelections: 3, options: [
    { optionId: "guardanapo", name: "Guardanapo", additionalPrice: 0 },
    { optionId: "queijo", name: "Queijo", additionalPrice: 3 },
  ] },
] };
const opcao = (): OpcaoPlano => ({ ref: "loja:item", lojaId: "loja", loja: "Loja", item: "Lanche", precoCents: 1000, freteCents: 200, motivo: "Preço", rotulo: "mais barata", origem: "real", complementos: { status: "verificado", grupos: normalizarComplementos(detalhe, "item"), selecoes: [] } });
const plano = (): PlanoSnapshot => ({ planoId: "plano", versao: 1, origem: "real", naoAtendidas: [], pendencias: [], blocos: [{ necessidadeId: "lanche", vertical: "RESTAURANT", categoria: "lanche", quantidade: 2, principal: opcao(), alternativas: [] }] });
const input = (selecoes: ConfiguracaoItem["selecoes"]): ConfiguracaoItem => ({ planoId: "plano", versao: 1, necessidadeId: "lanche", ref: "loja:item", selecoes });
const valido = [{ grupoId: "molho", opcaoId: "maionese", quantidade: 1 }, { grupoId: "extras", opcaoId: "queijo", quantidade: 2 }, { grupoId: "extras", opcaoId: "guardanapo", quantidade: 1 }];

describe("complementos", () => {
  it("bloqueia obrigatórios vazios, permite recusar opcionais e não inventa zero para preço ausente", () => {
    expect(validarSelecoes(opcao())).toHaveLength(1);
    expect(validarSelecoes(opcao(), [{ grupoId: "molho", opcaoId: "sem", quantidade: 1 }])).toEqual([]);
    expect(() => normalizarComplementos({ ...detalhe, optionGroups: [{ ...detalhe.optionGroups[0], options: [{ optionId: "x", name: "Sem preço" }] }] }, "item")).toThrow();
  });
  it("soma adicionais por unidade e preserva escolhas na sacola", () => {
    const p = configurarItem(plano(), input(valido));
    expect(p.versao).toBe(2);
    expect(adicionalCents(p.blocos[0].principal)).toBe(750);
    const sacola = montarSacola(p);
    expect(sacola.totalCents).toBe(3700); // (1000 + 150 + 2*300) * 2 + 200
    expect(sacola.lojas[0].itens[0].complementos).toEqual(["1× Maionese", "2× Queijo", "1× Guardanapo"]);
    expect(plano().blocos[0].principal.complementos?.selecoes).toEqual([]);
  });
  it.each([
    [{ grupoId: "molho", opcaoId: "acabou", quantidade: 1 }],
    [{ grupoId: "molho", opcaoId: "maionese", quantidade: 2 }],
    [...valido, { grupoId: "extras", opcaoId: "queijo", quantidade: 1 }],
    [{ grupoId: "inexistente", opcaoId: "x", quantidade: 1 }],
    [{ grupoId: "molho", opcaoId: "sem", quantidade: 0 }],
  ])("recusa seleção inválida sem mudar o plano: %j", (...selecoes) => {
    expect(() => configurarItem(plano(), input(selecoes))).toThrow();
  });
  it("recusa versão, item ou necessidade divergente; não incrementa em reenvio idêntico", () => {
    const p = configurarItem(plano(), input(valido));
    expect(() => configurarItem(p, input(valido))).toThrow("VERSAO_DESATUALIZADA");
    expect(() => configurarItem(plano(), { ...input(valido), ref: "outro" })).toThrow("ITEM_FORA_DO_PLANO");
    expect(() => configurarItem(plano(), { ...input(valido), necessidadeId: "outra" })).toThrow("ITEM_FORA_DO_PLANO");
    expect(configurarItem(p, { ...input([...valido].reverse()), versao: 2 })).toBe(p);
  });
  it("detalhe ausente, grupos inválidos, duplicados ou aninhados não viram item sem opções", () => {
    expect(() => normalizarComplementos({ itemId: "item" }, "item")).toThrow();
    expect(() => normalizarComplementos(detalhe, "outro")).toThrow();
    expect(() => normalizarComplementos({ ...detalhe, optionGroups: [detalhe.optionGroups[0], detalhe.optionGroups[0]] }, "item")).toThrow();
    expect(() => normalizarComplementos({ ...detalhe, customizations: [{}] }, "item")).toThrow();
    expect(() => normalizarComplementos({ ...detalhe, optionGroups: [{ ...detalhe.optionGroups[0], minSelections: 2 }] }, "item")).toThrow();
  });
  it("impede sacola de plano vazio, não verificado ou sem escolhas obrigatórias", () => {
    expect(() => montarSacola(plano())).toThrow("PLANO_INCOMPLETO");
    expect(impedimentosPlano({ ...plano(), blocos: [] })).toHaveLength(1);
    const p = plano(); p.blocos[0].principal.complementos!.status = "indisponivel";
    expect(() => montarSacola(p)).toThrow("PLANO_INCOMPLETO");
  });
  it("getItem usa os IDs do item e local; falha ou identidade divergente bloqueia configuração", async () => {
    const chamadas: unknown[] = [];
    const domain = new McpDomain({ callTool: async (name,args) => { chamadas.push({name,args}); return detalhe; } }, { latitude: 1, longitude: 2, fonte: "fixa" });
    const o = await domain.detalharItem(opcao());
    expect(o.complementos?.status).toBe("verificado");
    expect(chamadas).toEqual([{name:"getItem",args:{merchantId:"loja",itemId:"item",userLocation:{latitude:1,longitude:2}}}]);
    const falha = new McpDomain({ callTool: async () => { throw new Error("INTERNAL"); } }, {latitude:1,longitude:2,fonte:"fixa"});
    expect((await falha.detalharItem(opcao())).complementos?.status).toBe("indisponivel");
    expect((await domain.detalharItem({...opcao(), lojaId:"outra"})).complementos?.status).toBe("indisponivel");
  });
});
