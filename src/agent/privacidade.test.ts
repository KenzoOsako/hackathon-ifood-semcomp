import { describe, expect, it } from "vitest";
import { temDadoPessoal } from "./privacidade";

describe("privacidade da fala", () => {
  it.each([
    "Entrego na Rua das Flores, 123.",
    "Vou mandar para a Avenida São Carlos 2500 então.",
    "Seu telefone é (16) 99876-5432?",
    "Ligo no 16998765432.",
    "Seu CEP é 13560-970.",
    "Mando para joao.silva@gmail.com.",
    "Seu CPF 123.456.789-09 está certo?",
  ])("barra: %s", (fala) => expect(temDadoPessoal(fala)).toBe(true));

  it.each([
    "Montei assim: 2x Pizza Mussarela da Pizzaria Á Fabrica, mais barata. Quer ajustar algo?",
    "A pizza custa R$ 39,90 e chega em 25 min.",
    "Fica a 1,2 km e a nota é 4,8.",
    "Entrego em Casa, como sempre.",
    "Pizza calabresa grande na Forno e Cia, de 40 a 50 minutos.",
    "Enviei a aprovação da versão 3 do plano.",
  ])("deixa passar: %s", (fala) => expect(temDadoPessoal(fala)).toBe(false));
});
