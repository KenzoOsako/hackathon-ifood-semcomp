import { describe, expect, it } from "vitest";
import type { ConverseEvent } from "./converse-events";
import { FILLER_AFTER_MS, runTurn, type TurnCtl, type TurnHandlers } from "./turn";

// Relógio e agente falsos: o agente "demora" `delay` ms (no relógio falso) antes de devolver os eventos.
function setup(events: ConverseEvent[], delay = 0) {
  let now = 0;
  const timers: Array<{ at: number; fn: () => void; dead?: boolean }> = [];
  const after = (fn: () => void, ms: number) => { const t = { at: now + ms, fn } as { at: number; fn: () => void; dead?: boolean }; timers.push(t); return () => { t.dead = true; }; };
  const advance = (ms: number) => { now += ms; for (const t of timers) if (!t.dead && t.at <= now) { t.dead = true; t.fn(); } };
  const log: string[] = [];
  const said: string[] = [];
  const ctl: TurnCtl = { mark: (m) => log.push(`mark:${m}`), enqueue: (t) => said.push(t), done: () => log.push("done"), begin: () => log.push("begin") };
  const seen: { text?: string; screens: string[]; login?: string } = { screens: [] };
  const handlers: TurnHandlers = { onAgentText: (t) => (seen.text = t), onScreen: (e) => seen.screens.push(e), onLogin: (u) => (seen.login = u) };
  const converse = async function* () {
    if (delay) advance(delay);
    for (const e of events) yield e;
  } as never;
  const run = () => runTurn({ texto: "oi", origem: "voz" }, ctl, handlers, { converse, after, pickFiller: () => "Deixa eu ver as opções." });
  return { run, said, log, seen };
}

describe("runTurn", () => {
  it("resposta rápida: fala só a resposta, sem frase de espera", async () => {
    const t = setup([{ type: "speech", seq: 0, text: "Achei duas opções.", final: true }, { type: "done", turnId: "1" }], 100);
    await t.run();
    expect(t.said).toEqual(["Achei duas opções."]);
    expect(t.seen.text).toBe("Achei duas opções.");
    expect(t.log).toEqual(["begin", "mark:request_sent", "mark:first_chunk"]);
  });

  it("agente lento: a frase de espera toca antes e o ack do backend não repete", async () => {
    const t = setup([{ type: "ack", text: "Já vejo." }, { type: "speech", seq: 0, text: "Montei assim.", final: true }, { type: "done", turnId: "1" }], FILLER_AFTER_MS + 200);
    await t.run();
    expect(t.said).toEqual(["Deixa eu ver as opções.", "Montei assim."]);
    expect(t.seen.text).toBe("Montei assim."); // a espera não aparece como fala do agente
  });

  it("ack do backend vale quando a espera local não chegou a tocar", async () => {
    const t = setup([{ type: "ack", text: "Já vejo." }, { type: "speech", seq: 0, text: "Pronto.", final: true }, { type: "done", turnId: "1" }], 100);
    await t.run();
    expect(t.said).toEqual(["Já vejo.", "Pronto."]);
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

  it("turno sem nenhuma fala libera o microfone; com fala, não", async () => {
    const vazio = setup([{ type: "done", turnId: "1" }]);
    await vazio.run();
    expect(vazio.log).toContain("done");
    const falou = setup([{ type: "speech", seq: 0, text: "Oi.", final: true }]);
    await falou.run();
    expect(falou.log).not.toContain("done");
  });

  it("só a frase de espera falada, sem resposta depois, ainda libera o microfone", async () => {
    const t = setup([{ type: "done", turnId: "1" }], FILLER_AFTER_MS + 100);
    await t.run();
    expect(t.said).toEqual(["Deixa eu ver as opções."]);
    expect(t.log).toContain("done");
  });
});
