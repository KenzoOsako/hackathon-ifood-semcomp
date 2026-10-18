import { describe, expect, it } from "vitest";
import { termsFromPlan } from "./plan-terms";

describe("termsFromPlan", () => {
  it("junta lojas e itens do principal e das alternativas, sem repetir", () => {
    const plano = { blocos: [{ principal: { loja: "Forno e Cia", item: "pizza calabresa" }, alternativas: [{ loja: "Pizzaria Nonna", item: "pizza calabresa" }] }] };
    expect(termsFromPlan(plano)).toEqual(["Forno e Cia", "pizza calabresa", "Pizzaria Nonna"]);
  });
  it("formato inesperado não quebra", () => {
    expect(termsFromPlan(null)).toEqual([]);
    expect(termsFromPlan({ blocos: "x" })).toEqual([]);
    expect(termsFromPlan({ blocos: [null, { principal: { loja: 3 } }] })).toEqual([]);
  });
});
