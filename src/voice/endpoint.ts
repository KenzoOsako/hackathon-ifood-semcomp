// Detectores de fim de fala e de interrupção, por nível de energia. Puros: o tempo entra como parâmetro.
// Os valores padrão são PONTOS DE PARTIDA a ajustar no teste humano (voz baixa, ruído de sala, fala pausada).

export interface EndpointOptions {
  threshold: number; // nível RMS a partir do qual há voz
  silenceMs: number; // silêncio que encerra uma fala normal
  shortSilenceMs: number; // silêncio que encerra uma fala curta ("sim", "pode"): responde mais rápido
  shortSpeechMs: number; // até esta duração a fala é considerada curta
  minSpeechMs: number; // voz precisa durar isso para contar como fala (ignora estalos)
  noSpeechMs: number; // ninguém falou: desiste
  maxMs: number; // trava de segurança: nenhuma gravação passa disso
}

export const DEFAULT_ENDPOINT: EndpointOptions = {
  threshold: 0.02,
  silenceMs: 1300,
  shortSilenceMs: 900,
  shortSpeechMs: 1500,
  minSpeechMs: 250,
  noSpeechMs: 7000,
  maxMs: 30_000,
};

export type EndDecision = "continue" | "end" | "no_speech" | "max";

export class EndpointDetector {
  private runStart?: number;
  private speechStart?: number;
  private lastVoiced?: number;

  constructor(private readonly startAt: number, private readonly o: EndpointOptions = DEFAULT_ENDPOINT) {}

  get heardSpeech(): boolean {
    return this.speechStart !== undefined;
  }

  // `threshold` opcional: o limite adaptativo (ruído de fundo) vence o fixo.
  feed(level: number, t: number, threshold: number = this.o.threshold): EndDecision {
    if (t - this.startAt >= this.o.maxMs) return "max";
    if (level >= threshold) {
      this.runStart ??= t;
      if (t - this.runStart >= this.o.minSpeechMs) {
        this.speechStart ??= this.runStart;
        this.lastVoiced = t;
      }
    } else {
      this.runStart = undefined;
    }
    if (this.speechStart === undefined) return t - this.startAt >= this.o.noSpeechMs ? "no_speech" : "continue";
    const spoke = (this.lastVoiced ?? this.speechStart) - this.speechStart;
    const needed = spoke < this.o.shortSpeechMs ? this.o.shortSilenceMs : this.o.silenceMs;
    return t - (this.lastVoiced ?? t) >= needed ? "end" : "continue";
  }
}

// Interrupção por voz enquanto o Mimo fala: exige voz SUSTENTADA e mais forte que o normal, para o eco do
// próprio alto-falante (ou um estalo) não cortar a fala.
export interface BargeInOptions {
  threshold: number;
  minMs: number;
}
export const DEFAULT_BARGE_IN: BargeInOptions = { threshold: 0.06, minMs: 350 };

export class BargeInDetector {
  private runStart?: number;
  constructor(private readonly o: BargeInOptions = DEFAULT_BARGE_IN) {}

  reset(): void {
    this.runStart = undefined;
  }

  feed(level: number, t: number, threshold: number = this.o.threshold): boolean {
    if (level < threshold) {
      this.runStart = undefined;
      return false;
    }
    this.runStart ??= t;
    return t - this.runStart >= this.o.minMs;
  }
}

// Estima o ruído de fundo (nível baixo recente) e devolve limites RELATIVOS a ele. Microfones de notebook entregam
// níveis muito diferentes; um número fixo falha em uns e dispara em outros. Medido na prática: ajustar no teste humano.
export class NoiseFloor {
  private readonly recent: number[] = [];
  constructor(private readonly windowSize = 60) {} // ~3 s a 20 amostras/s

  push(level: number): void {
    this.recent.push(level);
    if (this.recent.length > this.windowSize) this.recent.shift();
  }

  // Percentil 20 dos últimos níveis: ignora os picos da própria fala.
  get floor(): number {
    if (this.recent.length === 0) return 0;
    const sorted = [...this.recent].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.2)];
  }

  // Voz = bem acima do ruído de fundo, mas nunca acima de `max` (microfone fraco) nem abaixo de `min`.
  speechThreshold(min = 0.006, max = 0.04, factor = 3): number {
    return Math.min(max, Math.max(min, this.floor * factor));
  }

  // Interromper o Mimo pede voz mais forte (o alto-falante vaza no microfone).
  bargeInThreshold(min = 0.03, max = 0.12, factor = 6): number {
    return Math.min(max, Math.max(min, this.floor * factor));
  }
}
