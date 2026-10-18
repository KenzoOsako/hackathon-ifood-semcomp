// Fase 1 do agente (docs/PLANO_INTEGRACAO_VOZ_AGENTE.md): confirmação por confiança, sugestões e privacidade.
import { describe, expect, it } from "vitest";
import { FakeDomain } from "../domain-fake";
import type { ConverseInput, LlmPort, Necessidade, ResponderInput, TurnoInterpretado } from "../types";
import { FRASES, executarTurno, novaSessao, reiniciarSessao, sessaoDo } from ".";

const pizza: Necessidade = { id: "n1", vertical: "RESTAURANT", categoria: "pizza calabresa", restricoes: [] };
const sug = (id: string, vertical: Necessidade["vertical"], categoria: string): Necessidade => ({ id, vertical, categoria, restricoes: [], fonte: "inferido" });

// LLM roteirizado que conta chamadas: prova quando o orquestrador NÃO chamou o modelo.
class Roteiro implements LlmPort {
  readonly nome = "roteiro";
  chamadas = 0;
  constructor(private readonly turnos: Partial<TurnoInterpretado>[], private readonly fala?: string) {}
  async interpretar(): Promise<TurnoInterpretado> {
    this.chamadas += 1;
    const t = this.turnos.shift();
    if (!t) throw new Error("roteiro acabou");
    return { intencao: "pedido", nivel: "L0", ocasiao: {}, necessidades: [], assumido: [], ...t };
  }
  async responder(input: ResponderInput): Promise<string> { return this.fala ?? `Plano com ${input.plano.blocos.length} blocos. Quer ajustar algo?`; }
}

const voz = (texto: string, confianca?: number): ConverseInput => ({ texto, origem: "voz", sinais: { origem: "voz", interrompeu: false, palavras: 3, ...(confianca === undefined ? {} : { confianca }) } });

function conversa(llm: LlmPort) {
  const s = novaSessao(`s-${Math.random()}`);
  const domain = new FakeDomain();
  return { s, fale: (input: ConverseInput | string) => executarTurno(s, typeof input === "string" ? { texto: input, origem: "texto" } : input, { llm, domain }) };
}

describe("confirmação pela confiança da voz", () => {
  it("confiança média: confirma o entendido, não busca e não conta como pergunta", async () => {
    const llm = new Roteiro([{ necessidades: [pizza], ocasiao: { pessoas: 4 } }]);
    const { s, fale } = conversa(llm);
    const r = await fale(voz("quero pizza calabresa pra quatro", 0.72));
    expect(r.resposta).toBe("Entendi: pizza calabresa, para 4 pessoas. É isso?");
    expect(r.tela).toBeUndefined();
    expect(s.perguntasFeitas).toBe(0);
  });

  it("'sim' depois da confirmação busca sem chamar o LLM de novo", async () => {
    const llm = new Roteiro([{ necessidades: [pizza] }]);
    const { fale } = conversa(llm);
    await fale(voz("quero pizza calabresa", 0.7));
    const r = await fale(voz("sim", 0.95));
    expect(r.tela?.tipo).toBe("mostrar_plano");
    expect(llm.chamadas).toBe(1);
  });

  it("'não' descarta o entendido e pede de novo", async () => {
    const { s, fale } = conversa(new Roteiro([{ necessidades: [pizza] }]));
    await fale(voz("quero pizza calabresa", 0.7));
    const r = await fale(voz("não", 0.95));
    expect(r.resposta).toBe(FRASES.confirmacaoNegada);
    expect(s.plano).toBeUndefined();
  });

  it("confiança alta ou ausente segue direto", async () => {
    for (const c of [0.9, undefined]) {
      const { fale } = conversa(new Roteiro([{ necessidades: [pizza] }]));
      expect((await fale(voz("quero pizza calabresa", c))).tela?.tipo).toBe("mostrar_plano");
    }
  });

  it("confiança baixa pede para repetir sem gastar LLM", async () => {
    const llm = new Roteiro([{ necessidades: [pizza] }]);
    const { fale } = conversa(llm);
    expect((await fale(voz("quero pizza calabresa", 0.4))).resposta).toBe(FRASES.naoEntendi);
    expect(llm.chamadas).toBe(0);
  });

  it("aprovação com confiança média confirma a versão antes de sinalizar", async () => {
    const llm = new Roteiro([{ necessidades: [pizza] }, { intencao: "aprovar" }]);
    const { fale } = conversa(llm);
    const plano = (await fale("quero pizza calabresa")).tela!.plano;
    const r1 = await fale(voz("aprovo o plano", 0.75));
    expect(r1.aprovacao).toBeUndefined();
    expect(r1.resposta).toBe(`Entendi que você quer aprovar a versão ${plano.versao} do plano. É isso?`);
    const r2 = await fale(voz("isso", 0.95));
    expect(r2.aprovacao).toEqual({ planoId: plano.planoId, versao: plano.versao });
  });

  it("ajuste com confiança média confirma o critério", async () => {
    const { fale } = conversa(new Roteiro([{ necessidades: [pizza] }, { intencao: "ajustar", ajuste: { categoria: "pizza calabresa", criterio: "melhor_avaliada" } }]));
    await fale("quero pizza calabresa");
    expect((await fale(voz("quero a mais bem avaliada", 0.7))).resposta).toBe("Entendi: trocar a pizza calabresa pela opção mais bem avaliada. É isso?");
  });
});

describe("sugestões do Guide", () => {
  it("sugestões entram no plano sem cota própria, marcadas e faladas como sugestão", async () => {
    const llm = new Roteiro([{ necessidades: [pizza, sug("n2", "GROCERIES", "pipoca"), sug("n3", "SHOPPING", "presente"), sug("n4", "GROCERIES", "refrigerante")] }], "");
    const { s, fale } = conversa(llm);
    const r = await fale("aniversário com pizza calabresa e filme");
    expect(s.necessidades.filter((n) => n.fonte === "inferido")).toHaveLength(3);
    expect(r.tela!.plano.blocos.filter((b) => b.sugestao).map((b) => b.categoria)).toEqual(["pipoca", "presente", "refrigerante"]);
    expect(r.resposta).toMatch(/como sugestão, .*pipoca/);
  });

  it("sugestão recusada sai e não volta na sessão", async () => {
    const tudo = [pizza, sug("n2", "GROCERIES", "pipoca"), sug("n3", "SHOPPING", "presente")];
    const { s, fale } = conversa(new Roteiro([{ necessidades: tudo }, { intencao: "responder", necessidades: [pizza, sug("n2", "GROCERIES", "pipoca")] }, { necessidades: tudo }]));
    await fale("aniversário com pizza e filme");
    await fale("sem presente");
    await fale("monta de novo");
    expect(s.recusadas).toContain("presente");
    expect(s.necessidades.map((n) => n.categoria)).not.toContain("presente");
  });

  it("sugestão aceita vira pedido do usuário e não volta a ser sugestão", async () => {
    const { s, fale } = conversa(new Roteiro([
      { necessidades: [pizza, sug("n2", "GROCERIES", "pipoca")] },
      { intencao: "responder", necessidades: [pizza, { ...sug("n2", "GROCERIES", "pipoca"), fonte: "dito" }] },
      { necessidades: [pizza, sug("n2", "GROCERIES", "pipoca")] },
    ]));
    await fale("pizza e filme"); await fale("pode incluir a pipoca"); await fale("e agora?");
    expect(s.necessidades.find((n) => n.categoria === "pipoca")?.fonte).toBe("dito");
  });

  it("nunca sugere bebida alcoólica", async () => {
    const { s, fale } = conversa(new Roteiro([{ necessidades: [pizza, sug("n2", "GROCERIES", "cerveja")] }]));
    await fale("pizza com os amigos");
    expect(s.necessidades.map((n) => n.categoria)).toEqual(["pizza calabresa"]);
  });
});

describe("jornada do aniversário no modo por regras", () => {
  it("sugere pipoca e presente sem gastar pergunta com o presente", async () => {
    const { RuleBasedLlm } = await import("../llm/rules");
    const { s, fale } = conversa(new RuleBasedLlm());
    await fale("Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme.");
    await fale("Umas seis.");
    const r = await fale("Pode escolher.");
    expect(s.perguntasFeitas).toBe(1);
    expect(r.tela!.plano.blocos.map((b) => [b.categoria, Boolean(b.sugestao)])).toEqual([["pizza", false], ["pipoca", true], ["presente", true]]);
  });
});

describe("privacidade e conversa nova", () => {
  // Sem números de propósito: a regra de números fora do plano não pode ser quem barra.
  it("fala do LLM com dado pessoal cai no texto pronto", async () => {
    const { fale } = conversa(new Roteiro([{ necessidades: [pizza] }], "Mando o resumo da pizza calabresa para joao.silva@gmail.com. Quer ajustar algo?"));
    const r = await fale("quero pizza calabresa");
    expect(r.resposta).not.toMatch(/gmail/);
    expect(r.resposta).toMatch(/^Montei assim:/);
  });

  it("pergunta do LLM com telefone é descartada", async () => {
    const { s, fale } = conversa(new Roteiro([{ nivel: "L2", necessidades: [pizza], pergunta: "Posso ligar no (16) 99876-5432? Ou posso escolher por você." }]));
    const r = await fale("quero pizza");
    expect(r.resposta).not.toMatch(/99876/);
    expect(s.perguntasFeitas).toBe(0);
  });

  it("reiniciar começa do zero para o mesmo visitante", async () => {
    const s = sessaoDo("visitante-reinicio");
    s.necessidades = [pizza]; s.estado = "S3";
    const nova = reiniciarSessao("visitante-reinicio");
    expect(nova.estado).toBe("S0");
    expect(nova.necessidades).toEqual([]);
  });
});
