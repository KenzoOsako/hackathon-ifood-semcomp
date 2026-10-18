import { describe, expect, it } from "vitest";
import { descricaoDe } from "./descricao";

describe("descricaoDe: uma linha do estabelecimento, só de campos reais", () => {
  it("monta todas as partes na ordem, separadas por ' · '", () => {
    expect(descricaoDe({ nota: 4.4, avaliacoes: 230, distanciaKm: 1.2, prazo: "até 35 minutos", freteCents: 590, pedidoMinimoCents: 2000, precoCents: 3990, precoOriginalCents: 4500 }))
      .toBe("nota 4,4 (230 avaliações) · a 1,2 km · entrega até 35 minutos · frete R$ 5,90 · pedido mínimo R$ 20,00 · em promoção (de R$ 45,00)");
  });
  it("campo ausente some da frase; frete zero vira 'frete grátis'", () => {
    expect(descricaoDe({ nota: 4.8, freteCents: 0, precoCents: 1000 })).toBe("nota 4,8 · frete grátis");
    expect(descricaoDe({ precoCents: 1000 })).toBe("");
  });
  it("sem número de avaliações, só a nota; sem promoção real, não cita promoção", () => {
    expect(descricaoDe({ nota: 4.5, precoCents: 1000, precoOriginalCents: 1000 })).toBe("nota 4,5");
    expect(descricaoDe({ nota: 4.5, precoCents: 1000, precoOriginalCents: 900 })).toBe("nota 4,5");
  });
  it("não usa símbolos que a limpeza da fala removeria (★ é desenho da interface)", () => {
    expect(descricaoDe({ nota: 4.4, avaliacoes: 10, precoCents: 1 })).not.toMatch(/★|⭐/);
  });
});
