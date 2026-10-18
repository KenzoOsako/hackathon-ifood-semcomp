// Um turno de conversa: manda o texto ao agente (/api/converse) e fala o que voltar, na ordem em que chega.
// Sem React e sem navegador: tudo que toca o mundo entra por `TurnDeps`, então dá para testar com relógio e rede falsos.
import type { ConverseInput } from "@/agent/types";
import { converseTurn } from "./converse-client";
import type { AgentMeta } from "./conversation-export";
import type { ConverseEvent } from "./converse-events";
import type { Mark } from "./latency";
import { LOGIN_PATH } from "./auth-status";

// Sem frase de espera da voz ("Hum, um instante" saiu: a latência é atacada na origem, não mascarada).
// Só resta o `ack` do agente (`fraseEspera`), e só quando ele decide buscar.
// O `ack` do agente só vale se a resposta ainda demora. Se ela vem logo atrás (hoje, JSON único), a espera já acabou e
// falar "Deixa eu ver as opções." só atrasaria a resposta útil em ~1,6 s.
export const ACK_GRACE_MS = 50;

export interface TurnCtl {
  mark(m: Mark): void;
  enqueue(text: string): void;
  done(): void; // a resposta terminou sem fala: libera o microfone do modo sem as mãos
  end?(): void; // o fluxo do agente acabou (com ou sem fala): o microfone espera a fala que ainda toca
  begin?(): void;
}

export interface TurnHandlers {
  onAgentText?(text: string): void; // o que o Guide disse (sem a frase de espera), para mostrar na tela
  onScreen?(event: string, payload: unknown): void;
  onLogin?(url: string, reply: string): void;
  onMeta?(meta: AgentMeta): void; // metadados do agente neste turno (para observabilidade)
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
  const aborted = () => deps.signal?.aborted === true; // turno interrompido: nada dele pode mais falar nem mexer no microfone
  let spoke = false; // falou algo do agente (não conta a frase neutra da voz)
  let firstSeen = false;
  let cancelAck: () => void = () => undefined;

  ctl.begin?.();
  ctl.mark("request_sent");

  try {
    for await (const ev of converse(input, { signal: deps.signal, onMeta: (m) => { if (!aborted()) handlers.onMeta?.(m); } })) {
      if (aborted()) break;
      handle(ev);
    }
  } finally {
    cancelAck();
    // Um turno interrompido não fala, não mostra e, principalmente, não libera o microfone do turno NOVO.
    if (!aborted()) {
      if (said.length) handlers.onAgentText?.(said.join(" "));
      if (!spoke) ctl.done();
      ctl.end?.();
    }
  }

  function handle(ev: ConverseEvent) {
    if (!firstSeen && (ev.type === "ack" || ev.type === "speech" || ev.type === "error")) {
      firstSeen = true;
    }
    // "Primeiro pedaço" do backend = a resposta de verdade; o ack é espera e não entra nessa medida.
    if (ev.type === "speech" || ev.type === "error") ctl.mark("first_chunk");
    if (ev.type === "ack") {
      const text = ev.text;
      cancelAck = deps.after(() => { if (!aborted()) { spoke = true; ctl.enqueue(text); } }, ACK_GRACE_MS);
    } else if (ev.type === "speech") {
      cancelAck(); spoke = true; said.push(ev.text); ctl.enqueue(ev.text);
    } else if (ev.type === "error") {
      cancelAck(); spoke = true; said.push(ev.reply); ctl.enqueue(ev.reply);
      // O 401 do agente traz o caminho; se vier só o código, a rota de login é sempre a mesma.
      const url = ev.loginUrl ?? (ev.code === "IFOOD_LOGIN" ? LOGIN_PATH : undefined);
      if (url) handlers.onLogin?.(url, ev.reply);
    } else if (ev.type === "screen") {
      handlers.onScreen?.(ev.event, ev.payload);
    }
  }
}
