import { z } from "zod";
import { ProposalError } from "./proposals";

export function requireMockRequest(req: Request): void {
  // Não habilitar dados privados/OAuth com sessão anônima do protótipo.
  if ((process.env.MCP_MODE ?? "mock") !== "mock") throw new ProposalError("UNAVAILABLE");
  requireSameOriginJson(req);
}

// Origem e corpo JSON da mesma página. No modo real, quem chama também exige o login iFood da sessão
// (src/mcp/real/oauth.ts); esta função sozinha não autoriza dado privado.
export function requireSameOriginJson(req: Request): void {
  const origin = req.headers.get("origin");
  const expected = new URL(req.url);
  // Next pode normalizar req.url para localhost. Host é a autoridade recebida
  // pelo servidor; não aceitar X-Forwarded-Host fornecido pelo cliente.
  const host = req.headers.get("host");
  if (host) {
    if (!/^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(?::\d{1,5})?$/.test(host)) throw new ProposalError("AUTH_REQUIRED");
    expected.host = host;
    if (expected.host.toLowerCase() !== host.toLowerCase()) throw new ProposalError("AUTH_REQUIRED");
  }
  if (origin !== expected.origin || req.headers.get("sec-fetch-site") === "cross-site") throw new ProposalError("AUTH_REQUIRED");
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ProposalError("INVALID_DATA");
}

export async function jsonBody(req: Request): Promise<unknown> {
  // Limitar bytes durante leitura, não apenas confiar em Content-Length.
  const reader = req.body?.getReader();
  if (!reader) throw new ProposalError("INVALID_DATA");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16_384) { await reader.cancel(); throw new ProposalError("INVALID_DATA"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { throw new ProposalError("INVALID_DATA"); }
  finally { reader.releaseLock(); }
}

export function jsonResponse(data: unknown, status = 200, cookie?: string): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}

export function failureResponse(error: unknown, cookie?: string): Response {
  const code = error instanceof ProposalError ? error.code : error instanceof z.ZodError ? "INVALID_DATA" : "UNAVAILABLE";
  const statuses = { AUTH_REQUIRED: 403, INVALID_DATA: 400, STALE_PROPOSAL: 409, EXPIRED: 410, UNAVAILABLE: 503 };
  const replies = {
    AUTH_REQUIRED: "Sessão ou origem inválida. Recomece a conversa nesta página.",
    INVALID_DATA: "Dados inválidos ou proposta com pendências. Revise antes de aprovar.",
    STALE_PROPOSAL: "Proposta alterada, já processada ou operação em andamento. Revise a versão atual.",
    EXPIRED: "Proposta expirada. Faça uma nova busca e revise novamente.",
    UNAVAILABLE: "Recurso indisponível. O fluxo real continua desabilitado; tente novamente mais tarde.",
  };
  return jsonResponse({ state: "FALHA", code, reply: replies[code] }, statuses[code], cookie);
}
