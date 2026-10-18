// Sacola simulada (docs/PLANO_TELA_GUIDE.md, passo 3): só a aprovação explícita gera, e nada remoto é chamado.
import { describe, expect, it } from "vitest";
import { FakeDomain } from "../domain-fake";
import { montarSacola } from "../sacola";
import type { LlmPort, Necessidade, PlanoSnapshot, ResponderInput, TurnoInterpretado } from "../types";
import { executarTurno, novaSessao } from ".";

const pizza: Necessidade = { id: "n1", vertical: "RESTAURANT", categoria: "pizza calabresa", restricoes: [] };

class Roteiro implements LlmPort {
  readonly nome = "roteiro";
  constructor(private readonly turnos: Partial<TurnoInterpretado>[]) {}
  async interpretar(): Promise<TurnoInterpretado> {
    const t = this.turnos.shift();
    if (!t) throw new Error("roteiro acabou");
    return { intencao: "pedido", nivel: "L0", ocasiao: {}, necessidades: [], assumido: [], ...t };
  }
  async responder(input: ResponderInput): Promise<string> { return `Plano com ${input.plano.blocos.length} blocos. Quer ajustar algo?`; }
}

// Domínio que conta as chamadas de busca/plano: prova que aprovar não busca, não monta nem ajusta nada.
class DominioContado extends FakeDomain {
  chamadas: string[] = [];
  override async buscarNecessidade(...a: Parameters<FakeDomain["buscarNecessidade"]>) { this.chamadas.push("buscar"); return super.buscarNecessidade(...a); }
  override async montarPlano(...a: Parameters<FakeDomain["montarPlano"]>) { this.chamadas.push("montar"); return super.montarPlano(...a); }
  override async ajustarPlano(...a: Parameters<FakeDomain["ajustarPlano"]>) { this.chamadas.push("ajustar"); return super.ajustarPlano(...a); }
}

function conversa(turnos: Partial<TurnoInterpretado>[]) {
  const s = novaSessao(`s-${Math.random()}`);
  const domain = new DominioContado();
  return { domain, fale: (texto: string) => executarTurno(s, { texto, origem: "texto" }, { llm: new Roteiro(turnos), domain }) };
}

describe("sacola simulada", () => {
  it("aprovação explícita da versão atual devolve a sacola, sem chamar busca, plano ou ajuste", async () => {
    const { domain, fale } = conversa([{ necessidades: [pizza], ocasiao: { pessoas: 6 } }, { intencao: "aprovar" }]);
    const plano = (await fale("quero pizza calabresa pra seis")).tela!.plano;
    domain.chamadas = [];
    const r = await fale("aprovo o plano");
    expect(r.tela?.tipo).toBe("sacola");
    expect(r.aprovacao).toEqual({ planoId: plano.planoId, versao: plano.versao });
    const sacola = r.tela!.plano.sacola!;
    expect(sacola).toMatchObject({ planoId: plano.planoId, versao: plano.versao, simulacao: true });
    const b = plano.blocos[0];
    expect(sacola.lojas[0].itens[0]).toMatchObject({ item: b.principal.item, quantidade: b.quantidade, subtotalCents: b.quantidade * b.principal.precoCents });
    expect(domain.chamadas).toEqual([]);
    expect(r.resposta).not.toMatch(/pedido (foi )?(feito|realizado|enviado)/i);
  });

  it("botão com versão antiga não aprova: o plano mudou depois do que a pessoa viu", async () => {
    const { fale } = conversa([
      { necessidades: [{ ...pizza, categoria: "pizza" }] },
      { intencao: "ajustar", ajuste: { categoria: "pizza", criterio: "melhor_avaliada" } },
      { intencao: "aprovar" }, { intencao: "aprovar" },
    ]);
    const v1 = (await fale("quero pizza")).tela!.plano;
    const v2 = (await fale("a melhor avaliada")).tela!.plano;
    expect(v2.versao).toBe(v1.versao + 1);
    const velha = await fale(`aprovo o plano versão ${v1.versao}`);
    expect(velha.aprovacao).toBeUndefined();
    expect(velha.tela?.tipo).toBe("aguardando_aprovacao");
    expect(velha.tela?.plano.versao).toBe(v2.versao);
    const atual = await fale(`aprovo o plano versão ${v2.versao}`);
    expect(atual.tela?.tipo).toBe("sacola");
    expect(atual.aprovacao).toEqual({ planoId: v2.planoId, versao: v2.versao });
  });

  it("'sim' sozinho não gera sacola: só leva à revisão", async () => {
    const { fale } = conversa([{ necessidades: [pizza] }, { intencao: "consentir" }]);
    await fale("quero pizza calabresa");
    const r = await fale("sim");
    expect(r.tela?.tipo).toBe("aguardando_aprovacao");
    expect(r.tela?.plano.sacola).toBeUndefined();
    expect(r.aprovacao).toBeUndefined();
  });

  it("conta por loja: subtotal = quantidade × preço, frete uma vez por loja, total parcial sem frete", () => {
    const op = (loja: string, precoCents: number, freteCents?: number) => ({ ref: `${loja}-${precoCents}`, loja, item: `item ${precoCents}`, precoCents, freteCents, rotulo: "", motivo: "", origem: "simulado" as const });
    const plano: PlanoSnapshot = {
      planoId: "p1", versao: 2, naoAtendidas: [], pendencias: [], origem: "simulado",
      blocos: [
        { necessidadeId: "a", vertical: "RESTAURANT", categoria: "pizza", quantidade: 2, principal: op("Pizzaria", 5000, 800), alternativas: [] },
        { necessidadeId: "b", vertical: "RESTAURANT", categoria: "refrigerante", quantidade: 1, principal: op("Pizzaria", 1000, 800), alternativas: [] },
        { necessidadeId: "c", vertical: "SHOPPING", categoria: "presente", quantidade: 1, principal: op("Loja", 3000), alternativas: [] },
      ],
    };
    const s = montarSacola(plano);
    expect(s.lojas.map((l) => [l.loja, l.subtotalCents, l.freteCents, l.totalCents])).toEqual([["Pizzaria", 11000, 800, 11800], ["Loja", 3000, undefined, 3000]]);
    expect(s.totalCents).toBe(14800);
    expect(s.freteDesconhecido).toBe(true);
  });
});
