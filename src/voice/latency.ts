// Medida do tempo de um turno, para a gente SABER onde está a pausa (e não chutar).
// Marcos, em ordem: mic_stop → stt_done → request_sent → (first_sound: qualquer áudio, inclusive a frase de espera)
// → first_chunk → tts_first_byte → audio_start (primeira palavra ÚTIL, depois da resposta do agente).
export type Mark = "mic_stop" | "stt_done" | "request_sent" | "first_chunk" | "tts_first_byte" | "first_sound" | "audio_start";

export interface LatencySummary {
  sttMs?: number; // fim da gravação até o texto
  backendFirstChunkMs?: number; // pedido enviado até o primeiro pedaço de fala (cérebro + MCP)
  firstSoundMs?: number; // fim da fala do usuário até QUALQUER som do Guide (a frase de espera conta): o que a pessoa sente de primeira
  ttsFirstByteMs?: number; // pedaço recebido até o primeiro byte de áudio
  timeToFirstAudioMs?: number; // fim da fala do usuário até a primeira palavra ÚTIL do Guide (a resposta do agente, não a espera)
}

export class LatencyTrace {
  private readonly t = new Map<Mark, number>();

  has(name: Mark): boolean {
    return this.t.has(name);
  }

  mark(name: Mark, at: number = performance.now()): void {
    if (!this.t.has(name)) this.t.set(name, at); // só o primeiro marco de cada tipo
  }

  private span(a: Mark, b: Mark): number | undefined {
    const x = this.t.get(a);
    const y = this.t.get(b);
    return x === undefined || y === undefined || y < x ? undefined : Math.round(y - x);
  }

  summary(): LatencySummary {
    return {
      sttMs: this.span("mic_stop", "stt_done"),
      backendFirstChunkMs: this.span("request_sent", "first_chunk"),
      firstSoundMs: this.span("mic_stop", "first_sound") ?? this.span("request_sent", "first_sound"),
      ttsFirstByteMs: this.span("first_chunk", "tts_first_byte"),
      timeToFirstAudioMs: this.span("mic_stop", "audio_start") ?? this.span("request_sent", "audio_start"),
    };
  }
}

// Metas (orçamento de latência). São alvos para medir, não promessas.
export const LATENCY_TARGETS = { sttMs: 600, firstSoundMs: 1200, backendFirstChunkMs: 700, ttsFirstByteMs: 450, timeToFirstAudioMs: 1800 } as const;

export function overBudget(s: LatencySummary): Array<keyof LatencySummary> {
  return (Object.keys(LATENCY_TARGETS) as Array<keyof typeof LATENCY_TARGETS>).filter((k) => (s[k] ?? 0) > LATENCY_TARGETS[k]);
}

// Rodadas medidas na tela de laboratório → p50/p95 por etapa (docs/PLANO_INTEGRACAO_VOZ_AGENTE.md, Fase 2).
export type LatencyMetric = keyof LatencySummary;
export interface MetricStats { n: number; p50: number; p95: number; max: number }

// Percentil por interpolação linear entre os vizinhos (com poucas rodadas, p95 fica perto do máximo).
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const v = [...values].sort((a, b) => a - b);
  const pos = (v.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

// `skipFirst`: a 1ª rodada paga o aquecimento (compilação, conexão fria) e distorce a medida.
export function summarizeRounds(rounds: LatencySummary[], opts: { skipFirst?: boolean } = {}): Partial<Record<LatencyMetric, MetricStats>> {
  const used = opts.skipFirst ? rounds.slice(1) : rounds;
  const out: Partial<Record<LatencyMetric, MetricStats>> = {};
  for (const k of Object.keys(LATENCY_TARGETS) as LatencyMetric[]) {
    const vals = used.map((r) => r[k]).filter((x): x is number => typeof x === "number");
    if (vals.length) out[k] = { n: vals.length, p50: Math.round(percentile(vals, 0.5)), p95: Math.round(percentile(vals, 0.95)), max: Math.max(...vals) };
  }
  return out;
}
