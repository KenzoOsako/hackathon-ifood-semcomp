import { describe, expect, it } from "vitest";
import { SpeechChunker, splitSpeechChunks } from "./chunker";
import { encodeEvent, readConverseStream, type ConverseEvent } from "./converse-events";
import { LatencyTrace, overBudget } from "./latency";

const stream = (parts: string[]) =>
  new ReadableStream<Uint8Array>({ start(c) { for (const p of parts) c.enqueue(new TextEncoder().encode(p)); c.close(); } });
const collect = async (s: ReadableStream<Uint8Array>) => { const out: ConverseEvent[] = []; for await (const e of readConverseStream(s)) out.push(e); return out; };

describe("pedaços de fala", () => {
  it("divide por frase, com o primeiro pedaço curto para sair cedo", () => {
    const c = splitSpeechChunks("Achei três opções para você. A mais em conta é a Forno e Cia, por trinta e nove e noventa. Quer que eu monte o plano?");
    expect(c).toEqual(["Achei três opções para você.", "A mais em conta é a Forno e Cia, por trinta e nove e noventa.", "Quer que eu monte o plano?"]);
  });
  it("não corta em valores, decimais nem abreviações", () => {
    const c = splitSpeechChunks("Item por R$ 39,90, a 1,2 km, nota 4.5. Fale com o Dr. Silva agora mesmo.");
    expect(c.join(" ")).toContain("R$ 39,90");
    expect(c.join(" ")).toContain("1,2 km");
    expect(c.join(" ")).toContain("Dr. Silva");
  });
  it("junta frases curtas depois do primeiro pedaço, para não picotar a fala", () => {
    const c = splitSpeechChunks("Oi! Tudo bem? Posso ajudar com a pizza, o mercado ou o presente. Pode falar.");
    expect(c[0]).toBe("Oi! Tudo bem?");
    expect(c.length).toBeLessThanOrEqual(3);
  });
  it("frase longa sem ponto é cortada na vírgula, abaixo do limite", () => {
    const longa = "primeiro trecho bem comprido com bastante conteúdo, segundo trecho também comprido com mais conteúdo ainda, terceiro trecho final que continua falando sem parar até passar do limite";
    const c = splitSpeechChunks(longa, { firstMinChars: 12, minChars: 28, maxChars: 90 });
    expect(c.length).toBeGreaterThan(1);
    expect(c.every((x) => x.length <= 90)).toBe(true);
    expect(c.join(" ").replace(/\s+/g, " ")).toBe(longa);
  });
  it("incremental: emite o pedaço assim que a frase fecha, e o resto no flush", () => {
    const ch = new SpeechChunker();
    expect(ch.push("Achei três ")).toEqual([]);
    expect(ch.push("opções para você. A mais")).toEqual(["Achei três opções para você."]);
    expect(ch.push(" em conta é a Forno e Cia.")).toEqual([]);
    expect(ch.flush()).toEqual(["A mais em conta é a Forno e Cia."]);
    expect(ch.flush()).toEqual([]);
  });
  it("texto vazio não gera pedaços", () => {
    expect(splitSpeechChunks("   ")).toEqual([]);
  });
});

describe("contrato do fluxo (NDJSON)", () => {
  it("lê eventos mesmo quando chegam quebrados no meio da linha", async () => {
    const a = encodeEvent({ type: "ack", text: "Já vejo isso." });
    const b = encodeEvent({ type: "speech", seq: 0, text: "Achei três opções." });
    const c = encodeEvent({ type: "done", turnId: "t1" });
    const joined = a + b + c;
    const evs = await collect(stream([joined.slice(0, 15), joined.slice(15, 70), joined.slice(70)]));
    expect(evs.map((e) => e.type)).toEqual(["ack", "speech", "done"]);
    expect(evs[1]).toMatchObject({ seq: 0, text: "Achei três opções." });
  });
  it("evento inválido vira erro sem derrubar os seguintes", async () => {
    const evs = await collect(stream(['{"type":"speech","seq":-1,"text":"x"}\n', "lixo\n", encodeEvent({ type: "done", turnId: "t1" })]));
    expect(evs.map((e) => e.type)).toEqual(["error", "error", "done"]);
  });
  it("campo extra é recusado (contrato estrito)", async () => {
    const evs = await collect(stream(['{"type":"done","turnId":"t","extra":1}\n']));
    expect(evs[0].type).toBe("error");
  });
  it("evento de tela carrega o conteúdo sem a voz interpretar", async () => {
    const evs = await collect(stream([encodeEvent({ type: "screen", event: "plano_atualizado", payload: { versao: 2 } })]));
    expect(evs[0]).toEqual({ type: "screen", event: "plano_atualizado", payload: { versao: 2 } });
  });
});

describe("medida de latência", () => {
  it("calcula cada trecho e o tempo até o primeiro áudio", () => {
    const t = new LatencyTrace();
    t.mark("mic_stop", 0); t.mark("stt_done", 450); t.mark("request_sent", 460); t.mark("first_chunk", 1100); t.mark("tts_first_byte", 1450); t.mark("audio_start", 1500);
    expect(t.summary()).toEqual({ sttMs: 450, backendFirstChunkMs: 640, ttsFirstByteMs: 350, timeToFirstAudioMs: 1500 });
    expect(overBudget(t.summary())).toEqual([]);
  });
  it("só guarda o primeiro marco de cada tipo e aponta o que estourou a meta", () => {
    const t = new LatencyTrace();
    t.mark("mic_stop", 0); t.mark("stt_done", 900); t.mark("stt_done", 5000); t.mark("audio_start", 3000);
    expect(t.summary().sttMs).toBe(900);
    expect(overBudget(t.summary())).toEqual(["sttMs", "timeToFirstAudioMs"]);
  });
  it("marcos que faltam não viram números inventados", () => {
    const t = new LatencyTrace();
    t.mark("mic_stop", 0);
    expect(t.summary()).toEqual({ sttMs: undefined, backendFirstChunkMs: undefined, ttsFirstByteMs: undefined, timeToFirstAudioMs: undefined });
  });
});
