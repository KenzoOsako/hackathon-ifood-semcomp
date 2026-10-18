// Guardas HTTP das rotas de voz. Mesma política do chat (origem same-origin, corpo limitado),
// mas SEM depender de MCP_MODE: voz não acessa dado privado e não pode quebrar quando o MCP for real.
export type VoiceHttpCode = "FORBIDDEN" | "BAD_REQUEST" | "TOO_LARGE" | "UNSUPPORTED" | "RATE_LIMITED";

export class VoiceHttpError extends Error {
  constructor(public code: VoiceHttpCode, public retryAfterMs?: number) {
    super(code);
  }
}

const HOST_RE = /^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(?::\d{1,5})?$/;

export function requireSameOrigin(req: Request, allowedContentTypes: string[]): void {
  const origin = req.headers.get("origin");
  const expected = new URL(req.url);
  // Host é a autoridade recebida pelo servidor; X-Forwarded-Host do cliente não é aceito.
  const host = req.headers.get("host");
  if (host) {
    if (!HOST_RE.test(host)) throw new VoiceHttpError("FORBIDDEN");
    expected.host = host;
  }
  if (origin !== expected.origin || req.headers.get("sec-fetch-site") === "cross-site") throw new VoiceHttpError("FORBIDDEN");
  const type = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const ok = !!type && allowedContentTypes.some((a) => (a.endsWith("/*") ? type.startsWith(a.slice(0, -1)) : type === a));
  if (!ok) throw new VoiceHttpError("UNSUPPORTED");
}

// Limita os bytes DURANTE a leitura, sem confiar só no Content-Length.
export async function readLimited(req: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new VoiceHttpError("TOO_LARGE");
  const reader = req.body?.getReader();
  if (!reader) throw new VoiceHttpError("BAD_REQUEST");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new VoiceHttpError("TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export async function readJson(req: Request, maxBytes = 16_384): Promise<unknown> {
  const bytes = await readLimited(req, maxBytes);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new VoiceHttpError("BAD_REQUEST");
  }
}

const STATUS: Record<VoiceHttpCode, number> = { FORBIDDEN: 403, BAD_REQUEST: 400, TOO_LARGE: 413, UNSUPPORTED: 415, RATE_LIMITED: 429 };
const REPLY: Record<VoiceHttpCode, string> = {
  FORBIDDEN: "Sessão ou origem inválida. Recarregue a página.",
  BAD_REQUEST: "Dados inválidos.",
  TOO_LARGE: "Áudio ou texto grande demais.",
  UNSUPPORTED: "Formato não suportado.",
  RATE_LIMITED: "Muitas solicitações de voz. Aguarde um instante ou use o texto.",
};

export function voiceHttpErrorResponse(error: VoiceHttpError): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (error.code === "RATE_LIMITED") headers["Retry-After"] = String(Math.ceil((error.retryAfterMs ?? 1000) / 1000));
  return Response.json({ state: "FALHA", code: error.code, reply: REPLY[error.code] }, { status: STATUS[error.code], headers });
}

// Anexa o cookie anônimo de voz (se este visitante é novo) à resposta.
export function withVisitorCookie(res: Response, setCookie?: string): Response {
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}
