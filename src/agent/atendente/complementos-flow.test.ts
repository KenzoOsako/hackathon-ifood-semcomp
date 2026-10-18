import { AIMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { expect, it } from "vitest";
import { FakeDomain } from "../domain-fake";
import { novaSessao } from "../sessao";
import { executarAtendente } from ".";
import type { ConverseInput } from "../types";
import { z } from "zod";

const lanche = { categoria:"hamburguer", vertical:"RESTAURANT" };
function setup() {
  const s = novaSessao(`complementos-${Math.random()}`);
  const fila: AIMessage[] = [];
  let calls = 0;
  const modelo = {bindTools:() => ({invoke:async () => { calls++; return fila.shift() ?? new AIMessage("Confira o plano na tela."); }})} as unknown as BaseChatModel;
  const deps = {modelo,nomeModelo:"roteiro",domain:new FakeDomain()};
  const ferramenta = (name: string,args: Record<string,unknown>) => fila.push(new AIMessage({content:"",tool_calls:[{id:"tool",name,args,type:"tool_call"}]}));
  const fale = (texto:string, extra: Partial<ConverseInput> = {}) => executarAtendente(s,{texto,origem:"texto",...extra},deps);
  return {s, deps, ferramenta, fale, calls:() => calls};
}
it("plano → configuração pela UI → nova versão → revisão → sacola com adicionais", async () => {
  const {s,ferramenta,fale,calls} = setup();
  ferramenta("mostrar_plano",{itens:[lanche]});
  await fale("quero hamburguer");
  const p = s.plano!; const b = p.blocos[0];
  expect((await fale("aprovo o plano versão 1")).aprovacao).toBeUndefined();
  const antes = calls();
  const configuracao = {planoId:p.planoId,versao:p.versao,necessidadeId:b.necessidadeId,ref:b.principal.ref,selecoes:[{grupoId:"mock-molho",opcaoId:"mock-maionese",quantidade:1},{grupoId:"mock-extras",opcaoId:"mock-guardanapo",quantidade:1}]};
  const salvo = await fale("Salvar complementos",{configuracao});
  expect(calls()).toBe(antes); // UI não depende do LLM para salvar IDs e calcular.
  expect(salvo.tela?.plano.versao).toBe(2);
  expect((await fale("aprovo o plano versão 1")).aprovacao).toBeUndefined();
  expect((await fale("pode")).tela?.tipo).toBe("aguardando_aprovacao");
  const aprovado = await fale("aprovo o plano versão 2");
  expect(aprovado.tela?.tipo).toBe("sacola");
  expect(aprovado.tela?.plano.sacola?.lojas[0].itens[0].precoCents).toBe(b.principal.precoCents + 150);
  expect(aprovado.tela?.plano.sacola?.lojas[0].itens[0].complementos).toContain("1× Guardanapo");
});
it("texto/voz configura somente IDs do plano atual e mantém nova revisão",async () => {
  const {s,ferramenta,fale} = setup();
  ferramenta("mostrar_plano",{itens:[lanche]}); await fale("quero lanche");
  const b = s.plano!.blocos[0];
  ferramenta("configurar_complementos",{versao:1,necessidadeId:b.necessidadeId,ref:b.principal.ref,selecoes:[{grupoId:"mock-molho",opcaoId:"mock-sem-molho",quantidade:1}]});
  const r = await fale("sem molho e não quero extras",{origem:"voz",sinais:{origem:"voz",interrompeu:false,confianca:0.95}});
  expect(r.tela?.plano.versao).toBe(2);
  expect(r.aprovacao).toBeUndefined();
});
it.each(["não aprovo o plano versão 1","se eu aprovo o plano versão 1","aprovo o plano versão 1 mas sem queijo","aprovo o plano"])('%s não aprova',async texto => {
  const {ferramenta,fale} = setup(); ferramenta("mostrar_plano",{itens:[{categoria:"pizza",vertical:"RESTAURANT"}]}); await fale("pizza");
  expect((await fale(texto)).aprovacao).toBeUndefined();
});
it.each([0.1,0.59,0.72,0.849])("voz confiança %s não aprova nem chama ferramenta",async confianca => {
  const {ferramenta,fale,calls} = setup(); ferramenta("mostrar_plano",{itens:[{categoria:"pizza",vertical:"RESTAURANT"}]}); await fale("pizza");
  const antes = calls();
  const r = await fale("aprovo o plano versão 1",{origem:"voz",sinais:{origem:"voz",interrompeu:false,confianca}});
  expect(r.aprovacao).toBeUndefined(); expect(calls()).toBe(antes);
});
it("referência de outra categoria não substitui a opção elegível",async () => {
  const {s,ferramenta,fale} = setup();
  ferramenta("mostrar_plano",{itens:[{categoria:"pizza",vertical:"RESTAURANT",ref:"praca-xburger"}]});
  await fale("pizza"); expect(s.plano).toBeUndefined();
});
it("restrição nova transmitida por ferramenta invalida o plano anterior",async () => {
  const {s,ferramenta,fale} = setup();
  ferramenta("mostrar_plano",{itens:[{categoria:"pizza",vertical:"RESTAURANT"}]}); await fale("pizza");
  expect(s.plano).toBeDefined();
  ferramenta("buscar_no_ifood",{categoria:"pizza",vertical:"RESTAURANT",restricoes:["camarao"]});
  await fale("Sou alérgica a camarão; procure outra pizza");
  expect(s.plano).toBeUndefined(); expect(s.restricoes).toContain("camarao");
  expect((await fale("aprovo o plano versão 1")).aprovacao).toBeUndefined();
  ferramenta("mostrar_plano",{itens:[{categoria:"pizza",vertical:"RESTAURANT"}]}); await fale("busque pizza");
  expect(s.plano?.versao).toBe(2);
  expect((await fale("aprovo o plano versão 1")).aprovacao).toBeUndefined();
});
it("schemas de ferramentas não usam exclusiveMinimum incompatível com Gemini",async () => {
  let esquemas = "";
  const s = novaSessao("schema-gemini");
  const modelo = {bindTools:(tools: {schema:z.ZodType}[]) => {
    esquemas = JSON.stringify(tools.map(t => z.toJSONSchema(t.schema)));
    return {invoke:async()=>new AIMessage("O que você quer pedir?")};
  }} as unknown as BaseChatModel;
  await executarAtendente(s,{texto:"oi",origem:"texto"},{modelo,nomeModelo:"roteiro",domain:new FakeDomain()});
  expect(esquemas).not.toContain("exclusiveMinimum");
});
it("trocar o item cria nova configuração vazia e invalida escolhas antigas",async () => {
  const {s,ferramenta,fale} = setup();
  ferramenta("mostrar_plano",{itens:[lanche]}); await fale("lanche");
  const antigo=s.plano!; const b=antigo.blocos[0];
  const configuracao = {planoId:antigo.planoId,versao:1,necessidadeId:b.necessidadeId,ref:b.principal.ref,selecoes:[{grupoId:"mock-molho",opcaoId:"mock-sem-molho",quantidade:1}]};
  await fale("salvar",{configuracao});
  ferramenta("mostrar_plano",{itens:[{categoria:"pizza",vertical:"RESTAURANT"}]}); await fale("troca por pizza");
  expect(s.plano!.blocos[0].principal.complementos?.selecoes).toEqual([]);
  const atual = s.plano;
  await fale("salvar",{configuracao}); expect(s.plano).toBe(atual);
});
