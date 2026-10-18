// Medida do tempo de um turno, para a gente SABER onde está a pausa (e não chutar).
// Marcos, em ordem: mic_stop → stt_done → request_sent → first_chunk → tts_first_byte → audio_start.
export type Mark = "mic_stop" | "stt_done" | "request_sent" | "first_chunk" | "tts_first_byte" | "audio_start";

export interface LatencySummary {
  sttMs?: number; // fim da gravação até o texto
  backendFirstChunkMs?: number; // pedido enviado até o primeiro pedaço de fala (cérebro + MCP)
  ttsFirstByteMs?: number; // pedaço recebido até o primeiro byte de áudio
  timeToFirstAudioMs?: number; // fim da fala do usuário até a primeira palavra do Guide: o que a pessoa SENTE
}

export class LatencyTrace {
  private readonly t = new Map<Mark, number>();

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
      ttsFirstByteMs: this.span("first_chunk", "tts_first_byte"),
      timeToFirstAudioMs: this.span("mic_stop", "audio_start") ?? this.span("request_sent", "audio_start"),
    };
  }
}

// Metas (orçamento de latência). São alvos para medir, não promessas.
export const LATENCY_TARGETS = { sttMs: 600, backendFirstChunkMs: 700, ttsFirstByteMs: 450, timeToFirstAudioMs: 1800 } as const;

export function overBudget(s: LatencySummary): Array<keyof LatencySummary> {
  return (Object.keys(LATENCY_TARGETS) as Array<keyof typeof LATENCY_TARGETS>).filter((k) => (s[k] ?? 0) > LATENCY_TARGETS[k]);
}
