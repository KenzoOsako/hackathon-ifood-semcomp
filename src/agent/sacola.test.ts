// Sacola simulada: a conta é do servidor; lojas se distinguem pelo id do estabelecimento.
import { describe, expect, it } from "vitest";
import { porLoja } from "@/ui/agent/plano-tela";
import { montarSacola } from "./sacola";
import type { PlanoSnapshot } from "./types";

describe("sacola simulada", () => {
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

  it("estabelecimentos distintos com o mesmo nome são lojas separadas, cada uma com seu frete", () => {
    const op = (lojaId: string, freteCents: number) => ({ ref: `${lojaId}:x`, loja: "Pizzaria Bella", lojaId, item: "pizza", precoCents: 1000, freteCents, rotulo: "", motivo: "", origem: "real" as const, complementos: { status: "verificado" as const, grupos: [], selecoes: [] } });
    const bloco = (id: string, principal: ReturnType<typeof op>) => ({ necessidadeId: id, vertical: "RESTAURANT" as const, categoria: id, quantidade: 1, principal, alternativas: [] });
    const plano: PlanoSnapshot = { planoId: "p", versao: 1, naoAtendidas: [], pendencias: [], origem: "real", blocos: [bloco("a", op("m-1", 500)), bloco("b", op("m-2", 300))] };
    const s = montarSacola(plano);
    expect(s.lojas.map((l) => [l.lojaId, l.loja, l.totalCents])).toEqual([["m-1", "Pizzaria Bella", 1500], ["m-2", "Pizzaria Bella", 1300]]);
    expect(s.totalCents).toBe(2800); // agrupando pelo nome seriam R$ 25,00: um frete perdido
    expect(porLoja(plano).map((l) => l.lojaId)).toEqual(["m-1", "m-2"]);
  });
});
