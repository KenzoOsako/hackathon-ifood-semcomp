import { describe, expect, it } from "vitest";
import { speakableIssues } from "./speakable";

describe("speakableIssues", () => {
  it("fala natural e curta passa", () => {
    expect(speakableIssues("Montei assim: pizza calabresa grande da Forno e Cia, mais barata. Quer ajustar algo?")).toEqual([]);
  });
  it("decimais e hífen de palavra não contam como símbolo nem como fim de frase", () => {
    expect(speakableIssues("A pipoca de micro-ondas custa R$ 9,90 e chega em 25 min.")).toEqual([]);
  });
  it("pega markdown, lista, emoji e link", () => {
    expect(speakableIssues("**Pizza** da Forno")).toContain("símbolo ou markdown");
    expect(speakableIssues("- pizza\n- pipoca")).toContain("lista");
    expect(speakableIssues("Pronto 🍕")).toContain("emoji");
    expect(speakableIssues("Veja em https://ifood.com.br")).toContain("endereço de internet");
  });
  it("pega promessa de pedido feito e dado sensível", () => {
    expect(speakableIssues("Seu pedido foi feito!")).toContain("diz que o pedido foi feito");
    expect(speakableIssues("Me passe o CPF.")).toContain("menciona dado sensível");
  });
  it("pega fala longa demais e frases demais", () => {
    expect(speakableIssues("Texto. ".repeat(5))).toContain("frases demais (5)");
    expect(speakableIssues("a".repeat(401))).toEqual(["longa demais (401 caracteres)"]);
  });
  it("vazio é problema", () => {
    expect(speakableIssues("   ")).toEqual(["vazio"]);
  });
});
