"use client";
// Player de fala por PEDAÇOS. O backend manda a resposta em fragmentos; aqui cada fragmento vira áudio
// (ElevenLabs via /api/voice/tts) e toca em ordem. O áudio do PRÓXIMO pedaço já está sendo buscado enquanto o
// atual toca, então não há pausa entre eles. Interromper cancela tudo: o que toca, o que carrega e o que espera.
// Se a rota de voz falhar num pedaço, ele é falado pela voz do navegador. O texto sempre existe.
import { splitSpeechChunks } from "./chunker";

export interface AudioLike {
  play(): Promise<void>;
  pause(): void;
  onended: (() => void) | null;
  onerror: (() => void) | null;
}

export interface PlayerDeps {
  fetchImpl?: typeof fetch;
  createAudio?: (url: string) => AudioLike;
  speakFallback?: (text: string) => Promise<void>;
}

export interface PlayerHooks {
  onTtsResponse?: () => void; // a rota de voz respondeu ao primeiro pedaço do turno
  onAudioStart?: () => void; // o primeiro áudio do turno começou a tocar
}

interface Item {
  text: string;
  blob: Promise<Blob | null>;
}

function browserVoice(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export class SpeechPlayer {
  speaking = false;
  private gen = 0; // cada stop() invalida tudo que estava em andamento
  private queue: Item[] = [];
  private running = false;
  private ctrl?: AbortController;
  private audio?: AudioLike;
  private url?: string;
  private cancelPlay?: () => void;
  private lastText?: string;
  private reportedResponse = false;
  private reportedAudio = false;
  private idleWaiters: Array<() => void> = [];

  constructor(private onChange?: (speaking: boolean) => void, private hooks: PlayerHooks = {}, private deps: PlayerDeps = {}) {}

  private set(speaking: boolean) {
    if (this.speaking !== speaking) {
      this.speaking = speaking;
      this.onChange?.(speaking);
    }
  }

  private fetchBlob(text: string, previousText: string | undefined, nextText: string | undefined, signal: AbortSignal): Promise<Blob | null> {
    const doFetch = this.deps.fetchImpl ?? fetch;
    return doFetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(previousText ? { previousText } : {}), ...(nextText ? { nextText } : {}) }),
      signal,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        if (!this.reportedResponse) {
          this.reportedResponse = true;
          this.hooks.onTtsResponse?.();
        }
        return await res.blob();
      })
      .catch(() => null);
  }

  // Coloca um pedaço na fila. O áudio dele começa a ser buscado AGORA, sem esperar a vez.
  enqueue(text: string, opts: { nextText?: string } = {}): void {
    const t = text.trim();
    if (!t) return;
    this.ctrl ??= new AbortController();
    this.queue.push({ text: t, blob: this.fetchBlob(t, this.lastText, opts.nextText, this.ctrl.signal) });
    this.lastText = t;
    void this.run();
  }

  // Atalho: divide um texto inteiro em pedaços e enfileira todos. Resolve quando termina ou é interrompido.
  speak(text: string): Promise<void> {
    const chunks = splitSpeechChunks(text);
    chunks.forEach((c, i) => this.enqueue(c, { nextText: chunks[i + 1] }));
    return this.whenIdle();
  }

  whenIdle(): Promise<void> {
    return this.speaking || this.running ? new Promise((resolve) => this.idleWaiters.push(resolve)) : Promise.resolve();
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const gen = this.gen;
    this.set(true);
    try {
      while (this.queue.length > 0 && gen === this.gen) {
        const item = this.queue.shift()!;
        const blob = await item.blob;
        if (gen !== this.gen) break;
        if (blob) await this.playBlob(blob, gen);
        else await (this.deps.speakFallback ?? browserVoice)(item.text);
      }
    } finally {
      if (gen === this.gen) {
        this.running = false;
        this.reset();
        this.set(false);
        this.flushWaiters();
      }
    }
  }

  private playBlob(blob: Blob, gen: number): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      this.url = url;
      const audio = this.deps.createAudio ? this.deps.createAudio(url) : (new Audio(url) as AudioLike);
      this.audio = audio;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        URL.revokeObjectURL(url);
        if (this.url === url) this.url = undefined;
        this.cancelPlay = undefined;
        resolve();
      };
      this.cancelPlay = done;
      audio.onended = done;
      audio.onerror = done;
      audio.play().then(() => {
        if (gen === this.gen && !this.reportedAudio) {
          this.reportedAudio = true;
          this.hooks.onAudioStart?.();
        }
      }, done);
    });
  }

  // INTERRUPÇÃO: corta o que toca, aborta o que carrega e esvazia a fila. Devolve se estava falando.
  stop(): boolean {
    const was = this.speaking || this.running;
    this.gen++;
    this.ctrl?.abort();
    this.audio?.pause();
    this.cancelPlay?.();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    this.queue = [];
    this.running = false;
    this.reset();
    this.set(false);
    this.flushWaiters();
    return was;
  }

  private reset() {
    this.ctrl = undefined;
    this.audio = undefined;
    this.lastText = undefined;
    this.reportedResponse = false;
    this.reportedAudio = false;
  }

  private flushWaiters() {
    const w = this.idleWaiters;
    this.idleWaiters = [];
    w.forEach((r) => r());
  }
}
