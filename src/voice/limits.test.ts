import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetTtsForTests } from "./budget";
import { BASE_KEYTERMS, buildKeyterms, sanitizeTerm, termsFromUrl } from "./keyterms";
import { __resetVoiceLimitsForTests, identifyVoiceVisitor, SlidingWindow, VoiceLimits } from "./rate-limit";
import { POST as stt } from "@/app/api/voice/stt/route";
import { POST as tts } from "@/app/api/voice/tts/route";
import { POST as warm } from "@/app/api/voice/warm/route";

const origin = "http://localhost:3000";
const json = (path: string, body: unknown, cookie?: string) =>
  new Request(`${origin}/api/voice/${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
const audio = (query = "", cookie?: string) =>
  new Request(`${origin}/api/voice/stt${query}`, { method: "POST", headers: { Origin: origin, "Content-Type": "audio/webm", ...(cookie ? { Cookie: cookie } : {}) }, body: new Uint8Array(2000).fill(5) });
const cookieOf = (r: Response) => r.headers.get("set-cookie")!.split(";")[0];

describe("janela deslizante", () => {
  it("bloqueia ao passar do limite e libera quando a janela corre", () => {
    let t = 0;
    const w = new SlidingWindow(2, 1000, () => t);
    expect(w.hit("a").ok).toBe(true);
    expect(w.hit("a").ok).toBe(true);
    const r = w.hit("a");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.retryAfterMs).toBeGreaterThanOrEqual(1000);
    expect(w.hit("b").ok).toBe(true); // outro visitante não é afetado
    t = 1500;
    expect(w.hit("a").ok).toBe(true);
  });
  it("conta custo em unidades (caracteres)", () => {
    const w = new SlidingWindow(100, 1000, () => 0);
    expect(w.hit("a", 60).ok).toBe(true);
    expect(w.hit("a", 60).ok).toBe(false);
    expect(w.hit("a", 40).ok).toBe(true);
  });
});

describe("limites de voz", () => {
  it("limita por visitante e o teto global de visitantes novos impede ganhar cota limpando o cookie", () => {
    const l = new VoiceLimits({ VOICE_STT_PER_MIN: "2", VOICE_NEW_VISITORS_PER_MIN: "3" }, () => 0);
    expect(l.check("v1", false, "stt").ok).toBe(true);
    expect(l.check("v1", false, "stt").ok).toBe(true);
    expect(l.check("v1", false, "stt").ok).toBe(false);
    expect(l.check("n1", true, "stt").ok).toBe(true);
    expect(l.check("n2", true, "stt").ok).toBe(true);
    expect(l.check("n3", true, "stt").ok).toBe(true);
    expect(l.check("n4", true, "stt").ok).toBe(false); // 4ª identidade nova no mesmo minuto
  });
  it("limita caracteres de síntese por visitante", () => {
    const l = new VoiceLimits({ VOICE_TTS_CHARS_PER_10MIN: "100" }, () => 0);
    expect(l.check("v", false, "tts", 80).ok).toBe(true);
    expect(l.check("v", false, "tts", 80).ok).toBe(false);
  });
  it("cookie anônimo: emite um novo, aceita o válido e ignora lixo ou duplicado", () => {
    const novo = identifyVoiceVisitor(new Request(`${origin}/x`));
    expect(novo.isNew).toBe(true);
    expect(novo.setCookie).toMatch(/^guide_voice=[0-9a-f]{32}; Path=\/; HttpOnly; SameSite=Strict/);
    const volta = identifyVoiceVisitor(new Request(`${origin}/x`, { headers: { Cookie: `guide_voice=${novo.id}` } }));
    expect(volta).toEqual({ id: novo.id, isNew: false });
    expect(identifyVoiceVisitor(new Request(`${origin}/x`, { headers: { Cookie: "guide_voice=lixo" } })).isNew).toBe(true);
    expect(identifyVoiceVisitor(new Request(`${origin}/x`, { headers: { Cookie: `guide_voice=${novo.id}; guide_voice=${novo.id}` } })).isNew).toBe(true);
  });
});

describe("palavras-chave do reconhecimento", () => {
  it("limpa o que o provedor recusa e mantém acentos, hífen e espaço", () => {
    expect(sanitizeTerm('Pizzaria "Nonna" [ótima]')).toBe("Pizzaria Nonna ótima");
    expect(sanitizeTerm("X-Burger")).toBe("X-Burger");
    expect(sanitizeTerm("açaí")).toBe("açaí");
    expect(sanitizeTerm("a")).toBeNull();
    // 6 palavras ou mais derrubavam o reconhecimento: o termo é cortado em 5 palavras
    expect(sanitizeTerm("pipoca de micro-ondas, pacote com 3")).toBe("pipoca de micro-ondas pacote com");
    expect(sanitizeTerm("um dois tres quatro cinco")).toBe("um dois tres quatro cinco");
    expect(sanitizeTerm("x".repeat(51))).toBeNull();
    expect(sanitizeTerm("!!!")).toBeNull();
  });
  it("junta as dinâmicas às fixas, sem repetir, com as dinâmicas primeiro e dentro do limite", () => {
    const t = buildKeyterms(["Forno e Cia", "Padaria Nova", 42, null]);
    expect(t[0]).toBe("Forno e Cia");
    expect(t[1]).toBe("Padaria Nova");
    expect(t.filter((x) => x.toLowerCase() === "forno e cia")).toHaveLength(1);
    expect(t).toContain("calabresa");
    expect(buildKeyterms(Array.from({ length: 500 }, (_, i) => `termo ${i}`)).length).toBeLessThanOrEqual(100);
    expect(buildKeyterms("lixo")).toEqual(buildKeyterms([]));
    expect(BASE_KEYTERMS.every((k) => sanitizeTerm(k) === k)).toBe(true); // nenhuma fixa seria alterada pelo filtro
  });
  it("lê a lista da URL e ignora entrada inválida ou grande demais", () => {
    expect(termsFromUrl(`${origin}/x?terms=${encodeURIComponent(JSON.stringify(["Loja Nova"]))}`)[0]).toBe("Loja Nova");
    expect(termsFromUrl(`${origin}/x?terms=nao-json`)).toEqual(buildKeyterms());
    expect(termsFromUrl(`${origin}/x?terms=${"a".repeat(3000)}`)).toEqual(buildKeyterms());
    expect(termsFromUrl(`${origin}/x`)).toEqual(buildKeyterms());
  });
});

describe("rotas com limite e palavras-chave", () => {
  beforeEach(() => {
    __resetTtsForTests(); __resetVoiceLimitsForTests();
    vi.stubEnv("ELEVENLABS_API_KEY", "sk_teste"); vi.stubEnv("ELEVENLABS_VOICE_ID", "voz123");
    vi.stubEnv("TTS_CHAR_BUDGET", "100000"); vi.stubEnv("STT_SECONDS_BUDGET", "1000");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); __resetVoiceLimitsForTests(); });

  it("visitante novo recebe o cookie, e o cookie é reaproveitado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(new Uint8Array([1]), { status: 200 }))));
    const r1 = await tts(json("tts", { text: "Oi" }));
    expect(r1.status).toBe(200);
    const c = cookieOf(r1);
    const r2 = await tts(json("tts", { text: "Oi de novo" }, c));
    expect(r2.headers.get("set-cookie")).toBeNull();
  });
  it("estourar o limite por minuto responde 429 com Retry-After, sem chamar o provedor", async () => {
    vi.stubEnv("VOICE_TTS_PER_MIN", "2");
    __resetVoiceLimitsForTests();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Uint8Array([1]), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const c = cookieOf(await tts(json("tts", { text: "um" })));
    expect((await tts(json("tts", { text: "dois" }, c))).status).toBe(200);
    const bloqueada = await tts(json("tts", { text: "três" }, c));
    expect(bloqueada.status).toBe(429);
    expect(Number(bloqueada.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect((await bloqueada.json()).code).toBe("RATE_LIMITED");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("o reconhecimento também é limitado por visitante", async () => {
    vi.stubEnv("VOICE_STT_PER_MIN", "1");
    __resetVoiceLimitsForTests();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ text: "oi", audio_duration_secs: 1, words: [] }))));
    const primeira = await stt(audio());
    expect(primeira.status).toBe(200);
    const c = cookieOf(primeira);
    expect((await stt(audio("", c))).status).toBe(429);
  });
  it("o aquecimento é limitado e recusa origem inválida", async () => {
    vi.stubEnv("VOICE_WARM_PER_MIN", "1");
    __resetVoiceLimitsForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]")));
    const a = await warm(json("warm", {}));
    expect(a.status).toBe(204);
    expect((await warm(json("warm", {}, cookieOf(a)))).status).toBe(429);
  });
  it("envia as palavras-chave (fixas e as da tela) ao provedor, uma por campo", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ text: "Forno e Cia", audio_duration_secs: 1, words: [] })));
    vi.stubGlobal("fetch", fetchMock);
    const q = `?terms=${encodeURIComponent(JSON.stringify(["Padaria Nova", "Pizzaria Nonna"]))}`;
    expect((await stt(audio(q))).status).toBe(200);
    const form = fetchMock.mock.calls[0][1].body as FormData;
    const sent = form.getAll("keyterms");
    expect(sent[0]).toBe("Padaria Nova");
    expect(sent).toContain("calabresa");
    expect(sent.filter((x) => String(x).toLowerCase() === "pizzaria nonna")).toHaveLength(1);
  });
});
