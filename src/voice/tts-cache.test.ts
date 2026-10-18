import { beforeEach, describe, expect, it, vi } from "vitest";
import { FRASES } from "@/agent/frases";
import { __resetTtsForTests } from "./budget";
import { __resetVoiceLimitsForTests } from "./rate-limit";
import { __resetTtsCacheForTests, getCachedAudio, isCacheablePhrase, setCachedAudio } from "./tts-cache";
import { POST as tts } from "@/app/api/voice/tts/route";

const synth = vi.hoisted(() => vi.fn());
vi.mock("@/voice/tts", async (orig) => ({ ...(await orig<typeof import("@/voice/tts")>()), synthesize: synth }));

const origin = "http://localhost:8080";
const post = (body: unknown) => new Request(`${origin}/api/voice/tts`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const stream = (bytes: number[]) => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(bytes)); c.close(); } });

beforeEach(() => {
  __resetTtsCacheForTests(); __resetTtsForTests(); __resetVoiceLimitsForTests();
  synth.mockReset();
  synth.mockImplementation(async () => stream([1, 2, 3]));
});

describe("cache de áudio das frases fixas", () => {
  it("só aceita as frases da lista: texto qualquer nunca entra na memória", () => {
    expect(isCacheablePhrase(FRASES.espera)).toBe(true);
    expect(isCacheablePhrase("uma frase qualquer do usuário")).toBe(false);
    setCachedAudio("uma frase qualquer do usuário", new Uint8Array([1]));
    expect(getCachedAudio("uma frase qualquer do usuário")).toBeUndefined();
  });
  it("não guarda áudio vazio nem grande demais", () => {
    setCachedAudio(FRASES.espera, new Uint8Array(0));
    setCachedAudio(FRASES.espera, new Uint8Array(400_000));
    expect(getCachedAudio(FRASES.espera)).toBeUndefined();
  });
  it("rota: a 1ª vez sintetiza e guarda; a 2ª sai da memória, sem chamar o provedor", async () => {
    const a = await tts(post({ text: FRASES.espera }));
    expect(a.status).toBe(200);
    expect(new Uint8Array(await a.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const b = await tts(post({ text: FRASES.espera }));
    expect(new Uint8Array(await b.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(synth).toHaveBeenCalledTimes(1);
  });
  it("rota: texto que não é frase fixa nunca é guardado", async () => {
    await (await tts(post({ text: "Achei duas opções para você." }))).arrayBuffer();
    await (await tts(post({ text: "Achei duas opções para você." }))).arrayBuffer();
    expect(synth).toHaveBeenCalledTimes(2);
  });
  it("rota: frase fixa com texto vizinho (entonação) não usa o cache", async () => {
    await (await tts(post({ text: FRASES.espera, nextText: "Montei assim." }))).arrayBuffer();
    await (await tts(post({ text: FRASES.espera, nextText: "Montei assim." }))).arrayBuffer();
    expect(synth).toHaveBeenCalledTimes(2);
  });
  it("rota: acertos no cache não gastam a cota de pedidos do visitante", async () => {
    await (await tts(post({ text: FRASES.espera }))).arrayBuffer();
    for (let i = 0; i < 60; i++) expect((await tts(post({ text: FRASES.espera }))).status).toBe(200);
  });
});
