import { describe, expect, it, vi } from "vitest";
import { criarRelevancia, julgarLexico, palavras, palavrasDoPedido, vereditoLexico } from "./relevancia";
import type { CandidatoJulgado, Necessidade, Veredito } from "./types";

const nec = (categoria: string, consultas?: string[]): Necessidade => ({ id: "n1", vertical: "GROCERIES", categoria, restricoes: [], ...(consultas ? { consultas } : {}) });
const cand = (ref: string, item: string): CandidatoJulgado => ({ ref, item, loja: "Loja" });

describe("palavras", () => {
  it("normaliza acento, caixa, plural e ignora palavras que não distinguem", () => {
    expect(palavras("Pizza de Calabresa GRANDE")).toEqual(["pizza", "calabresa"]);
    expect(palavras("Ovos")).toEqual(["ovo"]);
    expect(palavras("Pães de queijo")).toEqual(["pao", "queijo"]);
    expect(palavras("Limões 1kg")).toEqual(["limao", "1kg"]);
    expect(palavras("ingredientes de bolo")).toEqual(["bolo"]);
  });
  it("palavras do pedido juntam categoria e consultas, sem repetir", () => {
    expect(palavrasDoPedido(nec("leite", ["leite integral", "leite"]))).toEqual(["leite", "integral"]);
  });
});

describe("vereditoLexico (só texto)", () => {
  it("serve quando todas as palavras do pedido aparecem no item", () => {
    expect(vereditoLexico(nec("pizza calabresa"), "Pizza Calabresa Grande 35cm")).toBe("serve");
    expect(vereditoLexico(nec("ovos"), "Ovo branco bandeja 30 un")).toBe("serve");
  });
  it("próximo quando casa parte do pedido composto; não serve quando não casa nada", () => {
    expect(vereditoLexico(nec("pizza calabresa"), "Pizza Margherita")).toBe("proximo");
    expect(vereditoLexico(nec("churrasco"), "X-Burger Cheddar Jr.")).toBe("nao_serve");
    expect(vereditoLexico(nec("leite"), "Pudim de Leite Condensado")).toBe("serve"); // texto sozinho não distingue: é para isso que existe o juiz
  });
  it("consultas alternativas: basta casar UMA inteira", () => {
    expect(vereditoLexico(nec("churrasco", ["picanha", "costela bovina"]), "Picanha bovina 1kg")).toBe("serve");
    expect(vereditoLexico(nec("churrasco", ["picanha", "costela bovina"]), "Costela suína")).toBe("proximo"); // casa 1 das 2 palavras da consulta composta: mesmo tipo, outra variação
  });
  it("pedido sem palavra distintiva não filtra nada", () => {
    expect(vereditoLexico(nec("de da"), "qualquer coisa")).toBe("serve");
  });
  it("julgarLexico devolve um veredito por candidato", () => {
    const m = julgarLexico(nec("pizza calabresa"), [cand("a", "Pizza Calabresa"), cand("b", "Suco de laranja")]);
    expect([...m.entries()]).toEqual([["a", "serve"], ["b", "nao_serve"]]);
  });
});

describe("criarRelevancia (camadas)", () => {
  it("sem juiz (modo de reserva) não filtra: categoria genérica como 'presente' não aparece no nome do item", async () => {
    const r = criarRelevancia({});
    const m = await r.julgar(nec("presente"), [cand("a", "Livro de culinária"), cand("b", "Fone bluetooth")]);
    expect([...m.values()]).toEqual(["serve", "serve"]);
  });

  it("pedido específico com item que casa tudo: o texto basta e o juiz nem é chamado", async () => {
    const julgar = vi.fn();
    const r = criarRelevancia({ julgar });
    const m = await r.julgar(nec("pizza calabresa"), [cand("a", "Pizza Calabresa"), cand("b", "Pizza Margherita")]);
    expect(julgar).not.toHaveBeenCalled();
    expect(m.get("a")).toBe("serve");
    expect(m.get("b")).toBe("proximo");
  });

  it("pedido de uma palavra vai ao juiz, e o veredito dele vale sobre o texto", async () => {
    const julgar = vi.fn(async () => ({ a: "nao_serve", b: "serve" }) as Record<string, Veredito>);
    const r = criarRelevancia({ julgar });
    const m = await r.julgar(nec("leite"), [cand("a", "Pudim de leite condensado"), cand("b", "Leite integral 1L")]);
    expect(julgar).toHaveBeenCalledTimes(1);
    expect(m.get("a")).toBe("nao_serve"); // o texto diria "serve"; o juiz entende que é sobremesa
    expect(m.get("b")).toBe("serve");
  });

  it("o que o juiz não comentou cai no veredito do texto", async () => {
    const r = criarRelevancia({ julgar: async () => ({ a: "serve" }) });
    const m = await r.julgar(nec("ovo"), [cand("a", "Ovo caipira"), cand("b", "Biscoito"), cand("c", "Ovo branco")]);
    expect(m.get("a")).toBe("serve");
    expect(m.get("b")).toBe("nao_serve");
    expect(m.get("c")).toBe("serve");
  });

  it("só os 12 primeiros vão ao juiz; os demais ficam com o texto", async () => {
    const julgar = vi.fn(async () => ({}) as Record<string, Veredito>);
    const lista = Array.from({ length: 20 }, (_, i) => cand(`r${i}`, `Item ${i}`));
    await criarRelevancia({ julgar }).julgar(nec("churrasco"), lista);
    expect((julgar.mock.calls[0] as unknown as [{ candidatos: unknown[] }])[0].candidatos).toHaveLength(12);
  });

  it("juiz com erro: vale o texto se achou algo", async () => {
    const r = criarRelevancia({ julgar: async () => { throw new Error("429"); } });
    const m = await r.julgar(nec("leite"), [cand("a", "Leite integral"), cand("b", "Biscoito")]);
    expect(m.get("a")).toBe("serve");
    expect(m.get("b")).toBe("nao_serve");
  });

  it("juiz com erro e o texto não achou nada: tudo vira 'mais parecido' (nunca afirma que é o pedido)", async () => {
    const r = criarRelevancia({ julgar: async () => { throw new Error("timeout"); } });
    const m = await r.julgar(nec("churrasco"), [cand("a", "X-Burger"), cand("b", "Pudim")]);
    expect([...m.values()]).toEqual(["proximo", "proximo"]);
  });

  it("juiz que demora além do limite é abandonado", async () => {
    const r = criarRelevancia({ julgar: (_i, signal) => new Promise((_res, rej) => signal?.addEventListener("abort", () => rej(new Error("abortado")))) }, { timeoutMs: 20 });
    const m = await r.julgar(nec("churrasco"), [cand("a", "X-Burger")]);
    expect(m.get("a")).toBe("proximo");
  });

  it("lista vazia não chama o juiz", async () => {
    const julgar = vi.fn();
    expect((await criarRelevancia({ julgar }).julgar(nec("leite"), [])).size).toBe(0);
    expect(julgar).not.toHaveBeenCalled();
  });
});

// Testes que MATAM mutantes sobreviventes da primeira medição (18/10, placar 77,3%): cada um prende uma fronteira.
describe("fronteiras do plural (palavras)", () => {
  it("oes/aes/ais viram singular, e só a partir do tamanho certo", () => {
    expect(palavras("pioes")).toEqual(["piao"]); // 5 letras: já vale a regra de "oes"
    expect(palavras("boes")).toEqual(["boe"]); // 4 letras: não vale (cai na regra do "s")
    expect(palavras("jornais")).toEqual(["jornal"]);
    expect(palavras("reais")).toEqual(["real"]); // 5 letras: vale a regra de "ais"
    expect(palavras("mais")).toEqual(["mai"]); // 4 letras: não vale
  });
  it("palavra de 3 letras não perde o 's' (gás ≠ gá)", () => {
    expect(palavras("gás")).toEqual(["gas"]);
  });
});

describe("prefixo entre palavras (bate)", () => {
  it("variação por prefixo casa (calabres/calabresa), mas só a partir de 5 letras", () => {
    expect(vereditoLexico(nec("calabres"), "Pizza Calabresa")).toBe("serve"); // o pedido é prefixo do item
    expect(vereditoLexico(nec("calabresa"), "Pizza Calabres")).toBe("serve"); // o item é prefixo do pedido
    expect(vereditoLexico(nec("ovo"), "Ovomaltine 400g")).toBe("nao_serve"); // 3 letras: sem prefixo
    expect(vereditoLexico(nec("pizza"), "Pizzaria Italiana")).toBe("serve"); // exatamente 5 letras: vale
  });
  it("prefixo vale só no início da palavra, não no fim", () => {
    expect(vereditoLexico(nec("resa"), "Pizza Calabresa")).toBe("nao_serve");
  });
});

describe("alternativas do pedido", () => {
  it("consulta que só tinha palavra descartável não faz tudo 'servir'", () => {
    expect(vereditoLexico(nec("pizza", ["de"]), "Pudim")).toBe("nao_serve");
  });
  it("pedido de 3 palavras casando 1 é só 'nao_serve' (1/3 < metade)", () => {
    expect(vereditoLexico(nec("pizza calabresa especial"), "Pizza Margherita")).toBe("nao_serve");
    expect(vereditoLexico(nec("pizza calabresa"), "Pizza Margherita")).toBe("proximo"); // 1/2 = metade
  });
});

describe("atalho do texto e timer do juiz", () => {
  it("o atalho usa a consulta MAIS específica: 2+ palavras em qualquer uma dispensa o juiz", async () => {
    const julgar = vi.fn();
    await criarRelevancia({ julgar }).julgar(nec("pizza calabresa", ["pizza"]), [cand("a", "Pizza Calabresa")]);
    expect(julgar).not.toHaveBeenCalled();
  });
  it("o timer do juiz é limpo ao terminar (sem timer pendente)", async () => {
    vi.useFakeTimers();
    try {
      const p = criarRelevancia({ julgar: async () => ({ a: "serve" as Veredito }) }).julgar(nec("leite"), [cand("a", "Leite")]);
      await p;
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
