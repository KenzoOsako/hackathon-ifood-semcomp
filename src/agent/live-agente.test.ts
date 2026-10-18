// Verificação com o LLM REAL (só roda com EVAL_REAL=1, LLM_PROVIDER, LLM_MODEL e a chave do provedor no ambiente).
// Prova os MECANISMOS GERAIS (decompor pedido abstrato, julgar relevância), não casos decorados: cada exemplo é um
// tipo de situação e a asserção é sobre o critério, não sobre uma lista.
//   EVAL_REAL=1 LLM_PROVIDER=google LLM_MODEL=gemini-3.5-flash-lite GOOGLE_API_KEY=... npx vitest run src/agent/live-agente.test.ts
import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { criarLlm } from "./llm";
import { novaSessao } from "./orchestrator";
import type { CandidatoJulgado, LlmPort, Necessidade, TurnoInterpretado } from "./types";

const real = process.env.EVAL_REAL === "1";
const nec = (categoria: string, vertical: Necessidade["vertical"] = "GROCERIES", consultas?: string[]): Necessidade => ({ id: "n1", vertical, categoria, restricoes: [], ...(consultas ? { consultas } : {}) });
const lista = (itens: string[]): CandidatoJulgado[] => itens.map((item, i) => ({ ref: `r${i}`, item, loja: "Loja" }));

let llmCache: Promise<LlmPort> | undefined;
const llm = () => (llmCache ??= criarLlm());

// Cota gratuita (~15 chamadas/min): em 429 espera e tenta de novo, em vez de reprovar por causa do provedor.
async function tentar<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 3 || !/429|quota|RESOURCE_EXHAUSTED|rate/i.test(String((e as Error)?.message ?? e))) throw e;
      await new Promise((r) => setTimeout(r, 20_000));
    }
  }
}
// O que o modelo respondeu, para avaliar a QUALIDADE (não só se a asserção passou). EVAL_LOG=arquivo.jsonl.
const registrar = (chave: string, valor: unknown) => { if (process.env.EVAL_LOG) appendFileSync(process.env.EVAL_LOG, JSON.stringify({ chave, valor }) + String.fromCharCode(10)); };

async function julgar(n: Necessidade, itens: string[]) {
  const l = await llm();
  const v = await tentar(() => l.julgar!({ necessidade: n, candidatos: lista(itens) }));
  const out = Object.fromEntries(itens.map((item, i) => [item, v[`r${i}`] ?? "sem veredito"]));
  registrar(`juiz:${n.categoria}`, out);
  return out;
}

async function interpretar(texto: string, ctx: Partial<ReturnType<typeof novaSessao>> = {}): Promise<TurnoInterpretado> {
  const s = { ...novaSessao("live"), ...ctx };
  const l = await llm();
  const t = await tentar(() => l.interpretar({ texto, pressaDetectada: false, session: { estado: s.estado, nivel: s.nivel, perguntasFeitas: s.perguntasFeitas, ocasiao: s.ocasiao, necessidades: s.necessidades, history: s.history, opcoesFaladas: [] } }));
  registrar(`interpretar:${texto}`, { nivel: t.nivel, intencao: t.intencao, necessidades: t.necessidades.map((n) => ({ v: n.vertical, c: n.categoria, f: n.fonte, q: n.consultas })), pergunta: t.pergunta, assumido: t.assumido });
  return t;
}

describe.skipIf(!real)("LLM real: juiz de relevância (critério geral)", () => {
  it("pedido que nomeia um conjunto: o item do conjunto serve, outro tipo de coisa não", { timeout: 180_000 }, async () => {
    const v = await julgar(nec("churrasco", "GROCERIES", ["picanha", "costela"]), ["Picanha bovina 1kg", "Costela bovina 2kg", "Linguiça toscana 500g", "X-Burger Cheddar", "Pudim de leite", "Cheddar Jr."]);
    console.info("churrasco →", JSON.stringify(v));
    expect(v["Picanha bovina 1kg"]).toBe("serve");
    expect(v["Costela bovina 2kg"]).toBe("serve");
    expect(v["Pudim de leite"]).toBe("nao_serve");
    expect(v["X-Burger Cheddar"]).not.toBe("serve");
    expect(v["Cheddar Jr."]).not.toBe("serve");
  });

  it("produto de mercado: o texto 'leite' aparece em sobremesa, e o juiz sabe que não é o produto", { timeout: 180_000 }, async () => {
    const v = await julgar(nec("leite"), ["Leite integral 1L", "Leite desnatado caixa 1L", "Pudim de leite condensado", "Brigadeiro de leite ninho", "Leite de coco 200ml"]);
    console.info("leite →", JSON.stringify(v));
    expect(v["Leite integral 1L"]).toBe("serve");
    expect(v["Leite desnatado caixa 1L"]).toBe("serve");
    expect(v["Pudim de leite condensado"]).not.toBe("serve");
    expect(v["Brigadeiro de leite ninho"]).not.toBe("serve");
  });

  it("categoria genérica que o catálogo não nomeia ('presente'): itens de presente servem", { timeout: 180_000 }, async () => {
    const v = await julgar(nec("presente", "SHOPPING"), ["Livro de culinária ilustrado", "Fone de ouvido bluetooth", "Kit de panelas antiaderentes", "Arroz 5kg"]);
    console.info("presente →", JSON.stringify(v));
    expect(v["Livro de culinária ilustrado"]).toBe("serve");
    expect(v["Fone de ouvido bluetooth"]).toBe("serve");
    expect(v["Arroz 5kg"]).not.toBe("serve");
  });

  it("outra vertical e outra palavra (ração): o critério é o mesmo", { timeout: 180_000 }, async () => {
    const v = await julgar(nec("ração para cachorro"), ["Ração seca cães adultos 10kg", "Ração para gatos 1kg", "Petisco para cães", "Bolacha de arroz"]);
    console.info("ração →", JSON.stringify(v));
    expect(v["Ração seca cães adultos 10kg"]).toBe("serve");
    expect(v["Bolacha de arroz"]).toBe("nao_serve");
    expect(v["Ração para gatos 1kg"]).not.toBe("serve");
  });
});

describe.skipIf(!real)("LLM real: planejador (decompor e consultar)", () => {
  it("pedido abstrato ('ingredientes de bolo') vira itens concretos de mercado, cada um com consulta", { timeout: 180_000 }, async () => {
    const t = await interpretar("Eu tô querendo comprar ingredientes pra fazer um bolo, aniversário do meu irmão hoje");
    console.info("bolo →", JSON.stringify(t.necessidades.map((n) => [n.vertical, n.categoria, n.fonte, n.consultas])));
    const mercado = t.necessidades.filter((n) => n.vertical === "GROCERIES");
    expect(mercado.length).toBeGreaterThanOrEqual(3);
    // O que não é de mercado (ex.: um presente para o aniversário) só pode ser SUGESTÃO, nunca parte do pedido.
    expect(t.necessidades.filter((n) => n.vertical !== "GROCERIES").every((n) => n.fonte === "inferido")).toBe(true);
    const nomes = mercado.map((n) => n.categoria.toLowerCase()).join(" | ");
    expect(nomes).toMatch(/ovo/);
    expect(nomes).toMatch(/farinha|a[çc]úcar|a[çc]ucar|leite/);
    expect(mercado.every((n) => (n.consultas ?? []).length >= 1)).toBe(true);
    // Os ingredientes SÃO o pedido: a maioria é "dito", não sugestão.
    expect(mercado.filter((n) => n.fonte !== "inferido").length).toBeGreaterThanOrEqual(Math.ceil(mercado.length / 2));
  });

  it("itens nomeados pelo usuário ('leite e ovo') são o pedido, não uma categoria vaga", { timeout: 180_000 }, async () => {
    const t = await interpretar("quero leite e ovo");
    console.info("leite e ovo →", JSON.stringify(t.necessidades.map((n) => [n.vertical, n.categoria, n.fonte, n.consultas])));
    expect(t.necessidades.length).toBeGreaterThanOrEqual(2);
    expect(t.necessidades.every((n) => n.vertical === "GROCERIES")).toBe(true);
    const nomes = t.necessidades.map((n) => n.categoria.toLowerCase()).join(" | ");
    expect(nomes).toMatch(/leite/);
    expect(nomes).toMatch(/ovo/);
    // Lista de mercado clara: não pergunta "mais algum item?" nem quantas pessoas (nada disso muda a busca).
    expect(t.pergunta ?? "").not.toMatch(/mais algum|mais (um )?item|quantas pessoas|para quantas|marca/i);
  });

  it("pedir 'não só restaurante' / mercado leva a GROCERIES", { timeout: 180_000 }, async () => {
    const t = await interpretar("tem algo de mercado aí? tipo arroz e feijão");
    console.info("arroz e feijão →", JSON.stringify(t.necessidades.map((n) => [n.vertical, n.categoria])));
    expect(t.necessidades.length).toBeGreaterThanOrEqual(1);
    expect(t.necessidades.every((n) => n.vertical === "GROCERIES")).toBe(true);
    expect(t.pergunta ?? "").not.toMatch(/quantas pessoas|para quantas|marca/i);
  });

  it("conjunto de outro assunto ('coisas para um churrasco') também é decomposto", { timeout: 180_000 }, async () => {
    const t = await interpretar("vou fazer um churrasco amanhã, preciso de tudo");
    console.info("churrasco →", JSON.stringify(t.necessidades.map((n) => [n.vertical, n.categoria, n.fonte])));
    expect(t.necessidades.length).toBeGreaterThanOrEqual(2);
    expect(new Set(t.necessidades.map((n) => n.categoria.toLowerCase())).size).toBe(t.necessidades.length);
  });
});
