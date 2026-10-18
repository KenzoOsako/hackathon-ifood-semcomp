import { describe, expect, it } from "vitest";
import type { ConverseEvent } from "./converse-events";
import { NEUTRAL_FILLER } from "./phrases";
import { ACK_GRACE_MS, FILLER_AFTER_MS, runTurn, type TurnCtl, type TurnHandlers } from "./turn";

// Relógio e agente falsos: o agente "demora" `delay` ms (no relógio falso) antes de devolver os eventos.
function setup(events: ConverseEvent[], delay = 0, origem: "voz" | "texto" = "voz", gapAfterAck = 0) {
  let now = 0;
  const timers: Array<{ at: number; fn: () => void; dead?: boolean }> = [];
  const after = (fn: () => void, ms: number) => { const t = { at: now + ms, fn } as { at: number; fn: () => void; dead?: boolean }; timers.push(t); return () => { t.dead = true; }; };
  const advance = (ms: number) => { now += ms; for (const t of timers) if (!t.dead && t.at <= now) { t.dead = true; t.fn(); } };
  const log: string[] = [];
  const said: string[] = [];
  const ctl: TurnCtl = { mark: (m) => log.push(`mark:${m}`), enqueue: (t) => said.push(t), done: () => log.push("done"), end: () => log.push("end"), begin: () => log.push("begin") };
  const seen: { text?: string; screens: string[]; login?: string } = { screens: [] };
  const handlers: TurnHandlers = { onAgentText: (t) => (seen.text = t), onScreen: (e) => seen.screens.push(e), onLogin: (u) => (seen.login = u) };
  const converse = async function* () {
    if (delay) advance(delay);
    for (const e of events) {
      yield e;
      if (e.type === "ack" && gapAfterAck) advance(gapAfterAck); // o agente demora depois do ack (fluxo em pedaços de verdade)
    }
  } as never;
  const run = () => runTurn({ texto: "oi", origem }, ctl, handlers, { converse, after });
  return { run, said, log, seen };
}

describe("runTurn", () => {
  it("agente rápido (dentro de 100 ms): fala só a resposta, sem frase de espera", async () => {
    const t = setup([{ type: "speech", seq: 0, text: "Achei duas opções.", final: true }, { type: "done", turnId: "1" }], FILLER_AFTER_MS - 50);
    await t.run();
    expect(t.said).toEqual(["Achei duas opções."]);
    expect(t.seen.text).toBe("Achei duas opções.");
    expect(t.log).toEqual(["begin", "mark:request_sent", "mark:first_chunk", "end"]);
  });

  it("agente lento com JSON único (ack e resposta juntos): frase neutra e resposta; o ack seria só atraso e é descartado", async () => {
    const t = setup([{ type: "ack", text: "Deixa eu ver as opções." }, { type: "speech", seq: 0, text: "Montei assim.", final: true }, { type: "done", turnId: "1" }], FILLER_AFTER_MS + 500);
    await t.run();
    expect(t.said).toEqual([NEUTRAL_FILLER, "Montei assim."]);
    expect(t.seen.text).toBe("Montei assim."); // a espera da voz não aparece como fala do agente
  });

  it("fluxo em pedaços: o ack toca quando a resposta ainda demora, antes dela", async () => {
    const t = setup([{ type: "ack", text: "Deixa eu ver as opções." }, { type: "speech", seq: 0, text: "Montei assim.", final: true }], 10, "voz", ACK_GRACE_MS + 100);
    await t.run();
    expect(t.said).toEqual(["Deixa eu ver as opções.", "Montei assim."]);
  });

  it("texto digitado nunca ganha frase de espera, mesmo com agente lento", async () => {
    const t = setup([{ type: "speech", seq: 0, text: "Montei assim.", final: true }], 2000, "texto");
    await t.run();
    expect(t.said).toEqual(["Montei assim."]);
  });

  it("tela vai para a interface e não é falada", async () => {
    const t = setup([{ type: "speech", seq: 0, text: "Aqui está.", final: true }, { type: "screen", event: "mostrar_plano", payload: {} }, { type: "done", turnId: "1" }]);
    await t.run();
    expect(t.seen.screens).toEqual(["mostrar_plano"]);
    expect(t.said).toEqual(["Aqui está."]);
  });

  it("erro com loginUrl: fala o aviso e entrega o link para o botão", async () => {
    const t = setup([{ type: "error", code: "IFOOD_LOGIN", reply: "Conecte sua conta iFood.", loginUrl: "/api/auth/login" }]);
    await t.run();
    expect(t.said).toEqual(["Conecte sua conta iFood."]);
    expect(t.seen.login).toBe("/api/auth/login");
  });

  it("code IFOOD_LOGIN sem loginUrl ainda mostra o botão (a rota de login é fixa)", async () => {
    const t = setup([{ type: "error", code: "IFOOD_LOGIN", reply: "Conecte sua conta iFood." }]);
    await t.run();
    expect(t.seen.login).toBe("/api/auth/login");
  });

  it("outros erros não mostram botão de login", async () => {
    const t = setup([{ type: "error", code: "REDE", reply: "Não consegui responder agora." }]);
    await t.run();
    expect(t.seen.login).toBeUndefined();
  });

  it("turno sem nenhuma fala libera o microfone; com fala, não", async () => {
    const vazio = setup([{ type: "done", turnId: "1" }]);
    await vazio.run();
    expect(vazio.log).toContain("done");
    const falou = setup([{ type: "speech", seq: 0, text: "Oi.", final: true }]);
    await falou.run();
    expect(falou.log).not.toContain("done");
  });

  it("só a frase neutra falada, sem resposta depois, ainda libera o microfone", async () => {
    const t = setup([{ type: "done", turnId: "1" }], FILLER_AFTER_MS + 100);
    await t.run();
    expect(t.said).toEqual([NEUTRAL_FILLER]);
    expect(t.log).toContain("done");
  });

  it("fim do turno com fala avisa `end` sem `done`; sem fala avisa os dois", async () => {
    const falou = setup([{ type: "speech", seq: 0, text: "Oi.", final: true }]);
    await falou.run();
    expect(falou.log).toContain("end");
    expect(falou.log).not.toContain("done");
    const mudo = setup([{ type: "done", turnId: "1" }]);
    await mudo.run();
    expect(mudo.log).toEqual(expect.arrayContaining(["done", "end"]));
  });

  it("turno interrompido: não fala, não mostra e não libera o microfone do turno novo", async () => {
    const ac = new AbortController();
    const log: string[] = [];
    const said: string[] = [];
    const seen: string[] = [];
    const ctl: TurnCtl = { mark: () => undefined, enqueue: (t) => said.push(t), done: () => log.push("done"), end: () => log.push("end") };
    const converse = (async function* () {
      ac.abort(); // a pessoa interrompeu enquanto o agente ainda trabalhava
      yield { type: "ack", text: "Deixa eu ver as opções." };
      yield { type: "speech", seq: 0, text: "Resposta atrasada.", final: true };
      yield { type: "screen", event: "mostrar_plano", payload: {} };
    }) as never;
    await runTurn({ texto: "oi", origem: "voz" }, ctl, { onAgentText: (t) => seen.push(t), onScreen: (e) => seen.push(e) }, { converse, after: () => () => undefined, signal: ac.signal });
    expect(said).toEqual([]);
    expect(seen).toEqual([]);
    expect(log).toEqual([]);
  });

  it("a frase de espera não toca se o turno foi interrompido antes dos 100 ms", async () => {
    const ac = new AbortController();
    const said: string[] = [];
    let fire: () => void = () => undefined;
    const ctl: TurnCtl = { mark: () => undefined, enqueue: (t) => said.push(t), done: () => undefined };
    const converse = (async function* () { /* agente lento: nada chega */ }) as never;
    const p = runTurn({ texto: "oi", origem: "voz" }, ctl, {}, { converse, after: (fn) => { fire = fn; return () => undefined; }, signal: ac.signal });
    ac.abort();
    fire();
    await p;
    expect(said).toEqual([]);
  });

  it("o ack do agente é espera: só a fala ou o erro marcam o primeiro pedaço útil", async () => {
    const soAck = setup([{ type: "ack", text: "Deixa eu ver as opções." }, { type: "done", turnId: "1" }]);
    await soAck.run();
    expect(soAck.log).not.toContain("mark:first_chunk");
    const comFala = setup([{ type: "ack", text: "Deixa eu ver as opções." }, { type: "speech", seq: 0, text: "Montei assim.", final: true }], 0, "voz", ACK_GRACE_MS + 100);
    await comFala.run();
    expect(comFala.log.filter((l) => l === "mark:first_chunk")).toHaveLength(1);
  });
});
