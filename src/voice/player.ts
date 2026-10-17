"use client";
// Player de fala do navegador: toca o áudio da ElevenLabs (via /api/voice/tts), em fila, e PARA na hora
// quando o usuário interrompe. Se a rota de voz falhar, cai para a voz do navegador. Texto sempre existe.
export type PlayerMode = "audio" | "browser" | "none";

export class SpeechPlayer {
  speaking = false;
  private audio?: HTMLAudioElement;
  private url?: string;
  private generation = 0; // cada stop() invalida o que estava pendente

  constructor(private onChange?: (speaking: boolean) => void) {}

  private set(speaking: boolean) {
    if (this.speaking !== speaking) {
      this.speaking = speaking;
      this.onChange?.(speaking);
    }
  }

  // Resolve quando termina, é interrompida ou falha. Nunca lança: a conversa não depende da voz.
  async speak(text: string): Promise<PlayerMode> {
    this.stop();
    const gen = this.generation;
    this.set(true);
    try {
      const res = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (gen !== this.generation) return "none"; // interrompida enquanto carregava
      if (res.ok) {
        const blob = await res.blob();
        if (gen !== this.generation) return "none";
        this.url = URL.createObjectURL(blob);
        this.audio = new Audio(this.url);
        await this.play(this.audio, gen);
        return "audio";
      }
    } catch {
      // cai para a voz do navegador
    }
    if (gen !== this.generation) return "none";
    const mode = await this.browserVoice(text, gen);
    if (gen === this.generation) this.set(false);
    return mode;
  }

  private play(audio: HTMLAudioElement, gen: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        if (gen === this.generation) this.set(false);
        this.cleanup();
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.onpause = () => (gen !== this.generation ? done() : undefined);
      audio.play().catch(done);
    });
  }

  private browserVoice(text: string, gen: number): Promise<PlayerMode> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve("none");
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.onend = () => resolve(gen === this.generation ? "browser" : "none");
      u.onerror = () => resolve("none");
      window.speechSynthesis.speak(u);
    });
  }

  // Interrupção: chamar assim que o usuário aperta para falar.
  stop(): boolean {
    const wasSpeaking = this.speaking;
    this.generation++;
    this.audio?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    this.cleanup();
    this.set(false);
    return wasSpeaking;
  }

  private cleanup() {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined;
    this.audio = undefined;
  }
}
