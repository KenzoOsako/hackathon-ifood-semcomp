import { beforeEach, describe, expect, it, vi } from "vitest";
import { BargeInDetector, EndpointDetector, NoiseFloor } from "./endpoint";
import { VoiceSession, type PlayerLike, type RecorderLike, type SessionDeps, type SessionEvents, type Utterance, type VoiceErrorCode } from "./session";

// ---------- doubles ----------
class Clock {
  t = 0;
  private timers: Array<{ fn: () => void; at: number; every?: number; dead?: boolean }> = [];
  now = () => this.t;
  every = (fn: () => void, ms: number) => { const x = { fn, at: this.t + ms, every: ms } as { fn: () => void; at: number; every?: number; dead?: boolean }; this.timers.push(x); return () => { x.dead = true; }; };
  after = (fn: () => void, ms: number) => { const x = { fn, at: this.t + ms } as { fn: () => void; at: number; dead?: boolean }; this.timers.push(x); return () => { x.dead = true; }; };
  async advance(ms: number) {
    const end = this.t + ms;
    while (this.t < end) {
      this.t = Math.min(end, this.t + 50);
      for (const x of [...this.timers]) {
        if (x.dead || x.at > this.t) continue;
        x.fn();
        if (x.every) x.at += x.every; else x.dead = true;
      }
      await Promise.resolve(); await Promise.resolve();
    }
    for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
  }
}

class FakePlayer implements PlayerLike {
  speaking = false;
  spoken: string[] = [];
  stops = 0;
  stop = () => { const was = this.speaking; this.speaking = false; this.stops++; return was; };
  speak = (t: string) => { this.spoken.push(t); this.speaking = true; return Promise.resolve(); };
  enqueue = (t: string) => { this.spoken.push(t); this.speaking = true; };
  finish = () => { this.speaking = false; };
}

let clock: Clock;
let level = 0;
let opens = 0;
let closes = 0;
let recorders: RecorderLike[];
let player: FakePlayer;
let fetchMock: ReturnType<typeof vi.fn>;
let states: string[];
let errors: Array<VoiceErrorCode | null>;
let utterances: Utterance[];
let handsFreeEvents: boolean[];
let openFails = false;
let supported = true;

function makeSession() {
  const deps: SessionDeps = {
    supported: () => supported,
    openMic: async () => { if (openFails) throw new Error("denied"); opens++; return { stream: { stop: () => { closes++; } }, meter: { read: () => level, close: () => undefined } }; },
    createRecorder: () => {
      const r: RecorderLike = {
        mimeType: "audio/webm;codecs=opus", onData: null, onStop: null,
        start: () => undefined,
        stop: () => { queueMicrotask(() => { r.onData?.(new Blob([new Uint8Array(2000)])); r.onStop?.(); }); },
      };
      recorders.push(r);
      return r;
    },
    fetchImpl: fetchMock as unknown as typeof fetch,
    now: clock.now, every: clock.every, after: clock.after, player, getTerms: () => ["Forno e Cia"], warm: vi.fn(),
  };
  const ev: SessionEvents = {
    onState: (s) => states.push(s), onError: (c) => errors.push(c), onLevel: () => undefined,
    onHandsFree: (b) => handsFreeEvents.push(b), onUtterance: (u) => utterances.push(u),
  };
  return new VoiceSession(deps, ev);
}
const ok = (texto = "quero uma pizza calabresa grande") => Response.json({ texto, confianca: 0.97, injecao: false, redacoes: [] });

beforeEach(() => {
  clock = new Clock(); level = 0; opens = 0; closes = 0; recorders = []; player = new FakePlayer();
  states = []; errors = []; utterances = []; handsFreeEvents = []; openFails = false; supported = true;
  fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok()));
});

// ---------- detectores puros ----------
describe("fim de fala", () => {
  it("fala normal termina depois de 1 s de silêncio; fala curta, depois de 700 ms", () => {
    const longa = new EndpointDetector(0);
    for (let t = 0; t <= 3000; t += 50) expect(longa.feed(0.2, t)).toBe("continue");
    expect(longa.feed(0, 3600)).toBe("continue");
    expect(longa.feed(0, 4000)).toBe("end");
    const curta = new EndpointDetector(0);
    for (let t = 0; t <= 600; t += 50) curta.feed(0.2, t);
    expect(curta.feed(0, 1200)).toBe("continue");
    expect(curta.feed(0, 1300)).toBe("end");
  });
  it("pausa curta no meio da frase não corta a pessoa", () => {
    const d = new EndpointDetector(0);
    for (let t = 0; t <= 2000; t += 50) d.feed(0.2, t);
    expect(d.feed(0, 2500)).toBe("continue"); // 500 ms pensando
    expect(d.feed(0.2, 2600)).toBe("continue"); // voltou a falar
  });
  it("ninguém fala: desiste depois de 7 s; estalo curto não conta como fala", () => {
    const d = new EndpointDetector(0);
    d.feed(0.5, 100); d.feed(0, 150); // estalo de 50 ms
    expect(d.heardSpeech).toBe(false);
    expect(d.feed(0, 6900)).toBe("continue");
    expect(d.feed(0, 7000)).toBe("no_speech");
  });
  it("trava de segurança de 30 s", () => {
    const d = new EndpointDetector(0);
    expect(d.feed(0.2, 30_000)).toBe("max");
  });
});

describe("ruído de fundo", () => {
  it("estima o fundo pelo percentil baixo e ignora os picos da fala", () => {
    const n = new NoiseFloor();
    for (let i = 0; i < 40; i++) n.push(0.004);
    for (let i = 0; i < 10; i++) n.push(0.2); // fala
    expect(n.floor).toBeCloseTo(0.004);
    expect(n.speechThreshold()).toBeCloseTo(0.012);
  });
  it("o limite respeita um mínimo e um máximo", () => {
    const silencioso = new NoiseFloor(); silencioso.push(0);
    expect(silencioso.speechThreshold()).toBe(0.006);
    const barulhento = new NoiseFloor(); for (let i = 0; i < 20; i++) barulhento.push(0.5);
    expect(barulhento.speechThreshold()).toBe(0.04);
    expect(barulhento.bargeInThreshold()).toBe(0.12);
  });
});

describe("interrupção por voz", () => {
  it("exige voz sustentada e forte; ruído fraco ou estalo não dispara", () => {
    const b = new BargeInDetector();
    expect(b.feed(0.03, 0)).toBe(false); // fraco demais (eco)
    expect(b.feed(0.2, 100)).toBe(false);
    expect(b.feed(0.2, 300)).toBe(false); // só 200 ms
    expect(b.feed(0, 350)).toBe(false); // caiu: zera
    expect(b.feed(0.2, 400)).toBe(false);
    expect(b.feed(0.2, 760)).toBe(true); // 360 ms contínuos
  });
});

// ---------- sessão ----------
describe("modo manual (Falar / Parar)", () => {
  it("grava, reconhece com as palavras da tela, entrega a fala com sinais e libera o microfone", async () => {
    const s = makeSession();
    await s.start();
    expect(s.state).toBe("listening");
    level = 0.3; await clock.advance(1200); level = 0;
    s.stop();
    await clock.advance(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/voice/stt?terms=");
    expect(decodeURIComponent(String(url))).toContain("Forno e Cia");
    expect((init as RequestInit).headers).toEqual({ "Content-Type": "audio/webm" });
    expect(utterances).toHaveLength(1);
    expect(utterances[0].texto).toBe("quero uma pizza calabresa grande");
    expect(utterances[0].sinais).toMatchObject({ origem: "voz", interrompeu: false });
    expect(s.state).toBe("idle");
    expect(closes).toBe(1); // microfone liberado
  });
  it("no manual NÃO para sozinho no silêncio: quem decide é a pessoa", async () => {
    const s = makeSession();
    await s.start();
    level = 0.3; await clock.advance(800); level = 0; await clock.advance(3000);
    expect(s.state).toBe("listening");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("no manual o áudio SEMPRE vai ao reconhecimento; sem fala, ele responde vazio e a tela avisa", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 422 })));
    const s = makeSession();
    await s.start(); await clock.advance(1000); s.stop(); await clock.advance(200);
    expect(fetchMock).toHaveBeenCalledTimes(1); // quem decide se há fala é o reconhecimento, não o medidor local
    expect(errors.at(-1)).toBe("no_speech");
    expect(s.state).toBe("error");
  });
  it("microfone FRACO (abaixo do antigo limite fixo de 0,02) ainda é reconhecido no manual", async () => {
    const s = makeSession();
    await s.start();
    level = 0.012; await clock.advance(1500); level = 0;
    s.stop(); await clock.advance(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(utterances).toHaveLength(1);
  });
  it("o diagnóstico informa nível, ruído de fundo, limite, tamanho do áudio e a resposta do reconhecimento", async () => {
    const diags: Array<Record<string, unknown>> = [];
    const s = makeSession();
    (s as unknown as { ev: SessionEvents }).ev.onDiag = (d) => diags.push({ ...d });
    await s.start();
    level = 0.012; await clock.advance(1500); level = 0; s.stop(); await clock.advance(200);
    const last = diags.at(-1)!;
    expect(last).toMatchObject({ sttStatus: 200, mime: "audio/webm" });
    expect(last.blobBytes).toBeGreaterThan(800);
    expect(typeof last.floor).toBe("number");
    expect(typeof last.threshold).toBe("number");
  });
  it("permissão negada e navegador sem suporte são tratados sem quebrar", async () => {
    openFails = true;
    const s = makeSession();
    await s.start();
    expect(errors.at(-1)).toBe("permission_denied");
    supported = false; openFails = false;
    const s2 = makeSession();
    await s2.start();
    expect(errors.at(-1)).toBe("unsupported");
  });
});

describe("modo sem as mãos", () => {
  it("abre o microfone, para sozinho no silêncio, reconhece, e reabre depois que o Guide termina de falar", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    expect(s.state).toBe("listening");
    level = 0.3; await clock.advance(1500); level = 0; await clock.advance(1200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(utterances).toHaveLength(1);
    expect(opens).toBe(1); // o microfone fica aberto no modo sem as mãos
    // o agente responde falando
    player.speak("Achei três opções."); await clock.advance(200);
    expect(s.state).toBe("speaking");
    player.finish(); await clock.advance(300);
    expect(s.state).toBe("idle"); // ainda no período de espera contra eco
    await clock.advance(400);
    expect(s.state).toBe("listening"); // reabriu sozinho
    expect(recorders).toHaveLength(2);
  });
  it("limite adaptativo: microfone fraco (voz a 0,012) ainda é ouvido no modo sem as mãos", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.002; await clock.advance(1000); // ruído de fundo baixo: o limite desce
    level = 0.012; await clock.advance(1500); level = 0.002; await clock.advance(1300);
    expect(utterances).toHaveLength(1);
  });
  it("limite adaptativo: sala barulhenta (fundo a 0,015) não conta como fala, a voz forte conta", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.015; await clock.advance(4000); // só barulho de fundo
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s.state).toBe("listening");
    level = 0.08; await clock.advance(1500); level = 0.015; await clock.advance(1300); // voz bem acima do fundo
    expect(utterances).toHaveLength(1);
  });
  it("depois de entregar a fala, NÃO reabre o microfone enquanto o agente ainda está pensando", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.3; await clock.advance(1500); level = 0; await clock.advance(1200);
    expect(utterances).toHaveLength(1);
    await clock.advance(3000); // o agente demora
    expect(s.state).toBe("idle");
    expect(recorders).toHaveLength(1);
    level = 0.3; await clock.advance(1000); level = 0; // ruído ou conversa de fundo enquanto espera
    expect(recorders).toHaveLength(1);
  });
  it("se a resposta termina sem fala (turnDone), volta a ouvir logo em seguida", async () => {
    const s = makeSession();
    let api: Parameters<SessionEvents["onUtterance"]>[1] | undefined;
    const deps = (s as unknown as { ev: SessionEvents }).ev;
    const original = deps.onUtterance;
    deps.onUtterance = (u, a) => { api = a; original(u, a); };
    await s.setHandsFree(true);
    level = 0.3; await clock.advance(1500); level = 0; await clock.advance(1200);
    api!.turnDone();
    await clock.advance(600);
    expect(s.state).toBe("listening");
    expect(recorders).toHaveLength(2);
  });
  it("se o agente nunca responde, desiste da espera em 15 s e volta a ouvir", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.3; await clock.advance(1500); level = 0; await clock.advance(1200);
    await clock.advance(14_000);
    expect(s.state).toBe("idle");
    await clock.advance(2000);
    expect(s.state).toBe("listening");
  });
  it("fala curta ('sim') termina mais rápido que fala longa", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.3; await clock.advance(500); level = 0; await clock.advance(800);
    expect(utterances).toHaveLength(1);
  });
  it("falar por cima do Guide interrompe a fala e já grava, marcando a interrupção", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.3; await clock.advance(1500); level = 0; await clock.advance(1200); // primeira fala
    player.speak("Achei três opções, a mais em conta é a Forno e Cia."); await clock.advance(200);
    expect(s.state).toBe("speaking");
    level = 0.2; await clock.advance(500); // voz sustentada por cima
    expect(player.stops).toBeGreaterThan(0);
    expect(player.speaking).toBe(false);
    expect(s.state).toBe("listening");
    await clock.advance(800); level = 0; await clock.advance(1200);
    expect(utterances).toHaveLength(2);
    expect(utterances[1].sinais.interrompeu).toBe(true);
  });
  it("estalo curto durante a fala do Guide não interrompe", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.3; await clock.advance(1500); level = 0; await clock.advance(1200);
    player.speak("Frase longa do Guide."); await clock.advance(200);
    level = 0.5; await clock.advance(150); level = 0; await clock.advance(500);
    expect(player.speaking).toBe(true);
    expect(s.state).toBe("speaking");
  });
  it("silêncio total: tenta de novo quieto e, na terceira, desliga e avisa", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    await clock.advance(23_000); // 3 rodadas de 7 s + 2 pausas de 300 ms
    expect(s.handsFree).toBe(false);
    expect(handsFreeEvents).toEqual([true, false]);
    expect(errors.at(-1)).toBe("no_speech");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("limite de uso (429) pausa o modo sem as mãos e avisa, sem laço de tentativas", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 429 })));
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.3; await clock.advance(1500); level = 0; await clock.advance(1500);
    expect(errors.at(-1)).toBe("rate_limited");
    expect(s.handsFree).toBe(false);
    await clock.advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(closes).toBeGreaterThan(0);
  });
  it("desligar o modo sem as mãos libera o microfone e cancela a gravação", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    level = 0.3; await clock.advance(500);
    await s.setHandsFree(false);
    await clock.advance(300);
    expect(closes).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s.state).toBe("idle");
  });
  it("destruir a sessão para tudo: tique, microfone e fala", async () => {
    const s = makeSession();
    await s.setHandsFree(true);
    player.speak("x");
    s.destroy();
    expect(closes).toBe(1);
    expect(player.speaking).toBe(false);
    const before = recorders.length;
    await clock.advance(3000);
    expect(recorders).toHaveLength(before);
  });
});
