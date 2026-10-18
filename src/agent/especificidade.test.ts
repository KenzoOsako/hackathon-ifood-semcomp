import { describe, expect, it } from "vitest";
import { soOsEspecificos } from "./especificidade";

const nomes = (itens: string[], categoria: string) => soOsEspecificos(itens, categoria, (s) => s);

describe("soOsEspecificos: pedido específico não vira outro sabor", () => {
  it("com 2+ palavras distintivas, só os itens que casam TODAS ficam", () => {
    expect(nomes(["Pizza Calabresa Grande", "Pizza Margherita", "Calabresa Acebolada"], "pizza calabresa")).toEqual(["Pizza Calabresa Grande"]);
  });

  it("palavras genéricas (grande, para, com) não contam como específicas", () => {
    // "pizza grande" tem só UMA palavra distintiva: não filtra nada.
    expect(nomes(["Pizza Calabresa", "Pizza Margherita Grande"], "pizza grande")).toEqual(["Pizza Calabresa", "Pizza Margherita Grande"]);
  });

  it("palavra de até 3 letras não conta (uva, ovo): sobra 1 palavra, sem filtro", () => {
    expect(nomes(["Pizza de Uva", "Pizza Calabresa"], "pizza uva")).toEqual(["Pizza de Uva", "Pizza Calabresa"]);
  });

  it("palavra de 4 letras conta (pure)", () => {
    expect(nomes(["Pizza Pure", "Pizza Calabresa"], "pizza pure")).toEqual(["Pizza Pure"]);
  });

  it("pedido de uma palavra só nunca filtra", () => {
    expect(nomes(["Pizza Calabresa", "Pudim"], "pizza")).toEqual(["Pizza Calabresa", "Pudim"]);
  });

  it("se nenhum item casa todas as palavras, devolve todos (o juiz de relevância decide depois)", () => {
    expect(nomes(["Pizza Margherita", "Calabresa Acebolada"], "pizza calabresa")).toEqual(["Pizza Margherita", "Calabresa Acebolada"]);
  });

  it("ignora acento e caixa", () => {
    expect(nomes(["PIZZA CALABRESA", "Pizza Margherita"], "pízza calabresa")).toEqual(["PIZZA CALABRESA"]);
  });
});
