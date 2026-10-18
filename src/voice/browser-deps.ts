"use client";
// Peças REAIS do navegador para a VoiceSession: microfone, gravador, medidor de nível, relógio e rede.
// Sem lógica aqui: a lógica está em session.ts (testada com peças falsas). Isto aqui só foi verificado
// por tipo, lint e build; o comportamento com microfone real precisa de teste humano em Chrome.
import type { SessionDeps, PlayerLike, RecorderLike, StreamLike } from "./session";
import { pickMimeType, rms } from "./vad";
import type { EndpointOptions } from "./endpoint";

interface BrowserStream extends StreamLike {
  media: MediaStream;
}

export function createBrowserDeps(player: PlayerLike, getTerms?: () => string[], endpoint?: EndpointOptions): SessionDeps {
  return {
    supported: () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia,

    async openMic() {
      // Cancelamento de eco ligado: o Guide fala no mesmo alto-falante e o navegador subtrai a própria voz.
      // Ganho automático DESLIGADO: ele amplifica o ruído nas pausas e atrapalha o detector de fim de fala.
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      const ctx = new AudioContext();
      // O Chrome pode criar o contexto SUSPENSO; suspenso, o medidor devolve zero para sempre.
      if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(media).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const stream: BrowserStream = { media, stop: () => media.getTracks().forEach((t) => t.stop()) };
      return {
        stream,
        meter: {
          read: () => {
            analyser.getFloatTimeDomainData(buf);
            return rms(buf);
          },
          close: () => void ctx.close(),
          state: () => ctx.state,
        },
      };
    },

    createRecorder(stream): RecorderLike {
      const media = (stream as BrowserStream).media;
      const mime = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      const wrapper: RecorderLike = {
        mimeType: rec.mimeType || mime || "audio/webm",
        onData: null,
        onStop: null,
        start: () => rec.start(),
        stop: () => rec.stop(),
      };
      rec.ondataavailable = (e) => wrapper.onData?.(e.data);
      rec.onstop = () => wrapper.onStop?.();
      return wrapper;
    },

    fetchImpl: (input, init) => fetch(input, init),
    now: () => performance.now(),
    every: (fn, ms) => {
      const id = window.setInterval(fn, ms);
      return () => window.clearInterval(id);
    },
    after: (fn, ms) => {
      const id = window.setTimeout(fn, ms);
      return () => window.clearTimeout(id);
    },
    player,
    getTerms,
    warm: () => void fetch("/api/voice/warm", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined),
    endpoint,
  };
}
