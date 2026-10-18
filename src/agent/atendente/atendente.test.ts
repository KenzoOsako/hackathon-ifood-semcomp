// Guardas do atendente: o que o código garante independentemente do que o modelo decidir.
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { FakeDomain } from "../domain-fake";
import { FRASES } from "../frases";
import { novaSessao } from "../sessao";
import { executarAtendente, reiniciarAtendente } from ".";

type Chamada = { name: string; args: Record<string, unknown> };
// Modelo roteirizado: cada invoke devolve a próxima resposta (com ou sem chamadas de ferramenta) e conta as chamadas.
function roteiro(passos: (string | Chamada[])[]) {
  const estado = { chamadas: 0 };
  const modelo = {
    bindTools: () => ({
      invoke: async () => {
        estado.chamadas += 1;
        const p = passos.shift();
        if (p === undefined) throw new Error("roteiro acabou");
        return typeof p === "string" ? new AIMessage(p) : new AIMessage({ content: "", tool_calls: p.map((c, i) => ({ id: `c${estado.chamadas}-${i}`, name: c.name, args: c.args, type: "tool_call" as const })) });
      },
    }),
  } as unknown as BaseChatModel;
  return { modelo, estado };
}

function conversa(passos: (string | Chamada[])[]) {
  const s = novaSessao(`s-${Math.random()}`);
  reiniciarAtendente(s.subjectRef);
  const { modelo, estado } = roteiro(passos);
  const deps = { modelo, nomeModelo: "roteiro", domain: new FakeDomain() };
  return { s, estado, fale: (texto: string) => executarAtendente(s, { texto, origem: "texto" }, deps) };
}

const pizza = { categoria: "pizza", vertical: "RESTAURANT" };

describe("atendente", () => {
  it("pesquisa, mostra o plano com a opção escolhida e fala o que o modelo disse", async () => {
    const { s, fale } = conversa([
      [{ name: "buscar_no_ifood", args: { ...pizza, ordenar: "melhor_avaliada" } }],
      [{ name: "mostrar_plano", args: { itens: [{ ...pizza, ref: "nonna-margherita" }] } }],
      "Montei com a margherita da Pizzaria Nonna. É isso, ou quer mudar algo antes de fechar?",
    ]);
    const r = await fale("quero a pizza melhor avaliada");
    expect(r.tela?.tipo).toBe("mostrar_plano");
    expect(r.tela?.plano.blocos[0].principal.ref).toBe("nonna-margherita");
    // As outras opções da busca que a pessoa viu ficam como alternativas, para trocar tocando.
    expect(r.tela?.plano.blocos[0].alternativas.map((o) => o.ref)).toContain("forno-calabresa");
    expect(r.resposta).toMatch(/É isso/);
    expect(s.plano?.versao).toBe(1);
  });

  it("o que ele pesquisa aparece na tela de opções (até 3 por busca); um plano na mesma rodada prevalece", async () => {
    const { fale } = conversa([
      [{ name: "buscar_no_ifood", args: { ...pizza, ordenar: "melhor_avaliada" } }, { name: "buscar_no_ifood", args: { categoria: "hamburguer", vertical: "RESTAURANT" } }],
      "A mais bem avaliada é a da Pizzaria Nonna. Qual prefere?",
      [{ name: "buscar_no_ifood", args: pizza }, { name: "mostrar_plano", args: { itens: [pizza] } }],
      "Montei. É isso?",
    ]);
    const r = await fale("o que tem de bom?");
    expect(r.tela?.tipo).toBe("mostrar_opcoes");
    const grupos = r.tela!.plano.opcoes!;
    expect(grupos.map((g) => g.categoria)).toEqual(["pizza", "hamburguer"]);
    expect(grupos[0].criterio).toBe("melhor_avaliada");
    expect(grupos.every((g) => g.itens.length > 0 && g.itens.length <= 3)).toBe(true);
    expect(grupos[0].itens[0].nota).toBeGreaterThanOrEqual(grupos[0].itens.at(-1)!.nota ?? 0);
    expect((await fale("quero pizza")).tela?.tipo).toBe("mostrar_plano");
  });

  it("opção escolhida de uma busca recente monta o plano sem buscar de novo no iFood", async () => {
    const s = novaSessao(`s-${Math.random()}`);
    reiniciarAtendente(s.subjectRef);
    const domain = new FakeDomain();
    let buscas = 0;
    const original = domain.buscarNecessidade.bind(domain);
    domain.buscarNecessidade = (...args) => { buscas += 1; return original(...args); };
    const { modelo } = roteiro([
      [{ name: "buscar_no_ifood", args: pizza }],
      [{ name: "mostrar_plano", args: { itens: [{ ...pizza, ref: "nonna-margherita" }] } }],
      "Montei com a margherita da Pizzaria Nonna. É isso?",
    ]);
    const r = await executarAtendente(s, { texto: "quero pizza", origem: "texto" }, { modelo, nomeModelo: "roteiro", domain });
    expect(buscas).toBe(1); // só a busca da ferramenta; o plano não repete
    expect(r.tela?.plano.blocos[0].principal.ref).toBe("nonna-margherita");
  });

  describe("falha do provedor", () => {
    const falha = (msg: string) => ({ bindTools: () => ({ invoke: async () => { throw new Error(msg); } }) }) as unknown as BaseChatModel;
    const sessao = () => { const s = novaSessao(`s-${Math.random()}`); reiniciarAtendente(s.subjectRef); return s; };

    it("cota esgotada no titular: o reserva responde e a resposta diz qual modelo falou", async () => {
      const { modelo: reserva } = roteiro(["Oi! O que você quer pedir hoje?"]);
      const r = await executarAtendente(sessao(), { texto: "oi", origem: "texto" }, { modelo: falha("[429 Too Many Requests] quota"), nomeModelo: "titular-cota", modeloReserva: reserva, nomeReserva: "reserva", domain: new FakeDomain() });
      expect(r.resposta).toMatch(/O que você quer/);
      expect(r.llm).toBe("atendente:reserva");
    });

    it("titular e reserva fora: diz que há instabilidade, não que não entendeu", async () => {
      const r = await executarAtendente(sessao(), { texto: "oi", origem: "texto" }, { modelo: falha("429 quota"), nomeModelo: "titular-fora", modeloReserva: falha("503 unavailable"), nomeReserva: "reserva-fora", domain: new FakeDomain() });
      expect(r.resposta).toBe(FRASES.indisponivel);
    });

    it("erro que não é do provedor segue como 'não entendi' e não troca de modelo", async () => {
      const { modelo: reserva, estado } = roteiro(["não deveria falar"]);
      const r = await executarAtendente(sessao(), { texto: "oi", origem: "texto" }, { modelo: falha("saída inválida do modelo"), nomeModelo: "titular-ruim", modeloReserva: reserva, nomeReserva: "reserva", domain: new FakeDomain() });
      expect(r.resposta).toBe(FRASES.naoEntendi);
      expect(estado.chamadas).toBe(0);
    });
  });

  it("'fechou' com plano leva à revisão sem chamar o modelo", async () => {
    const { estado, fale } = conversa([[{ name: "mostrar_plano", args: { itens: [pizza] } }], "Montei. É isso?"]);
    await fale("quero pizza");
    const antes = estado.chamadas;
    const r = await fale("fechou");
    expect(r.tela?.tipo).toBe("aguardando_aprovacao");
    expect(estado.chamadas).toBe(antes);
  });

  it("aprovação só pela frase explícita, presa à versão na tela, e gera a sacola sem chamar o modelo", async () => {
    const { estado, fale } = conversa([
      [{ name: "mostrar_plano", args: { itens: [pizza] } }], "Montei.",
      [{ name: "mostrar_plano", args: { itens: [{ ...pizza, ref: "nonna-margherita" }] } }], "Troquei.",
    ]);
    expect((await fale("aprovo o plano")).resposta).toBe(FRASES.semPlano);
    await fale("quero pizza");
    const v2 = (await fale("a mais bem avaliada")).tela!.plano;
    expect(v2.versao).toBe(2);
    const antes = estado.chamadas;
    const velha = await fale("aprovo o plano versão 1");
    expect(velha.aprovacao).toBeUndefined();
    expect(velha.resposta).toBe(FRASES.versaoMudou);
    const ok = await fale("aprovo o plano versão 2");
    expect(ok.tela?.tipo).toBe("sacola");
    expect(ok.aprovacao).toEqual({ planoId: v2.planoId, versao: 2 });
    expect(ok.tela?.plano.sacola?.simulacao).toBe(true);
    expect(estado.chamadas).toBe(antes);
  });

  it("fala que diz que o pedido foi feito ou pede dado sensível não chega à pessoa", async () => {
    const { fale } = conversa(["Pronto, seu pedido foi feito!", "Me passa o número do seu cartão?"]);
    expect((await fale("quero pizza")).resposta).not.toMatch(/pedido foi feito/i);
    expect((await fale("e agora?")).resposta).not.toMatch(/cart[aã]o/i);
  });

  it("não busca nem monta plano com bebida alcoólica", async () => {
    const { fale } = conversa([
      [{ name: "mostrar_plano", args: { itens: [{ categoria: "cerveja", vertical: "GROCERIES" }] } }],
      "Não consigo incluir bebida alcoólica. Posso ajudar com outra coisa?",
    ]);
    const r = await fale("quero cerveja");
    expect(r.tela).toBeUndefined();
  });

  it("falha do modelo vira frase curta, sem inventar plano", async () => {
    const { fale } = conversa([]);
    const r = await fale("oi");
    expect(r.resposta).toBe(FRASES.naoEntendi);
    expect(r.tela).toBeUndefined();
  });
});
