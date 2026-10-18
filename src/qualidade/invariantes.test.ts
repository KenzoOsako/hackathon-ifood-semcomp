import { describe, expect, it } from "vitest";
import type { AgentReply, OpcaoPlano, PlanoSnapshot } from "@/agent/types";
import { INVARIANTES, checarInvariantes, type ContextoTurno } from "./invariantes";

const opcao = (item: string, loja: string, extra: Partial<OpcaoPlano> = {}): OpcaoPlano => ({ ref: `${loja}:${item}`, loja, item, precoCents: 3990, freteCents: 590, prazo: "até 35 minutos", nota: 4.4, rotulo: "mais barata", motivo: "menor preço", origem: "real", ...extra });
const plano = (extra: Partial<PlanoSnapshot> = {}): PlanoSnapshot => ({ planoId: "p1", versao: 1, blocos: [{ necessidadeId: "n1", vertical: "RESTAURANT", categoria: "pizza calabresa", quantidade: 1, principal: opcao("pizza calabresa grande", "Forno e Cia"), alternativas: [] }], naoAtendidas: [], pendencias: [], origem: "real", ...extra });
const reply = (resposta: string, extra: Partial<AgentReply> = {}): AgentReply => ({ estado: "S3", nivel: "L0", resposta, origem: "real", llm: "t", tempos: { interpretarMs: 1, totalMs: 2 }, ...extra });
const ctx = (resposta: string, extra: Partial<AgentReply> = {}, resto: Partial<ContextoTurno> = {}): ContextoTurno => ({ texto: "pizza calabresa grande", reply: reply(resposta, extra), sessao: { perguntasFeitas: 0 }, ...resto });
const ids = (c: ContextoTurno) => checarInvariantes(c).map((v) => v.id);

describe("oráculo de invariantes: o caso saudável passa", () => {
  it("fala correta sobre o plano não viola nada", () => {
    expect(ids(ctx("Montei assim: pizza calabresa grande da Forno e Cia, mais barata. Quer ajustar algo?", { tela: { tipo: "mostrar_plano", plano: plano() } }))).toEqual([]);
  });
  it("toda invariante tem id único e descrição", () => {
    expect(new Set(INVARIANTES.map((i) => i.id)).size).toBe(INVARIANTES.length);
    expect(INVARIANTES.every((i) => i.descricao.length > 10)).toBe(true);
  });
});

// Cada invariante precisa DETECTAR a violação que existe para impedir (é isto que impede a falha de voltar).
describe("oráculo de invariantes: cada regra pega a falha que existe para impedir", () => {
  it("resposta_nao_vazia", () => expect(ids(ctx("   "))).toContain("resposta_nao_vazia"));

  for (const fala of ["Adicionei duas unidades de pizza. Quer ajustar algo?", "Coloquei a pizza no carrinho.", "Comprei a pizza para você.", "Reservei a pizza da Forno e Cia.", "Finalizei o seu pedido."]) {
    it(`sem_acao_de_compra: "${fala.slice(0, 32)}…"`, () => expect(ids(ctx(fala))).toContain("sem_acao_de_compra"));
  }
  it("sem_acao_de_compra não confunde 'Enviei sua aprovação' (frase fixa legítima)", () => {
    expect(ids(ctx("Enviei sua aprovação desta versão do plano para validação. Confira na tela; a compra termina no iFood."))).not.toContain("sem_acao_de_compra");
  });

  it("numeros_no_plano: preço que não está no plano", () => {
    expect(ids(ctx("Montei assim: pizza calabresa grande da Forno e Cia por R$ 12,34. Quer ajustar algo?", { tela: { tipo: "mostrar_plano", plano: plano() } }))).toContain("numeros_no_plano");
  });

  it("nomes_no_plano: loja inventada", () => {
    expect(ids(ctx("Montei assim: pizza calabresa grande da Pizzaria Fantasma, mais barata. Quer ajustar algo?", { tela: { tipo: "mostrar_plano", plano: plano() } }))).toContain("nomes_no_plano");
  });
  it("nomes_no_plano: início de frase e nomes do plano não contam", () => {
    expect(ids(ctx("Troquei: pizza calabresa grande da Forno e Cia. Quer ajustar algo?", { tela: { tipo: "plano_atualizado", plano: plano() } }))).not.toContain("nomes_no_plano");
  });

  for (const [rotulo, fala] of [["markdown", "**Pizza** da Forno e Cia"], ["lista", "- pizza\n- pipoca"], ["emoji", "Pronto 🍕"], ["link", "Veja em https://ifood.com.br"], ["longa", "Texto. ".repeat(6)]] as const) {
    it(`fala_valida: ${rotulo}`, () => expect(ids(ctx(fala))).toContain("fala_valida"));
  }

  it("sem_dado_pessoal: telefone e endereço na fala", () => {
    expect(ids(ctx("Ligue para (16) 99999-1234."))).toContain("sem_dado_pessoal");
    expect(ids(ctx("Entrego na Rua das Flores, 123."))).toContain("sem_dado_pessoal");
  });

  it("nao_repete: a mesma resposta duas vezes seguidas", () => {
    expect(ids(ctx("Eu ajudo com refeição, mercado e presentes.", {}, { anterior: "Eu ajudo com refeição, mercado e presentes." }))).toContain("nao_repete");
    expect(ids(ctx("Outra coisa.", {}, { anterior: "Eu ajudo com refeição." }))).not.toContain("nao_repete");
  });

  it("perguntas_no_teto: a quarta pergunta", () => {
    expect(ids(ctx("Quantas pessoas?", {}, { sessao: { perguntasFeitas: 4 } }))).toContain("perguntas_no_teto");
    expect(ids(ctx("Quantas pessoas?", {}, { sessao: { perguntasFeitas: 3 } }))).not.toContain("perguntas_no_teto");
  });

  it("aprovacao_so_explicita: 'sim', 'pode' e 'fechou' nunca aprovam; a frase explícita aprova", () => {
    for (const texto of ["sim", "pode", "fechou", "pode fechar o pedido"]) {
      expect(ids(ctx("Enviei sua aprovação.", { aprovacao: { planoId: "p1", versao: 1 } }, { texto }))).toContain("aprovacao_so_explicita");
    }
    expect(ids(ctx("Enviei sua aprovação.", { aprovacao: { planoId: "p1", versao: 1 } }, { texto: "Aprovo o plano" }))).not.toContain("aprovacao_so_explicita");
  });

  it("cobertura_honesta: aproximado dito como o pedido, e falta não dita", () => {
    const aproximado = plano({ blocos: [{ ...plano().blocos[0], categoria: "churrasco", cobertura: "proxima", principal: opcao("X-Burger", "Lanches", { cobertura: "proxima" }) }] });
    expect(ids(ctx("Montei seu churrasco: X-Burger da Lanches. Quer ajustar algo?", { tela: { tipo: "mostrar_plano", plano: aproximado } }))).toContain("cobertura_honesta");
    expect(ids(ctx("Não achei churrasco; o mais parecido é X-Burger da Lanches. Quer ajustar algo?", { tela: { tipo: "mostrar_plano", plano: aproximado } }))).not.toContain("cobertura_honesta");
    const faltou = plano({ naoAtendidas: [{ categoria: "presente", motivo: "sem opção" }] });
    expect(ids(ctx("Montei assim: pizza calabresa grande da Forno e Cia. Quer ajustar algo?", { tela: { tipo: "mostrar_plano", plano: faltou } }))).toContain("cobertura_honesta");
    expect(ids(ctx("Montei assim: pizza calabresa grande da Forno e Cia. Ainda não tenho opção para presente. Quer ajustar algo?", { tela: { tipo: "mostrar_plano", plano: faltou } }))).not.toContain("cobertura_honesta");
  });

  it("checarInvariantes aceita ignorar uma regra (para testar as outras isoladamente)", () => {
    expect(checarInvariantes(ctx("Coloquei no carrinho."), ["sem_acao_de_compra"])).toEqual([]);
  });
});
