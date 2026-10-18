import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { SpeechPlayer, type AudioLike } from "./player";

// Áudio falso: toca até `finish()` ser chamado, como um áudio real que termina sozinho.
class FakeAudio implements AudioLike {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = false;
  constructor(public url: string) { FakeAudio.all.push(this); }
  static all: FakeAudio[] = [];
  play = () => Promise.resolve();
  pause = () => { this.paused = true; };
  finish = () => this.onended?.();
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 6; i++) await tick(); };
const ok = () => new Response(new Blob(["x"]), { status: 200 });
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

let fetchMock: ReturnType<typeof vi.fn>;
let player: SpeechPlayer;
let changes: boolean[];
let hooks: { onTtsResponse: Mock<() => void>; onAudioStart: Mock<() => void> };
let fallback: Mock<(text: string) => Promise<void>>;

beforeEach(() => {
  FakeAudio.all = [];
  changes = [];
  fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok()));
  fallback = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  hooks = { onTtsResponse: vi.fn<() => void>(), onAudioStart: vi.fn<() => void>() };
  player = new SpeechPlayer((s) => changes.push(s), hooks, { fetchImpl: fetchMock as unknown as typeof fetch, createAudio: (u) => new FakeAudio(u), speakFallback: fallback });
});

describe("player de fala por pedaços", () => {
  it("toca em ordem e já busca o áudio do próximo pedaço enquanto o atual toca", async () => {
    player.enqueue("Achei três opções para você.");
    player.enqueue("A mais em conta é a Forno e Cia.");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2); // os dois áudios já foram pedidos
    expect(FakeAudio.all).toHaveLength(1); // mas só o primeiro toca
    FakeAudio.all[0].finish();
    await flush();
    expect(FakeAudio.all).toHaveLength(2);
    FakeAudio.all[1].finish();
    await flush();
    expect(player.speaking).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it("passa o texto do pedaço anterior e do seguinte para manter a entonação", async () => {
    player.enqueue("Primeira frase.", { nextText: "Segunda frase." });
    player.enqueue("Segunda frase.");
    await flush();
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ text: "Primeira frase.", nextText: "Segunda frase." });
    expect(bodyOf(fetchMock.mock.calls[1])).toEqual({ text: "Segunda frase.", previousText: "Primeira frase." });
  });

  it("interromper corta o áudio, aborta as buscas e descarta o resto da fila", async () => {
    player.enqueue("Primeira frase.");
    player.enqueue("Segunda frase.");
    player.enqueue("Terceira frase.");
    await flush();
    const signals = fetchMock.mock.calls.map((c) => (c[1] as RequestInit).signal as AbortSignal);
    expect(player.stop()).toBe(true);
    expect(FakeAudio.all[0].paused).toBe(true);
    expect(signals.every((s) => s.aborted)).toBe(true);
    await flush();
    expect(FakeAudio.all).toHaveLength(1); // nada mais tocou
    expect(player.speaking).toBe(false);
  });

  it("depois de interromper, um novo turno toca normalmente", async () => {
    player.enqueue("Primeira frase.");
    await flush();
    player.stop();
    player.enqueue("Nova resposta.");
    await flush();
    expect(FakeAudio.all).toHaveLength(2);
    expect(player.speaking).toBe(true);
    FakeAudio.all[1].finish();
    await flush();
    expect(player.speaking).toBe(false);
  });

  it("falha da rota de voz num pedaço usa a voz do navegador e continua", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response("{}", { status: 503 })));
    player.enqueue("Primeira frase.");
    player.enqueue("Segunda frase.");
    await flush();
    expect(fallback).toHaveBeenCalledWith("Primeira frase.");
    expect(FakeAudio.all).toHaveLength(1); // a segunda toca por áudio
    FakeAudio.all[0].finish();
    await flush();
    expect(player.speaking).toBe(false);
  });

  it("erro de rede também cai para a voz do navegador, sem lançar", async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    player.enqueue("Frase única.");
    await flush();
    expect(fallback).toHaveBeenCalledWith("Frase única.");
    expect(player.speaking).toBe(false);
  });

  it("avisa cada resposta da rota e o início de cada áudio (a sessão decide qual marca conta)", async () => {
    player.enqueue("Primeira frase.");
    player.enqueue("Segunda frase.");
    await flush();
    FakeAudio.all[0].finish();
    await flush();
    expect(hooks.onTtsResponse).toHaveBeenCalledTimes(2);
    expect(hooks.onAudioStart).toHaveBeenCalledTimes(2);
  });

  it("speak divide o texto em pedaços e resolve quando termina", async () => {
    const done = player.speak("Achei três opções para você. A mais em conta é a Forno e Cia, por trinta e nove e noventa.");
    await flush();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 4 && player.speaking; i++) { FakeAudio.all.at(-1)?.finish(); await flush(); }
    await expect(done).resolves.toBeUndefined();
  });

  it("texto vazio não faz nada", async () => {
    player.enqueue("   ");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(player.speaking).toBe(false);
  });
});


describe("frases fixas em cache", () => {
  it("preload busca uma vez e a fala seguinte toca sem nova ida à rede", async () => {
    player.preload(["Deixa eu ver as opções."]);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    player.enqueue("Deixa eu ver as opções.");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1); // usou o áudio guardado
    expect(FakeAudio.all).toHaveLength(1);
    expect(hooks.onTtsResponse).toHaveBeenCalledTimes(1); // a medida de latência continua funcionando
    FakeAudio.all[0].finish();
    await flush();
  });
  it("a mesma frase pode tocar de novo em outro turno (o áudio guardado é reutilizado)", async () => {
    player.preload(["Já vejo isso para você."]);
    await flush();
    for (let i = 0; i < 2; i++) {
      player.enqueue("Já vejo isso para você.");
      await flush();
      FakeAudio.all.at(-1)!.finish();
      await flush();
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeAudio.all).toHaveLength(2);
  });
  it("preload que falhou não fica em cache: a próxima fala busca de novo", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response("x", { status: 503 })));
    player.preload(["Um instante, já te mostro."]);
    await flush();
    player.enqueue("Um instante, já te mostro.");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(FakeAudio.all).toHaveLength(1);
  });
  it("preload repetido da mesma frase não busca duas vezes", async () => {
    player.preload(["Oi."]);
    player.preload(["Oi."]);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
