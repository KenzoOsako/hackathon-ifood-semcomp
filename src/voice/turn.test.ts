import { describe, expect, it } from "vitest";
import type { ConverseEvent } from "./converse-events";
import { NEUTRAL_FILLER } from "./phrases";
import { FILLER_AFTER_MS, runTurn, type TurnCtl, type TurnHandlers } from "./turn";

// Relógio e agente falsos: o agente "demora" `delay` ms (no relógio falso) antes de devolver os eventos.
function setup(events: ConverseEvent[], delay = 0, origem: "voz" | "texto" = "voz") {
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
  const run = () => runTurn({ texto: "oi", origem }, ctl, handlers, { converse, after });
  return { run, said, log, seen };
}

describe("runTurn", () => {
  it("agente rápido (dentro de 100 ms): fala só a resposta, sem frase de espera", async () => {
    const t = setup([{ type: "speech", seq: 0, text: "Achei duas opções.", final: true }, { type: "done", turnId: "1" }], FILLER_AFTER_MS - 50);
    await t.run();
    expect(t.said).toEqual(["Achei duas opções."]);
    expect(t.seen.text).toBe("Achei duas opções.");
    expect(t.log).toEqual(["begin", "mark:request_sent", "mark:first_chunk"]);
  });

  it("agente lento: frase neutra da voz primeiro; o ack do agente e a resposta vêm depois, sem sumir", async () => {
    const t = setup([{ type: "ack", text: "Deixa eu ver as opções." }, { type: "speech", seq: 0, text: "Montei assim.", final: true }, { type: "done", turnId: "1" }], FILLER_AFTER_MS + 500);
    await t.run();
    expect(t.said).toEqual([NEUTRAL_FILLER, "Deixa eu ver as opções.", "Montei assim."]);
    expect(t.seen.text).toBe("Montei assim."); // a espera da voz não aparece como fala do agente
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
});
