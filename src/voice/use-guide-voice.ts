"use client";
// HOOK ÚNICO DA VOZ PARA A INTERFACE. Junta microfone, reconhecimento, agente (/api/converse) e fala.
// Quem monta a tela (orb, chat, plano) só lê o que este hook devolve e chama as ações; não precisa conhecer a voz.
//
//   const g = useGuideVoice();
//   <Orb onClick={g.toggle} />   // um botão resolve falar / parar / interromper (g.label diz o que ele faz agora)
//   g.lines            // conversa para mostrar (voce / agente)
//   g.screen           // último evento de tela do agente ({ event: "mostrar_plano", payload: PlanoSnapshot })
//   g.login            // { url } quando o agente pede conexão com o iFood: mostre o botão "Conectar iFood"
//   g.unclear          // texto que o Guide não entendeu direito (ele já pediu para repetir)
//   g.sendText("...")  // o texto sempre funciona (mesmo caminho do áudio)
//   g.cancel()         // descarta a gravação em andamento (Esc faz o mesmo; Esc também interrompe a fala)
import { useCallback, useEffect, useRef, useState } from "react";
import { termsFromPlan } from "./plan-terms";
import type { VoiceSignals } from "./signals";
import { runTurn, type TurnCtl } from "./turn";
import { useVoice, type Utterance } from "./use-voice";

export interface GuideLine { id: string; from: "voce" | "agente"; text: string }
export interface GuideScreen { event: string; payload: unknown }

export const GREETING = "Oi! Eu sou o Guide! Em que posso te ajudar hoje?";

const after = (fn: () => void, ms: number) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export function useGuideVoice() {
  const [lines, setLines] = useState<GuideLine[]>([{ id: "init", from: "agente", text: GREETING }]);
  const [screen, setScreen] = useState<GuideScreen | null>(null);
  const [login, setLogin] = useState<{ url: string } | null>(null);
  const [unclear, setUnclear] = useState<string | null>(null);
  const [utterance, setUtterance] = useState<Utterance | null>(null);
  const [busy, setBusy] = useState(false);
  const terms = useRef<string[]>([]); // nomes do plano na tela: ajudam o reconhecimento na próxima fala
  const seq = useRef(0);
  const nextId = (p: string) => `${p}-${++seq.current}`;

  const run = useCallback(async (texto: string, origem: "voz" | "texto", sinais: VoiceSignals | undefined, ctl: TurnCtl) => {
    setBusy(true);
    setLogin(null);
    setUnclear(null);
    setLines((l) => [...l, { id: nextId("u"), from: "voce", text: texto }]);
    try {
      await runTurn({ texto, origem, sinais }, ctl, {
        onAgentText: (text) => setLines((l) => [...l, { id: nextId("a"), from: "agente", text }]),
        onScreen: (event, payload) => { terms.current = termsFromPlan(payload); setScreen({ event, payload }); },
        onLogin: (url) => setLogin({ url }),
      }, { after });
    } finally {
      setBusy(false);
    }
  }, []);

  const voice = useVoice(
    (u, api) => {
      setUtterance(u);
      void run(u.texto, "voz", u.sinais, { mark: api.mark, enqueue: (t) => api.enqueue(t), done: api.turnDone });
    },
    { getTerms: () => terms.current, onUnclear: (t) => setUnclear(t) },
  );

  const { mark, enqueue, turnDone, beginTurn } = voice;
  const sendText = useCallback((texto: string) => {
    const t = texto.trim();
    if (!t) return;
    void run(t, "texto", undefined, { mark, enqueue: (x) => enqueue(x), done: turnDone, begin: beginTurn });
  }, [run, mark, enqueue, turnDone, beginTurn]);

  // Esc: descarta a gravação; se o Guide está falando, interrompe.
  const { state, cancel, stopSpeaking } = voice;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (state === "listening") cancel();
      else if (state === "speaking") stopSpeaking();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, cancel, stopSpeaking]);

  const listening = voice.state === "listening";
  // O mesmo botão: ouvindo → encerra e envia; falando → interrompe; parado → começa a ouvir.
  const { stop, start } = voice;
  const toggle = useCallback(() => {
    if (state === "listening") stop();
    else if (state === "speaking") stopSpeaking();
    else if (state !== "transcribing") void start();
  }, [state, stop, stopSpeaking, start]);
  const label = { idle: voice.handsFree ? "Escutando…" : "Falar", listening: voice.handsFree ? "Ouvindo… (toque para encerrar)" : "Parar", transcribing: "Reconhecendo…", speaking: "Falando… (toque para interromper)", error: "Falar" }[voice.state];

  return { ...voice, lines, screen, login, unclear, utterance, busy, listening, toggle, label, sendText };
}
