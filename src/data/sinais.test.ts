import { beforeEach, describe, expect, it } from "vitest";
import { agregarSinais, limparSinais, registrarSinal } from "./sinais";

describe("sinais de demanda", () => {
  beforeEach(limparSinais);

  it("agrega demanda sem oferta da busca vazia e do plano", () => {
    registrarSinal({ tipo: "busca", vertical: "RESTAURANT", categoria: "Comida Árabe", restricoes: ["gluten"], resultados: 0 });
    registrarSinal({ tipo: "busca", vertical: "RESTAURANT", categoria: "pizza", restricoes: [], resultados: 5 });
    registrarSinal({ tipo: "plano", ocasiao: "Aniversário", pessoas: 30, categorias: ["pizza", "refrigerante"], naoAtendidas: ["comida árabe"] });
    registrarSinal({ tipo: "aprovado", itens: 2 });
    const a = agregarSinais();
    expect(a).toMatchObject({ buscas: 2, planos: 1, aprovados: 1 });
    expect(a.semOferta).toEqual([{ nome: "comida árabe", total: 2 }]);
    expect(a.restricoes).toEqual([{ nome: "gluten", total: 1 }]);
    expect(a.ocasioes).toEqual([{ nome: "aniversário", total: 1 }]);
    expect(a.combinacoes).toEqual([{ nome: "pizza + refrigerante", total: 1 }]);
  });

  it("descarta termo com dado pessoal em vez de guardar", () => {
    registrarSinal({ tipo: "busca", vertical: "GROCERIES", categoria: "entregar na rua das flores, 123", restricoes: ["11987654321"], resultados: 0 });
    registrarSinal({ tipo: "plano", categorias: ["leite"], naoAtendidas: ["fulano@email.com"] });
    const a = agregarSinais();
    expect(a.buscas).toBe(0);
    expect(a.semOferta).toEqual([]);
  });

  it("não derruba quem chama com entrada estranha", () => {
    expect(() => registrarSinal({ tipo: "busca", vertical: "RESTAURANT", categoria: undefined as unknown as string, restricoes: [], resultados: 1 })).not.toThrow();
  });
});
