// Máquina de estados do microfone e da conversa por voz. SEM React e SEM APIs do navegador diretas: tudo entra por
// `SessionDeps`, para dar para testar com microfone, gravador e relógio falsos. O hook do React e o navegador só
// ligam as peças reais (browser-deps.ts, use-voice.ts).
//
// Dois modos:
//  - Manual: Falar / Parar (a pessoa decide quando termina).
//  - Sem as mãos: o Guide abre o microfone, PARA sozinho depois de um silêncio, reconhece, responde falando e
//    abre de novo. Falar por cima do Guide (voz sustentada) interrompe a fala.
import { LIMIARES_CONFIANCA } from "@/agent/frases";
import { BargeInDetector, EndpointDetector, NoiseFloor, DEFAULT_ENDPOINT, type EndpointOptions } from "./endpoint";
import { LatencyTrace, type LatencySummary, type Mark } from "./latency";
import { UNCLEAR_PHRASE } from "./phrases";
import { computeSignals, type VoiceSignals } from "./signals";
import { VoiceActivityTracker } from "./vad";

export type VoiceState = "idle" | "listening" | "transcribing" | "speaking" | "error";
export type VoiceErrorCode = "unsupported" | "permission_denied" | "too_short" | "no_speech" | "stt_failed" | "stt_unavailable" | "rate_limited";

export interface Utterance {
  texto: string;
  sinais: VoiceSignals;
  confianca?: number;
  injecao: boolean;
  redacoes: string[];
}

export interface VoiceApi {
  speak: (text: string) => Promise<void> | undefined;
  enqueue: (chunk: string, nextText?: string) => void;
  mark: (name: Mark) => void;
  // A resposta terminou SEM fala (erro, só texto): libera o microfone no modo sem as mãos.
  turnDone: () => void;
}

export interface MeterLike { read(): number; close(): void; state?(): string }
export interface StreamLike { stop(): void }
export interface RecorderLike {
  mimeType: string;
  onData: ((b: Blob) => void) | null;
  onStop: (() => void) | null;
  start(): void;
  stop(): void;
}
export interface PlayerLike {
  speaking: boolean;
  stop(): boolean;
  speak(text: string): Promise<void>;
  enqueue(text: string, opts?: { nextText?: string }): void;
}

export interface SessionDeps {
  supported(): boolean;
  openMic(): Promise<{ stream: StreamLike; meter: MeterLike }>; // lança se a permissão for negada
  createRecorder(stream: StreamLike): RecorderLike;
  fetchImpl: typeof fetch;
  now(): number;
  every(fn: () => void, ms: number): () => void;
  after(fn: () => void, ms: number): () => void;
  player: PlayerLike;
  getTerms?(): string[];
  warm?(): void;
  endpoint?: EndpointOptions;
}

// Diagnóstico para a tela: o que o microfone está entregando de verdade.
export interface VoiceDiag {
  level?: number; // nível atual (RMS)
  floor?: number; // ruído de fundo estimado
  threshold?: number; // limite de voz em uso
  blobBytes?: number; // tamanho do último áudio enviado
  mime?: string;
  sttStatus?: number | "rede";
  sttMs?: number;
  heardSpeech?: boolean; // o medidor local achou que houve fala
}

export interface SessionEvents {
  onDiag?(d: VoiceDiag): void;
  onState(s: VoiceState): void;
  onError(code: VoiceErrorCode | null): void;
  onLevel(level: number): void;
  onHandsFree(on: boolean): void;
  onUtterance(u: Utterance, api: VoiceApi): void;
  onLatency?(s: LatencySummary): void;
  // Reconhecimento incerto: a fala NÃO foi ao agente; o Guide pede para repetir. A tela pode mostrar o que ouviu.
  onUnclear?(texto: string, confianca: number): void;
}

// Abaixo disso o texto é duvidoso demais para virar busca e a voz pede para repetir sem chamar o backend. O limiar vem do
// contrato com o agente (src/agent/frases.ts); entre este e `confirmar` quem trata é o agente. Calibrar com gravações reais.
export const LOW_CONFIDENCE = LIMIARES_CONFIANCA.repetir;
export { UNCLEAR_PHRASE };

const TICK_MS = 50;
const COOLDOWN_AFTER_SPEECH_MS = 500; // não reabre o microfone na cauda da fala do Guide (eco)
const MAX_SILENT_ROUNDS = 3; // tentativas seguidas sem fala antes de desligar o modo sem as mãos
const REPLY_TIMEOUT_MS = 15_000; // esperando a resposta do agente; passado isso, volta a ouvir

export class VoiceSession {
  state: VoiceState = "idle";
  handsFree = false;
  trace = new LatencyTrace();

  private mic?: { stream: StreamLike; meter: MeterLike };
  private cancelTick?: () => void;
  private cancelRestart?: () => void;
  private recorder?: RecorderLike;
  private chunks: Blob[] = [];
  private tracker?: VoiceActivityTracker;
  private endpoint?: EndpointDetector;
  private readonly barge = new BargeInDetector();
  private readonly noise = new NoiseFloor();
  private diag: VoiceDiag = {};
  private micOpenedAt = 0;
  private interrupted = false;
  private cooldownUntil = 0;
  private silentRounds = 0;
  private unclearRounds = 0;
  private wasSpeaking = false;
  private finalizing = false;
  private destroyed = false;
  private awaitingReply = false; // entregou a fala e espera o agente responder: o microfone NÃO reabre ainda
  private cancelReplyTimeout?: () => void;

  constructor(private readonly d: SessionDeps, private readonly ev: SessionEvents) {}

  // ---------- API pública ----------

  async start(): Promise<void> {
    if (this.state === "listening" || this.state === "transcribing") return;
    await this.beginListening(false);
  }

  stop(): void {
    if (this.state === "listening") this.finalize();
  }

  // Descarta o que está sendo gravado, sem enviar. No modo sem as mãos o microfone reabre logo em seguida.
  cancel(): void {
    if (this.state !== "listening") return;
    this.cancelListening();
    this.ev.onError(null);
    if (this.handsFree) this.cooldownUntil = this.d.now() + 300;
    else this.releaseMic();
  }

  async setHandsFree(on: boolean): Promise<void> {
    if (on === this.handsFree) return;
    this.handsFree = on;
    this.ev.onHandsFree(on);
    this.silentRounds = 0;
    if (on) {
      if (this.state === "idle" || this.state === "error") await this.beginListening(false);
    } else {
      if (this.state === "listening") this.cancelListening();
      if (this.state !== "transcribing") this.releaseMic();
    }
  }

  stopSpeaking(): void {
    this.d.player.stop();
  }

  mark(name: Mark): void {
    this.trace.mark(name, this.d.now());
  }

  beginTurn(): void {
    this.trace = new LatencyTrace();
    this.d.warm?.();
  }

  speakingStarted(): void {
    this.trace.mark("audio_start", this.d.now());
    this.ev.onLatency?.(this.trace.summary());
  }

  ttsResponded(): void {
    this.trace.mark("tts_first_byte", this.d.now());
  }

  destroy(): void {
    this.destroyed = true;
    this.clearAwait();
    this.cancelListening();
    this.releaseMic();
    this.d.player.stop();
  }

  // ---------- internos ----------

  private awaitReply() {
    this.clearAwait();
    this.awaitingReply = true;
    this.cancelReplyTimeout = this.d.after(() => { this.awaitingReply = false; this.cancelReplyTimeout = undefined; }, REPLY_TIMEOUT_MS);
  }

  private clearAwait() {
    this.awaitingReply = false;
    this.cancelReplyTimeout?.();
    this.cancelReplyTimeout = undefined;
  }

  turnDone(): void {
    this.clearAwait();
    this.cooldownUntil = this.d.now() + 300;
  }

  private setState(s: VoiceState) {
    if (this.state !== s) {
      this.state = s;
      this.ev.onState(s);
    }
  }

  private fail(code: VoiceErrorCode) {
    this.ev.onError(code);
    this.setState("error");
  }

  private async ensureMic(): Promise<boolean> {
    if (this.mic) return true;
    if (!this.d.supported()) { this.fail("unsupported"); return false; }
    try {
      this.mic = await this.d.openMic();
    } catch {
      this.handsFree = false;
      this.ev.onHandsFree(false);
      this.fail("permission_denied");
      return false;
    }
    if (this.destroyed) { this.releaseMic(); return false; }
    this.cancelTick = this.d.every(() => this.tick(), TICK_MS);
    return true;
  }

  private releaseMic() {
    this.cancelTick?.();
    this.cancelTick = undefined;
    this.cancelRestart?.();
    this.cancelRestart = undefined;
    this.mic?.stream.stop();
    this.mic?.meter.close();
    this.mic = undefined;
    this.ev.onLevel(0);
  }

  private async beginListening(viaBargeIn: boolean): Promise<void> {
    this.ev.onError(null);
    this.trace = new LatencyTrace();
    this.d.warm?.();
    if (!(await this.ensureMic())) return;
    // INTERRUPÇÃO: se o Guide está falando, corta a fala e registra que houve interrupção.
    this.interrupted = this.d.player.stop() || viaBargeIn;
    this.clearAwait();
    const t = this.d.now();
    this.chunks = [];
    this.tracker = new VoiceActivityTracker();
    this.endpoint = new EndpointDetector(t, this.d.endpoint ?? DEFAULT_ENDPOINT);
    this.barge.reset();
    this.finalizing = false;
    const rec = this.d.createRecorder(this.mic!.stream);
    rec.onData = (b) => { if (b.size > 0) this.chunks.push(b); };
    rec.onStop = () => void this.afterRecording(rec.mimeType);
    this.recorder = rec;
    this.micOpenedAt = t;
    rec.start();
    this.setState("listening");
  }

  private cancelListening() {
    const rec = this.recorder;
    this.recorder = undefined;
    this.finalizing = true; // descarta o que foi gravado
    if (rec) { rec.onStop = null; rec.onData = null; try { rec.stop(); } catch { /* já parado */ } }
    if (this.state === "listening") this.setState("idle");
  }

  private handleListeningTick(level: number, t: number, thr: number) {
    this.tracker?.push(level, t, thr);
    const decision = this.endpoint!.feed(level, t, thr);
    if (decision === "max") {
      this.finalize();
      return;
    }
    // Fim de fala por silêncio e desistência por falta de fala só valem no modo sem as mãos;
    // no manual, quem decide é a pessoa.
    if (!this.handsFree) return;
    if (decision === "end") this.finalize();
    else if (decision === "no_speech") this.onSilentRound();
  }

  private syncSpeakingState(speaking: boolean, t: number) {
    if (speaking !== this.wasSpeaking) {
      this.wasSpeaking = speaking;
      if (!speaking) {
        this.cooldownUntil = t + COOLDOWN_AFTER_SPEECH_MS;
        this.clearAwait();
      }
    }
  }

  private tick() {
    if (!this.mic || this.destroyed) return;
    const t = this.d.now();
    const level = this.mic.meter.read();
    this.ev.onLevel(level);
    // Ruído de fundo: só aprende quando ninguém está falando (nem o usuário, nem o Guide).
    const speaking = this.d.player.speaking;
    if (!speaking) this.noise.push(level);
    const thr = this.noise.speechThreshold();
    this.diag = { ...this.diag, level, floor: this.noise.floor, threshold: thr };
    this.ev.onDiag?.(this.diag);

    this.syncSpeakingState(speaking, t);

    if (this.state === "listening") {
      this.handleListeningTick(level, t, thr);
      return;
    }

    if (this.state === "idle" && speaking) this.setState("speaking");
    if (this.state === "speaking" && !speaking) this.setState("idle");

    if (!this.handsFree) return;
    if (this.state === "speaking") {
      if (this.barge.feed(level, t, this.noise.bargeInThreshold())) void this.beginListening(true);
    } else if (this.state === "idle" && t >= this.cooldownUntil && !speaking && !this.awaitingReply) {
      void this.beginListening(false);
    }
  }

  private onSilentRound() {
    this.cancelListening();
    this.silentRounds++;
    if (this.silentRounds >= MAX_SILENT_ROUNDS) {
      void this.setHandsFree(false).then(() => this.fail("no_speech"));
    } else {
      this.cooldownUntil = this.d.now() + 300; // reabre logo em seguida, sem alarde
    }
  }

  private finalize() {
    if (this.finalizing || !this.recorder) return;
    this.finalizing = true;
    this.trace.mark("mic_stop", this.d.now());
    this.recorder.stop();
  }

  private async afterRecording(mimeType: string) {
    this.recorder = undefined;
    const mime = (mimeType || "audio/webm").split(";")[0];
    const blob = new Blob(this.chunks, { type: mime });
    if (!this.handsFree) this.releaseMic();
    this.diag = { ...this.diag, blobBytes: blob.size, mime, heardSpeech: !!this.tracker?.heardSpeech };
    this.ev.onDiag?.(this.diag);
    if (blob.size < 800) return this.afterEmpty("too_short");
    // No modo sem as mãos o medidor local decide se vale gravar; no MANUAL o áudio SEMPRE vai ao reconhecimento
    // (microfones fracos ficam abaixo do limite local mesmo com a pessoa falando alto).
    if (this.handsFree && !this.tracker?.heardSpeech) return this.afterEmpty("no_speech");
    this.silentRounds = 0;
    this.setState("transcribing");
    try {
      const terms = this.d.getTerms?.() ?? [];
      const query = terms.length ? `?terms=${encodeURIComponent(JSON.stringify(terms.slice(0, 40)))}` : "";
      const sttStart = this.d.now();
      const res = await this.d.fetchImpl(`/api/voice/stt${query}`, { method: "POST", headers: { "Content-Type": mime }, body: blob });
      this.diag = { ...this.diag, sttStatus: res.status, sttMs: Math.round(this.d.now() - sttStart) };
      this.ev.onDiag?.(this.diag);
      if (res.status === 429) return this.afterFailure("rate_limited");
      if (res.status === 503) return this.afterFailure("stt_unavailable");
      if (res.status === 422) return this.afterEmpty("no_speech");
      if (!res.ok) return this.afterFailure("stt_failed");
      const data = (await res.json()) as { texto: string; confianca?: number; injecao: boolean; redacoes: string[] };
      this.trace.mark("stt_done", this.d.now());
      if (data.confianca !== undefined && data.confianca < LOW_CONFIDENCE) return this.afterUnclear(data.texto, data.confianca);
      this.unclearRounds = 0;
      const sinais = computeSignals({ transcript: data.texto, micOpenedAt: this.micOpenedAt, firstWordAt: this.tracker?.firstWordAt, lastWordAt: this.tracker?.lastWordAt, interrupted: this.interrupted, confianca: data.confianca, injecao: data.injecao });
      this.setState("idle");
      if (this.handsFree) this.awaitReply();
      const player = this.d.player;
      this.ev.onUtterance(
        { texto: data.texto, sinais, confianca: data.confianca, injecao: data.injecao, redacoes: data.redacoes },
        { speak: (t) => player.speak(t), enqueue: (c, n) => player.enqueue(c, { nextText: n }), mark: (m) => this.mark(m), turnDone: () => this.turnDone() },
      );
    } catch {
      this.diag = { ...this.diag, sttStatus: "rede" };
      this.ev.onDiag?.(this.diag);
      this.afterFailure("stt_failed");
    }
  }

  // Texto duvidoso: não vai ao agente. O Guide pede para repetir; depois de 3 seguidas, desiste e avisa (sem laço infinito).
  private afterUnclear(texto: string, confianca: number) {
    this.setState("idle");
    this.unclearRounds++;
    if (this.unclearRounds >= MAX_SILENT_ROUNDS) { this.unclearRounds = 0; return this.afterFailure("stt_failed"); }
    this.ev.onUnclear?.(texto, confianca);
    this.d.player.enqueue(UNCLEAR_PHRASE);
  }

  // Sem fala ou áudio curto: no modo sem as mãos reabre quieto; no manual, avisa.
  private afterEmpty(code: "too_short" | "no_speech") {
    if (this.handsFree) return this.onSilentRound();
    this.fail(code);
  }

  // Falha do reconhecimento: pausa o modo sem as mãos (não fica tentando em laço) e avisa.
  private afterFailure(code: VoiceErrorCode) {
    this.clearAwait();
    if (this.handsFree) { this.handsFree = false; this.ev.onHandsFree(false); this.releaseMic(); }
    this.fail(code);
  }
}
