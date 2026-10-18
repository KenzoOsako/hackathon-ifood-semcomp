import { describe, expect, it } from "vitest";
import { sanearPlano } from "../guardas-fala";
import type { DomainPort, LlmPort, Necessidade, OpcaoPlano, PlanoSnapshot, TurnoInterpretado } from "../types";
import { executarTurno, novaSessao } from ".";

const opcao = (item: string, precoCents: number): OpcaoPlano => ({ ref: item, loja: "Mercado", item, precoCents, rotulo: "mais barata", motivo: "menor preço", origem: "real" });
const bloco = (categoria: string, principal: OpcaoPlano, alternativas: OpcaoPlano[] = []) => ({ necessidadeId: "n1", vertical: "GROCERIES" as const, categoria, quantidade: 1, principal, alternativas });
const plano = (blocos: PlanoSnapshot["blocos"]): PlanoSnapshot => ({ planoId: "p", versao: 1, blocos, naoAtendidas: [], pendencias: [], origem: "real" });

describe("assinatura do pedido inclui as consultas", () => {
  it("mudar 'leite integral' para 'leite desnatado' (mesma categoria) busca de novo e troca o resultado", async () => {
    const buscas: string[][] = [];
    const domain: DomainPort = {
      buscarNecessidade: async (n: Necessidade) => { buscas.push(n.consultas ?? []); return []; },
      montarPlano: async ({ itens }) => plano([bloco("leite", opcao(`Leite (${itens[0].necessidade.consultas?.join(",")})`, 500))]),
      ajustarPlano: async () => plano([]),
      registrarEvento: async () => undefined,
    };
    const consultas = [["leite integral"], ["leite desnatado"]];
    const llm: LlmPort = {
      nome: "t",
      interpretar: async (): Promise<TurnoInterpretado> => ({ intencao: "pedido", nivel: "L0", ocasiao: {}, assumido: [], necessidades: [{ id: "n1", vertical: "GROCERIES", categoria: "leite", restricoes: [], consultas: consultas.shift() }] }),
      responder: async () => "Montei o plano. Quer ajustar algo?",
    };
    const s = novaSessao("sujeito");
    await executarTurno(s, { texto: "leite integral", origem: "texto" }, { llm, domain });
    expect(s.plano?.blocos[0].principal.item).toContain("leite integral");
    await executarTurno(s, { texto: "na verdade desnatado", origem: "texto" }, { llm, domain });
    expect(buscas).toEqual([["leite integral"], ["leite desnatado"]]);
    expect(s.plano?.blocos[0].principal.item).toContain("leite desnatado");
    expect(s.plano?.blocos[0].principal.item).not.toContain("integral");
    expect(s.encaminhado).toBe(false);
  });
});

describe("preço inválido nunca vira zero", () => {
  const invalidos = [NaN, Infinity, -Infinity, -1, -500];

  it.each(invalidos)("principal com preço %s é descartado e a primeira alternativa válida assume", (preco) => {
    const p = sanearPlano(plano([bloco("leite", opcao("ruim", preco), [opcao("boa", 700)])]));
    expect(p.blocos[0].principal.item).toBe("boa");
    expect(p.blocos[0].principal.precoCents).toBe(700);
  });

  it.each(invalidos)("sem candidato válido (%s) a categoria vira não atendida, sem bloco de preço inventado", (preco) => {
    const p = sanearPlano(plano([bloco("leite", opcao("ruim", preco), [opcao("pior", preco)])]));
    expect(p.blocos).toHaveLength(0);
    expect(p.naoAtendidas.map((n) => n.categoria)).toEqual(["leite"]);
  });

  it("alternativa com preço inválido sai; zero informado pela origem é preservado", () => {
    const p = sanearPlano(plano([bloco("brinde", opcao("amostra", 0), [opcao("x", NaN), opcao("y", 300)])]));
    expect(p.blocos[0].principal.precoCents).toBe(0);
    expect(p.blocos[0].alternativas.map((a) => a.item)).toEqual(["y"]);
  });
});

describe("a fala do plano é do modelo", () => {
  const montar = (blocos: PlanoSnapshot["blocos"], naoAtendidas: PlanoSnapshot["naoAtendidas"] = []) => {
    let chamadas = 0;
    const domain: DomainPort = { buscarNecessidade: async () => [], montarPlano: async () => ({ ...plano(blocos), naoAtendidas }), ajustarPlano: async () => plano(blocos), registrarEvento: async () => undefined };
    const llm: LlmPort = {
      nome: "t",
      interpretar: async (): Promise<TurnoInterpretado> => ({ intencao: "pedido", nivel: "L0", ocasiao: {}, assumido: [], necessidades: [{ id: "n1", vertical: "GROCERIES", categoria: "leite", restricoes: [] }] }),
      responder: async () => { chamadas += 1; return "Montei o leite da Mercado, o mais barato. Quer ajustar algo?"; },
    };
    return { chamadas: () => chamadas, fale: () => executarTurno(novaSessao("s"), { texto: "quero leite", origem: "texto" }, { llm, domain }) };
  };

  it("o modelo fala o plano, inclusive com item não atendido", async () => {
    const t = montar([bloco("leite", opcao("Leite", 500))], [{ categoria: "queijo", motivo: "sem opção" }]);
    await t.fale();
    expect(t.chamadas()).toBe(1);
  });
});
