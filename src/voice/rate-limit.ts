// Limite de uso das rotas de voz por VISITANTE (cookie anônimo) e global. Protege os créditos do time:
// sem isso, qualquer pessoa na página poderia gastar a síntese e o reconhecimento em laço.
// Em memória: vale para um processo (demo). Para várias instâncias, trocar por armazenamento compartilhado.
import { randomBytes } from "node:crypto";

export class SlidingWindow {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number, private now: () => number = Date.now) {}

  // `cost` permite contar caracteres em vez de requisições.
  hit(key: string, cost = 1): { ok: true } | { ok: false; retryAfterMs: number } {
    const t = this.now();
    const arr = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    const used = arr.length;
    if (used + cost > this.limit) {
      const oldest = arr[0] ?? t;
      this.hits.set(key, arr);
      return { ok: false, retryAfterMs: Math.max(1000, this.windowMs - (t - oldest)) };
    }
    for (let i = 0; i < cost; i++) arr.push(t);
    this.hits.set(key, arr);
    if (this.hits.size > 5000) this.prune(t);
    return { ok: true };
  }

  private prune(t: number) {
    for (const [k, v] of this.hits) if (v.every((x) => t - x >= this.windowMs)) this.hits.delete(k);
  }
}

export type VoiceKind = "tts" | "stt" | "warm";

const num = (v: string | undefined, d: number) => (v === undefined || v === "" ? d : Number(v));

export class VoiceLimits {
  private perVisitor: Record<VoiceKind, SlidingWindow>;
  private ttsChars: SlidingWindow;
  private newVisitors: SlidingWindow;

  constructor(env: Record<string, string | undefined> = process.env, now: () => number = Date.now) {
    this.perVisitor = {
      tts: new SlidingWindow(num(env.VOICE_TTS_PER_MIN, 40), 60_000, now),
      stt: new SlidingWindow(num(env.VOICE_STT_PER_MIN, 20), 60_000, now),
      warm: new SlidingWindow(num(env.VOICE_WARM_PER_MIN, 10), 60_000, now),
    };
    this.ttsChars = new SlidingWindow(num(env.VOICE_TTS_CHARS_PER_10MIN, 4000), 600_000, now);
    // Teto global de identidades novas por minuto: impede "limpar o cookie" para ganhar cota infinita.
    this.newVisitors = new SlidingWindow(num(env.VOICE_NEW_VISITORS_PER_MIN, 30), 60_000, now);
  }

  check(visitorId: string, isNew: boolean, kind: VoiceKind, chars = 0): { ok: true } | { ok: false; retryAfterMs: number } {
    if (isNew) {
      const n = this.newVisitors.hit("global");
      if (!n.ok) return n;
    }
    const r = this.perVisitor[kind].hit(visitorId);
    if (!r.ok) return r;
    if (kind === "tts" && chars > 0) return this.ttsChars.hit(visitorId, chars);
    return { ok: true };
  }
}

const COOKIE = "guide_voice";
const TOKEN_RE = /^[0-9a-f]{32}$/;

export function identifyVoiceVisitor(req: Request): { id: string; isNew: boolean; setCookie?: string } {
  const values = (req.headers.get("cookie") ?? "").split(";").map((e) => e.trim()).filter((e) => e.startsWith(`${COOKIE}=`));
  const token = values.length === 1 ? values[0].slice(COOKIE.length + 1) : undefined;
  if (token && TOKEN_RE.test(token)) return { id: token, isNew: false };
  const id = randomBytes(16).toString("hex");
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return { id, isNew: true, setCookie: `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${secure}` };
}

const g = globalThis as unknown as { __voiceLimits?: VoiceLimits };
export const voiceLimits = () => (g.__voiceLimits ??= new VoiceLimits());
export function __resetVoiceLimitsForTests(): void {
  g.__voiceLimits = undefined;
}
