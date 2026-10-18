import { describe, expect, it, vi } from "vitest";
import { respostaTemplate } from "@/prompts/responder";
import type { ContextoBusca, DomainPort, LlmPort, Necessidade, OpcaoPlano, PlanoSnapshot, TurnoInterpretado } from "../types";
import { executarTurno, novaSessao } from ".";

const opcao = (item: string, loja: string, extra: Partial<OpcaoPlano> = {}): OpcaoPlano => ({ ref: `${loja}:${item}`, loja, item, precoCents: 5000, freteCents: 500, prazo: "até 30 minutos", nota: 4.5, rotulo: "mais barata", motivo: "menor preço", origem: "real", ...extra });
const plano = (blocos: PlanoSnapshot["blocos"], naoAtendidas: PlanoSnapshot["naoAtendidas"] = []): PlanoSnapshot => ({ planoId: "p1", versao: 1, blocos, naoAtendidas, pendencias: [], origem: "real" });
const bloco = (categoria: string, principal: OpcaoPlano, extra: object = {}) => ({ necessidadeId: "n1", vertical: "GROCERIES" as const, categoria, quantidade: 1, principal, alternativas: [], ...extra });

// Domínio falso que devolve um plano pronto e anota o que o orquestrador lhe passou.
function dominio(p: PlanoSnapshot) {
  const contextos: (ContextoBusca | undefined)[] = [];
  const d: DomainPort = {
    buscarNecessidade: async (_n: Necessidade, _o, ctx) => { contextos.push(ctx); return []; },
    montarPlano: async () => structuredClone(p),
    ajustarPlano: async () => structuredClone(p),
    registrarEvento: async () => undefined,
  };
  return { d, contextos };
}

class Llm implements LlmPort {
  readonly nome = "teste";
  constructor(private readonly fala: string, private readonly turno: Partial<TurnoInterpretado> = {}) {}
  async interpretar(): Promise<TurnoInterpretado> {
    return { intencao: "pedido", nivel: "L0", ocasiao: {}, necessidades: [{ id: "n1", vertical: "GROCERIES", categoria: "churrasco", restricoes: [] }], assumido: [], ...this.turno };
  }
  async responder(): Promise<string> { return this.fala; }
}

const parecido = plano([bloco("churrasco", opcao("X-Burger", "Lanches", { cobertura: "proxima", rotulo: "mais parecida" }), { cobertura: "proxima" })]);

describe("cobertura: o Guide diz a verdade sobre o que achou", () => {
  it("template: 'não achei X; o mais parecido é Y' em vez de 'montei assim'", () => {
    const fala = respostaTemplate({ plano: parecido, assumido: [] });
    expect(fala).toContain("Não achei churrasco; o mais parecido é X-Burger da Lanches.");
    expect(fala).not.toMatch(/Montei assim/);
  });

  it("template com bloco exato e bloco aproximado: diz os dois, cada um do seu jeito", () => {
    const misto = plano([bloco("leite", opcao("Leite 1L", "Mercado")), { ...bloco("churrasco", opcao("X-Burger", "Lanches", { cobertura: "proxima" })), necessidadeId: "n2", cobertura: "proxima" as const }]);
    const fala = respostaTemplate({ plano: misto, assumido: [] });
    expect(fala).toMatch(/Montei assim: Leite 1L da Mercado/);
    expect(fala).toMatch(/Não achei churrasco; o mais parecido é X-Burger/);
  });

  it("fala do LLM que apresenta o aproximado como se fosse o pedido é trocada pelo template", async () => {
    const { d } = dominio(parecido);
    const r = await executarTurno(novaSessao("s1"), { texto: "quero churrasco", origem: "texto" }, { llm: new Llm("Montei seu churrasco: X-Burger da Lanches. Quer ajustar algo?"), domain: d });
    expect(r.resposta).toContain("Não achei churrasco");
  });

  it("fala do LLM que já diz que é aproximado é mantida", async () => {
    const { d } = dominio(parecido);
    const fala = "Não achei churrasco por aqui; o mais parecido é o X-Burger da Lanches. Quer ajustar algo?";
    const r = await executarTurno(novaSessao("s2"), { texto: "quero churrasco", origem: "texto" }, { llm: new Llm(fala), domain: d });
    expect(r.resposta).toBe(fala);
  });
});

describe("a fala não afirma ações que o Guide não faz", () => {
  const exato = plano([bloco("pizza", opcao("Pizza Calabresa", "Forno"))]);
  for (const frase of ["Adicionei duas unidades de pizza da Forno. Quer ajustar algo?", "Coloquei no carrinho a pizza da Forno. Quer ajustar algo?", "Comprei a pizza da Forno. Quer ajustar algo?", "Reservei a pizza da Forno. Quer ajustar algo?"]) {
    it(`"${frase.split(".")[0]}" cai no template`, async () => {
      const { d } = dominio(exato);
      const r = await executarTurno(novaSessao(`s-${frase.length}`), { texto: "pizza calabresa grande", origem: "texto" }, { llm: new Llm(frase, { necessidades: [{ id: "n1", vertical: "RESTAURANT", categoria: "pizza calabresa", restricoes: [] }] }), domain: d });
      expect(r.resposta).toMatch(/^Montei assim: /);
      expect(r.resposta).not.toMatch(/adicionei|carrinho|comprei|reservei/i);
    });
  }
});

describe("o orquestrador entrega o juiz de relevância ao domínio", () => {
  it("toda busca recebe um contexto com a relevância (a camada que decide se o item serve)", async () => {
    const { d, contextos } = dominio(plano([], [{ categoria: "churrasco", motivo: "nenhuma opção" }]));
    await executarTurno(novaSessao("s3"), { texto: "quero churrasco", origem: "texto" }, { llm: new Llm("x"), domain: d });
    expect(contextos).toHaveLength(1);
    expect(contextos[0]?.relevancia).toBeDefined();
  });

  it("o juiz do contexto usa o LLM do turno quando ele sabe julgar", async () => {
    const julgar = vi.fn(async () => ({ a: "serve" as const }));
    const { d, contextos } = dominio(plano([], [{ categoria: "leite", motivo: "x" }]));
    class LlmJuiz extends Llm { julgar = julgar; }
    await executarTurno(novaSessao("s4"), { texto: "leite", origem: "texto" }, { llm: new LlmJuiz("x", { necessidades: [{ id: "n1", vertical: "GROCERIES", categoria: "leite", restricoes: [] }] }), domain: d });
    const m = await contextos[0]!.relevancia!.julgar({ id: "n1", vertical: "GROCERIES", categoria: "leite", restricoes: [] }, [{ ref: "a", item: "Pudim" }]);
    expect(julgar).toHaveBeenCalled();
    expect(m.get("a")).toBe("serve");
  });
});

describe("personalização: o primeiro nome entra uma vez, no encaminhamento", () => {
  const exato = plano([bloco("pizza", opcao("Pizza Calabresa", "Forno"))]);
  const consentir = (nome?: string) => {
    const { d } = dominio(exato);
    const s = novaSessao(`nome-${nome ?? "sem"}`);
    const llm = new Llm("Montei assim: pizza calabresa da Forno. Quer ajustar algo?", { necessidades: [{ id: "n1", vertical: "RESTAURANT", categoria: "pizza calabresa", restricoes: [] }] });
    return { s, run: (texto: string, intencao: TurnoInterpretado["intencao"] = "pedido") => executarTurno(s, { texto, origem: "texto" }, { llm: Object.assign(Object.create(llm), { interpretar: async () => ({ intencao, nivel: "L0", ocasiao: {}, necessidades: intencao === "pedido" ? [{ id: "n1", vertical: "RESTAURANT", categoria: "pizza calabresa", restricoes: [] }] : [], assumido: [] }) }), domain: d, nome }) };
  };

  it("com nome: 'Pronto, Felipe, o plano está na sua tela…' uma vez só", async () => {
    const { s, run } = consentir("Felipe");
    await run("pizza calabresa");
    const a = await run("pode", "consentir");
    expect(a.resposta).toBe("Pronto, Felipe, o plano está na sua tela. É só revisar e aprovar; a compra termina no iFood.");
    expect(s.nomeUsado).toBe(true);
    const b = await run("pode", "consentir");
    expect(b.resposta).not.toContain("Felipe");
  });
  it("sem nome, a frase é a de sempre", async () => {
    const { run } = consentir(undefined);
    await run("pizza calabresa");
    expect((await run("pode", "consentir")).resposta).toBe("Pronto, o plano está na sua tela. É só revisar e aprovar; a compra termina no iFood.");
  });
});
