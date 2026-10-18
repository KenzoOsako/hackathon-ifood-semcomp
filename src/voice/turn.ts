// Um turno de conversa: manda o texto ao agente (/api/converse) e fala o que voltar, na ordem em que chega.
// Sem React e sem navegador: tudo que toca o mundo entra por `TurnDeps`, então dá para testar com relógio e rede falsos.
import type { ConverseInput } from "@/agent/types";
import { converseTurn } from "./converse-client";
import type { ConverseEvent } from "./converse-events";
import type { Mark } from "./latency";
import { LOGIN_PATH } from "./auth-status";
import { NEUTRAL_FILLER } from "./phrases";

// Duas camadas de espera (docs/PLANO_INTEGRACAO_VOZ_AGENTE.md):
//  1) esta, da voz: frase neutra em cache, ~0,1 s depois do reconhecimento, só quando a fala veio por VOZ;
//  2) a do agente (`fraseEspera` → evento `ack`), só quando ele decide buscar. As duas podem tocar, uma depois da outra.
// Se o agente responder dentro desses 100 ms (modo por regras), a espera nem toca.
export const FILLER_AFTER_MS = 100;

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
  signal?: AbortSignal;
}

export type TurnInput = Pick<ConverseInput, "texto" | "origem" | "sinais" | "hipoteses">;

export async function runTurn(input: TurnInput, ctl: TurnCtl, handlers: TurnHandlers, deps: TurnDeps): Promise<void> {
  const converse = deps.converse ?? converseTurn;
  const said: string[] = [];
  let spoke = false; // falou algo do agente (não conta a frase neutra da voz)
  let firstSeen = false;

  ctl.begin?.();
  ctl.mark("request_sent");
  const cancelFiller = input.origem === "voz"
    ? deps.after(() => { if (!firstSeen) ctl.enqueue(NEUTRAL_FILLER); }, FILLER_AFTER_MS)
    : () => undefined;

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
      spoke = true; ctl.enqueue(ev.text);
    } else if (ev.type === "speech") {
      spoke = true; said.push(ev.text); ctl.enqueue(ev.text);
    } else if (ev.type === "error") {
      spoke = true; said.push(ev.reply); ctl.enqueue(ev.reply);
      // O 401 do agente traz o caminho; se vier só o código, a rota de login é sempre a mesma.
      const url = ev.loginUrl ?? (ev.code === "IFOOD_LOGIN" ? LOGIN_PATH : undefined);
      if (url) handlers.onLogin?.(url, ev.reply);
    } else if (ev.type === "screen") {
      handlers.onScreen?.(ev.event, ev.payload);
    }
  }
}
