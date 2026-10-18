// Um turno de conversa: manda o texto ao agente (/api/converse) e fala o que voltar, na ordem em que chega.
// Sem React e sem navegador: tudo que toca o mundo entra por `TurnDeps`, então dá para testar com relógio e rede falsos.
import type { ConverseInput } from "@/agent/types";
import { converseTurn } from "./converse-client";
import type { ConverseEvent } from "./converse-events";
import type { Mark } from "./latency";

// Frases de espera fixas. Ficam sintetizadas de antemão (player.preload) e tocam sem ir à rede.
export const FILLERS = ["Deixa eu ver as opções.", "Um instante, já te mostro.", "Já vejo isso para você."] as const;
// Só fala a espera se o agente demorar: respostas rápidas não ganham "um instante" desnecessário.
export const FILLER_AFTER_MS = 700;

export interface TurnCtl {
  mark(m: Mark): void;
  enqueue(text: string): void;
  done(): void; // a resposta terminou sem fala: libera o microfone do modo sem as mãos
  begin?(): void;
}

export interface TurnHandlers {
  onAgentText?(text: string): void; // o que o Guide disse (sem a frase de espera), para mostrar na tela
  onScreen?(event: string, payload: unknown): void;
  onLogin?(url: string, reply: string): void;
}

export interface TurnDeps {
  converse?: typeof converseTurn;
  after(fn: () => void, ms: number): () => void;
  pickFiller?(): string;
  signal?: AbortSignal;
}

export type TurnInput = Pick<ConverseInput, "texto" | "origem" | "sinais" | "hipoteses">;

export async function runTurn(input: TurnInput, ctl: TurnCtl, handlers: TurnHandlers, deps: TurnDeps): Promise<void> {
  const converse = deps.converse ?? converseTurn;
  const filler = deps.pickFiller ?? (() => FILLERS[Math.floor(Math.random() * FILLERS.length)]);
  const said: string[] = [];
  let spoke = false; // falou algo do agente (não conta a frase de espera)
  let firstSeen = false;
  let fillerSpoken = false;

  ctl.begin?.();
  ctl.mark("request_sent");
  const cancelFiller = deps.after(() => {
    if (firstSeen) return;
    fillerSpoken = true;
    ctl.enqueue(filler());
  }, FILLER_AFTER_MS);

  try {
    for await (const ev of converse(input, { signal: deps.signal })) {
      handle(ev);
    }
  } finally {
    cancelFiller();
    if (said.length) handlers.onAgentText?.(said.join(" "));
    if (!spoke) ctl.done();
  }

  function handle(ev: ConverseEvent) {
    if (!firstSeen && (ev.type === "ack" || ev.type === "speech" || ev.type === "error")) {
      firstSeen = true;
      cancelFiller();
      ctl.mark("first_chunk");
    }
    if (ev.type === "ack") {
      // Se a espera local já foi falada, a do backend seria repetição.
      if (!fillerSpoken) { spoke = true; ctl.enqueue(ev.text); }
    } else if (ev.type === "speech") {
      spoke = true; said.push(ev.text); ctl.enqueue(ev.text);
    } else if (ev.type === "error") {
      spoke = true; said.push(ev.reply); ctl.enqueue(ev.reply);
      if (ev.loginUrl) handlers.onLogin?.(ev.loginUrl, ev.reply);
    } else if (ev.type === "screen") {
      handlers.onScreen?.(ev.event, ev.payload);
    }
  }
}
