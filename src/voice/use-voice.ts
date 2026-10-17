"use client";
// Hook do microfone (clicar para falar, clicar para parar). Grava UMA fala, manda ao /api/voice/stt e
// devolve texto + sinais. Quem decide o que fazer com o texto é o fluxo (Hyago); aqui não há regra de negócio.
import { useCallback, useEffect, useRef, useState } from "react";
import { SpeechPlayer } from "./player";
import { computeSignals, type VoiceSignals } from "./signals";
import { pickMimeType, rms, VoiceActivityTracker } from "./vad";

export type VoiceState = "idle" | "listening" | "transcribing" | "speaking" | "error";
export type VoiceErrorCode = "unsupported" | "permission_denied" | "too_short" | "no_speech" | "stt_failed" | "stt_unavailable";

export interface Utterance {
  texto: string;
  sinais: VoiceSignals;
  confianca?: number;
  injecao: boolean;
  redacoes: string[];
}

const MESSAGES: Record<VoiceErrorCode, string> = {
  unsupported: "Este navegador não grava áudio. Use o texto ou o Chrome.",
  permission_denied: "Microfone bloqueado. Libere o acesso ou use o texto.",
  too_short: "Fala muito curta. Tente de novo.",
  no_speech: "Não ouvi nada. Chegue mais perto do microfone.",
  stt_failed: "Não consegui reconhecer a fala. Pode repetir ou digitar?",
  stt_unavailable: "Reconhecimento de voz indisponível. Seguindo em texto.",
};

export interface VoiceApi {
  speak: (text: string) => unknown;
}

// O callback recebe a fala reconhecida e uma API para responder falando (evita ref circular na tela).
export function useVoice(onUtterance: (u: Utterance, api: VoiceApi) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const player = useRef<SpeechPlayer | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const vad = useRef<VoiceActivityTracker | null>(null);
  const meta = useRef({ micOpenedAt: 0, interrupted: false, mime: "audio/webm" });
  const cleanupFns = useRef<Array<() => void>>([]);
  const onUtt = useRef(onUtterance);
  useEffect(() => { onUtt.current = onUtterance; }, [onUtterance]);

  useEffect(() => {
    player.current = new SpeechPlayer(setSpeaking);
    return () => { player.current?.stop(); cleanupFns.current.forEach((f) => f()); };
  }, []);

  const fail = useCallback((code: VoiceErrorCode) => { setError(code); setState("error"); }, []);

  const start = useCallback(async () => {
    if (state === "listening" || state === "transcribing") return;
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return fail("unsupported");
    // INTERRUPÇÃO: se o agente está falando, corta a fala e registra que houve interrupção.
    meta.current.interrupted = player.current?.stop() ?? false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return fail("permission_denied");
    }
    const mime = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    meta.current.mime = (recorder.mimeType || mime || "audio/webm").split(";")[0];
    chunks.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };

    // Medidor de nível: alimenta o indicador na tela e os sinais (início e fim da fala).
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const tracker = new VoiceActivityTracker();
    vad.current = tracker;
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const l = rms(buf);
      tracker.push(l, performance.now());
      setLevel(Math.min(1, l * 8));
    }, 50);
    cleanupFns.current.push(() => { window.clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); void ctx.close(); });

    recorder.onstop = async () => {
      cleanupFns.current.forEach((f) => f()); cleanupFns.current = []; setLevel(0);
      const blob = new Blob(chunks.current, { type: meta.current.mime });
      if (blob.size < 800) return fail("too_short");
      if (!tracker.heardSpeech) return fail("no_speech");
      setState("transcribing");
      try {
        const res = await fetch("/api/voice/stt", { method: "POST", headers: { "Content-Type": meta.current.mime }, body: blob });
        if (res.status === 503) return fail("stt_unavailable");
        if (!res.ok) return fail("stt_failed");
        const data = (await res.json()) as { texto: string; confianca?: number; injecao: boolean; redacoes: string[] };
        const sinais = computeSignals({ transcript: data.texto, micOpenedAt: meta.current.micOpenedAt, firstWordAt: tracker.firstWordAt, lastWordAt: tracker.lastWordAt, interrupted: meta.current.interrupted });
        setState("idle");
        onUtt.current({ texto: data.texto, sinais, confianca: data.confianca, injecao: data.injecao, redacoes: data.redacoes }, { speak: (t) => player.current?.speak(t) });
      } catch {
        fail("stt_failed");
      }
    };
    rec.current = recorder;
    meta.current.micOpenedAt = performance.now();
    recorder.start();
    setState("listening");
  }, [state, fail]);

  const stop = useCallback(() => { if (rec.current?.state === "recording") rec.current.stop(); }, []);
  const speak = useCallback((text: string) => player.current?.speak(text), []);
  const stopSpeaking = useCallback(() => player.current?.stop(), []);

  return { state: speaking && state === "idle" ? "speaking" : state, error, errorMessage: error ? MESSAGES[error] : null, level, start, stop, speak, stopSpeaking };
}
