"use client";
// Casca fina de React em volta da VoiceSession (session.ts). Toda a lógica (gravar, fim de fala, interrupção,
// modo sem as mãos) está na sessão e é testada com peças falsas; aqui só se liga o React e o navegador.
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserDeps } from "./browser-deps";
import type { LatencySummary, Mark } from "./latency";
import { SpeechPlayer } from "./player";
import { PRELOAD_PHRASES } from "./phrases";
import { VoiceSession, type Utterance, type VoiceApi, type VoiceDiag, type VoiceErrorCode, type VoiceState } from "./session";

export type { Utterance, VoiceApi, VoiceErrorCode, VoiceState };

const MESSAGES: Record<VoiceErrorCode, string> = {
  unsupported: "Este navegador não grava áudio. Use o texto ou o Chrome.",
  permission_denied: "Microfone bloqueado. Libere o acesso ou use o texto.",
  too_short: "Fala muito curta. Tente de novo.",
  no_speech: "Não ouvi nada. Chegue mais perto do microfone.",
  stt_failed: "Não consegui reconhecer a fala. Pode repetir ou digitar?",
  stt_unavailable: "Reconhecimento de voz indisponível. Seguindo em texto.",
  rate_limited: "Muitas falas em pouco tempo. Aguarde um instante ou digite.",
};

export interface VoiceOptions {
  // Palavras que estão na tela agora (lojas, itens). Ajudam o reconhecimento a acertar os nomes.
  getTerms?: () => string[];
  // Reconhecimento incerto: a fala não foi ao agente e o Guide pediu para repetir.
  onUnclear?: (texto: string, confianca: number) => void;
  // Fim de cada turno com áudio: o resumo de latência daquela rodada.
  onLatency?: (s: LatencySummary) => void;
  // O microfone abriu (a pessoa começou a falar, inclusive por cima do Guide): o turno anterior não vale mais.
  onListening?: () => void;
}

export function useVoice(onUtterance: (u: Utterance, api: VoiceApi) => void, options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const [level, setLevel] = useState(0);
  const [handsFreeState, setHandsFreeState] = useState(false);
  const [latency, setLatency] = useState<LatencySummary | null>(null);
  const [diag, setDiag] = useState<VoiceDiag>({});
  const session = useRef<VoiceSession | null>(null);
  const player = useRef<SpeechPlayer | null>(null);
  const onUtt = useRef(onUtterance);
  const termsFn = useRef(options.getTerms);
  const unclearFn = useRef(options.onUnclear);
  const latencyFn = useRef(options.onLatency);
  const listeningFn = useRef(options.onListening);
  useEffect(() => { onUtt.current = onUtterance; termsFn.current = options.getTerms; unclearFn.current = options.onUnclear; latencyFn.current = options.onLatency; listeningFn.current = options.onListening; }, [onUtterance, options.getTerms, options.onUnclear, options.onLatency, options.onListening]);

  useEffect(() => {
    const p = new SpeechPlayer(undefined, {
      onTtsResponse: (text) => session.current?.ttsResponded(text),
      onAudioStart: (text) => session.current?.speakingStarted(text),
    });
    player.current = p;
    p.preload([...PRELOAD_PHRASES]); // frases fixas prontas (as da voz e as do agente): tocam sem esperar a rede
    const s = new VoiceSession(createBrowserDeps(p, () => termsFn.current?.() ?? []), {
      onState: (s) => { setState(s); if (s === "listening") listeningFn.current?.(); },
      onError: setError,
      onLevel: (l) => setLevel(Math.min(1, l * 8)),
      onHandsFree: setHandsFreeState,
      onUtterance: (u, api) => onUtt.current(u, api),
      onUnclear: (t, c) => unclearFn.current?.(t, c),
      onLatency: (s) => { setLatency(s); latencyFn.current?.(s); },
      onDiag: setDiag,
    });
    session.current = s;
    return () => { s.destroy(); session.current = null; };
  }, []);

  const start = useCallback(() => session.current?.start(), []);
  const stop = useCallback(() => session.current?.stop(), []);
  const cancel = useCallback(() => session.current?.cancel(), []);
  const setHandsFree = useCallback((on: boolean) => session.current?.setHandsFree(on), []);
  const speak = useCallback((text: string) => player.current?.speak(text), []);
  const enqueue = useCallback((chunk: string, nextText?: string) => player.current?.enqueue(chunk, { nextText }), []);
  const mark = useCallback((name: Mark) => session.current?.mark(name), []);
  const beginTurn = useCallback(() => { setLatency(null); session.current?.beginTurn(); }, []);
  const turnDone = useCallback(() => session.current?.turnDone(), []);
  const turnEnded = useCallback(() => session.current?.turnEnded(), []);
  const stopSpeaking = useCallback(() => session.current?.stopSpeaking(), []);

  return { state, error, errorMessage: error ? MESSAGES[error] : null, level, handsFree: handsFreeState, latency, diag, start, stop, cancel, setHandsFree, speak, enqueue, mark, beginTurn, turnDone, turnEnded, stopSpeaking };
}
