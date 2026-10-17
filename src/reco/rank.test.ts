import { describe, expect, it } from "vitest";
import fixtures from "../../fixtures/discovery.json";
import { CandidateSchema, type HistoryEntry } from "@/contracts";
import { rank } from "./rank";

const burgers = fixtures.candidates
  .filter((c) => c.category === "hamburguer")
  .map((c) => CandidateSchema.parse(c));

describe("rank", () => {
  it("devolve até 3 opções de lojas diferentes", () => {
    const opts = rank(burgers, []);
    expect(opts.length).toBe(3);
    expect(new Set(opts.map((o) => o.candidate.merchantId)).size).toBe(3);
  });

  it("a mais barata considera promoção e taxa de entrega", () => {
    const [first] = rank(burgers, []);
    expect(first.label).toBe("MAIS_BARATA");
    expect(first.candidate.merchantId).toBe("m-3"); // 16,90 + frete grátis
  });

  it("toda opção tem ao menos um motivo, e motivos de histórico só existem com histórico", () => {
    const sem = rank(burgers, []);
    expect(sem.every((o) => o.reasons.length > 0)).toBe(true);
    expect(sem.flatMap((o) => o.reasons).some((r) => r.kind === "times_ordered")).toBe(false);

    const hist: HistoryEntry[] = [{ merchantId: "m-1", timesOrdered: 3 }];
    const com = rank(burgers, hist);
    const fav = com.find((o) => o.label === "SEU_FAVORITO");
    expect(fav?.candidate.merchantId).toBe("m-1");
    expect(fav?.reasons.some((r) => r.kind === "times_ordered" && r.value === 3)).toBe(true);
  });

  it("sem candidatos, sem opções (nada inventado)", () => {
    expect(rank([], [])).toEqual([]);
  });
});
