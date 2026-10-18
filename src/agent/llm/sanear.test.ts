import { describe, expect, it } from "vitest";
import { TurnoInterpretadoSchema } from "../types";
import { sanearTurno } from "./sanear";

// Resposta real do gemini-3.5-flash-lite no cenário FL1 (18/10), que derrubava o turno inteiro.
const REAL = {
  intencao: "consentir", nivel: "L1",
  ocasiao: { tipo: "doenteescolaouafinsougripadoestevariadoouresfriadoeprecisasecaldooucanjaoucomida-leveetcsenaoseaplicaexactamentemasédoenteenquantocriançatemsuasparticularidadesmasmantemosessencialmenteoquetinhaconformearegraosemremoverrestricoesetcsemmodificardemais," },
  necessidades: [{ id: "n1", vertical: "RESTAURANT", categoria: "canja de galinha", restricoes: [], fonte: "inferido" }],
  assumido: ["Vou escolher a canja de galinha."],
};

describe("saneamento da resposta do modelo", () => {
  it("sem saneamento a resposta real é recusada inteira", () => {
    expect(TurnoInterpretadoSchema.safeParse(REAL).success).toBe(false);
  });

  it("descarta só o campo de enfeite e aproveita o resto", () => {
    const t = TurnoInterpretadoSchema.parse(sanearTurno(REAL));
    expect(t.ocasiao.tipo).toBeUndefined();
    expect(t.intencao).toBe("consentir");
    expect(t.necessidades[0].categoria).toBe("canja de galinha");
  });

  it("não afrouxa o que importa: necessidade fora do formato continua recusada", () => {
    const ruim = { ...REAL, ocasiao: {}, necessidades: [{ ...REAL.necessidades[0], categoria: "x".repeat(80) }] };
    expect(TurnoInterpretadoSchema.safeParse(sanearTurno(ruim)).success).toBe(false);
  });

  it("pergunta disparada some (sem pergunta, o Guide segue para o plano)", () => {
    const t = TurnoInterpretadoSchema.parse(sanearTurno({ ...REAL, ocasiao: {}, pergunta: "Quer ".repeat(80) }));
    expect(t.pergunta).toBeUndefined();
  });
});
