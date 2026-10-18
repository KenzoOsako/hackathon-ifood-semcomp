"use client";
// Casca fina de React em volta da VoiceSession (session.ts). Toda a lógica (gravar, fim de fala, interrupção,
// modo sem as mãos) está na sessão e é testada com peças falsas; aqui só se liga o React e o navegador.
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserDeps } from "./browser-deps";
import type { LatencySummary, Mark } from "./latency";
import { SpeechPlayer } from "./player";
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
  useEffect(() => { onUtt.current = onUtterance; termsFn.current = options.getTerms; }, [onUtterance, options.getTerms]);

  useEffect(() => {
    const p = new SpeechPlayer(undefined, {
      onTtsResponse: () => session.current?.ttsResponded(),
      onAudioStart: () => session.current?.speakingStarted(),
    });
    player.current = p;
    const s = new VoiceSession(createBrowserDeps(p, () => termsFn.current?.() ?? []), {
      onState: setState,
      onError: setError,
      onLevel: (l) => setLevel(Math.min(1, l * 8)),
      onHandsFree: setHandsFreeState,
      onUtterance: (u, api) => onUtt.current(u, api),
      onLatency: setLatency,
      onDiag: setDiag,
    });
    session.current = s;
    return () => { s.destroy(); session.current = null; };
  }, []);

  const start = useCallback(() => session.current?.start(), []);
  const stop = useCallback(() => session.current?.stop(), []);
  const setHandsFree = useCallback((on: boolean) => session.current?.setHandsFree(on), []);
  const speak = useCallback((text: string) => player.current?.speak(text), []);
  const enqueue = useCallback((chunk: string, nextText?: string) => player.current?.enqueue(chunk, { nextText }), []);
  const mark = useCallback((name: Mark) => session.current?.mark(name), []);
  const beginTurn = useCallback(() => { setLatency(null); session.current?.beginTurn(); }, []);
  const turnDone = useCallback(() => session.current?.turnDone(), []);
  const stopSpeaking = useCallback(() => session.current?.stopSpeaking(), []);

  return { state, error, errorMessage: error ? MESSAGES[error] : null, level, handsFree: handsFreeState, latency, diag, start, stop, setHandsFree, speak, enqueue, mark, beginTurn, turnDone, stopSpeaking };
}
