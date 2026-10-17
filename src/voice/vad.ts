// Detecção de atividade de voz por energia (RMS). Funções puras, testáveis sem navegador.
// Serve para: medir quando a pessoa começou e parou de falar (sinais) e para a interrupção.

export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

export interface VadOptions {
  threshold: number; // nível RMS (0 a 1) a partir do qual há voz
  minVoiceMs: number; // voz precisa durar isso para contar como fala (ignora estalos)
}

export const DEFAULT_VAD: VadOptions = { threshold: 0.02, minVoiceMs: 120 };

export class VoiceActivityTracker {
  firstWordAt?: number;
  lastWordAt?: number;
  active = false;
  private runStart?: number;

  constructor(private opts: VadOptions = DEFAULT_VAD) {}

  // `t` em ms (performance.now). Chamar a cada amostra de nível, em ordem crescente de tempo.
  push(level: number, t: number): void {
    const voiced = level >= this.opts.threshold;
    if (voiced) {
      this.runStart ??= t;
      const confirmed = t - this.runStart >= this.opts.minVoiceMs;
      if (confirmed) {
        this.active = true;
        this.firstWordAt ??= this.runStart;
        this.lastWordAt = t;
      }
    } else {
      this.runStart = undefined;
      this.active = false;
    }
  }

  get heardSpeech(): boolean {
    return this.firstWordAt !== undefined;
  }
}

// Escolhe o formato que o navegador sabe gravar; `isSupported` vem de MediaRecorder.isTypeSupported.
const PREFERRED = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
export function pickMimeType(isSupported: (mime: string) => boolean): string | undefined {
  return PREFERRED.find((m) => isSupported(m));
}
