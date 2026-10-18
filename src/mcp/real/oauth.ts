// OAuth 2.1 + PKCE com o servidor do iFood (anunciado pelo MCP em
// /.well-known/oauth-protected-resource/marketplace). Cliente pré-registrado (Client ID/Secret do portal).
// Tokens só no servidor, em RAM, presos ao sujeito da sessão de visitante (mesmo limite de D-010).
import { createHash, randomBytes } from "node:crypto";

const AUTH_URL = "https://id.ifood.com.br/authorize";
const TOKEN_URL = "https://id.ifood.com.br/token";
// Só leitura: o agente não tem carrinho nem checkout (compra final no iFood).
export const ESCOPOS = ["mcp.user.addresses.read", "mcp.discovery.search.read", "mcp.discovery.browse.read", "mcp.discovery.recommendation.read", "mcp.discovery.details.read"];
// Extras opcionais, separados por espaço ou vírgula (ex.: IFOOD_SCOPES_EXTRA=mcp.user.basic.read para o nome da conta).
// Só entram se pedidos de propósito: um escopo que o portal não aprovou faz o login falhar com invalid_scope.
export function escoposDoLogin(env: NodeJS.ProcessEnv = process.env): string[] {
  const extras = (env.IFOOD_SCOPES_EXTRA ?? "").split(/[\s,]+/).filter((e) => /^mcp\.[a-z.]+$/.test(e));
  return [...new Set([...ESCOPOS, ...extras])];
}
const PENDENTE_TTL_MS = 10 * 60_000;
const RENOVAR_ANTES_MS = 5 * 60_000;
const MAX_ENTRADAS = 1000;

export class OAuthError extends Error {
  constructor(readonly code: "CONFIG" | "STATE" | "TOKEN" | "LOGIN_NECESSARIO") { super(code); }
}

interface Config { clientId: string; clientSecret: string; redirectUri: string }
export function config(env: NodeJS.ProcessEnv = process.env): Config {
  const clientId = env.IFOOD_CLIENT_ID?.trim(); const clientSecret = env.IFOOD_CLIENT_SECRET?.trim();
  const redirectUri = env.IFOOD_REDIRECT_URI?.trim() || (env.IFOOD_CALLBACK_PORT ? `http://localhost:${env.IFOOD_CALLBACK_PORT.trim()}/callback` : undefined);
  if (!clientId || !clientSecret || !redirectUri) throw new OAuthError("CONFIG");
  return { clientId, clientSecret, redirectUri };
}

interface Pendente { subjectRef: string; verifier: string; criadoEm: number; code?: string }
interface Tokens { access: string; refresh?: string; expiraEm: number }

const g = globalThis as unknown as { __ifoodOAuth?: { pendentes: Map<string, Pendente>; tokens: Map<string, Tokens>; renovando: Map<string, Promise<Tokens>> } };
const store = (g.__ifoodOAuth ??= { pendentes: new Map(), tokens: new Map(), renovando: new Map() });

const b64url = (b: Buffer) => b.toString("base64url");
function limitar<K, V>(m: Map<K, V>) { while (m.size > MAX_ENTRADAS) m.delete(m.keys().next().value!); }

export function iniciarLogin(subjectRef: string, now = Date.now()): string {
  const c = config();
  for (const [k, p] of store.pendentes) if (now - p.criadoEm > PENDENTE_TTL_MS) store.pendentes.delete(k);
  const verifier = b64url(randomBytes(48));
  const state = b64url(randomBytes(24));
  store.pendentes.set(state, { subjectRef, verifier, criadoEm: now });
  limitar(store.pendentes);
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    response_type: "code", client_id: c.clientId, redirect_uri: c.redirectUri, scope: escoposDoLogin().join(" "), state,
    code_challenge: b64url(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

// Etapa 1 do retorno: o callback chega por navegação vinda do iFood, sem o cookie SameSite=Strict.
// Só guarda o código; a troca acontece em concluirLogin, já com o cookie, para amarrar ao mesmo visitante.
export function registrarCodigo(state: string, code: string, now = Date.now()) {
  const p = store.pendentes.get(state);
  if (!p || p.code || now - p.criadoEm > PENDENTE_TTL_MS || !code) throw new OAuthError("STATE");
  p.code = code;
}

export async function concluirLogin(state: string, subjectRef: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<void> {
  const p = store.pendentes.get(state);
  // Uso único e mesmo visitante que iniciou: evita amarrar a conta iFood de alguém à sessão de outro.
  store.pendentes.delete(state);
  if (!p?.code || p.subjectRef !== subjectRef || now - p.criadoEm > PENDENTE_TTL_MS) throw new OAuthError("STATE");
  const c = config();
  const tokens = await pedirToken(fetcher, { grant_type: "authorization_code", code: p.code, redirect_uri: c.redirectUri, code_verifier: p.verifier }, now);
  store.tokens.set(subjectRef, tokens);
  limitar(store.tokens);
}

async function pedirToken(fetcher: typeof fetch, corpo: Record<string, string>, now: number): Promise<Tokens> {
  const c = config();
  const res = await fetcher(TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...corpo, client_id: c.clientId, client_secret: c.clientSecret }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!res.ok || !body.access_token) throw new OAuthError("TOKEN");
  // Usar a duração recebida, não um valor fixo.
  return { access: body.access_token, refresh: body.refresh_token, expiraEm: now + (body.expires_in ?? 3600) * 1000 };
}

export function conectado(subjectRef: string): boolean { return store.tokens.has(subjectRef); }
export function desconectar(subjectRef: string) { store.tokens.delete(subjectRef); store.renovando.delete(subjectRef); }

export async function tokenValido(subjectRef: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<string> {
  const t = store.tokens.get(subjectRef);
  if (!t) throw new OAuthError("LOGIN_NECESSARIO");
  if (t.expiraEm - now > RENOVAR_ANTES_MS) return t.access;
  if (!t.refresh) { desconectar(subjectRef); throw new OAuthError("LOGIN_NECESSARIO"); }
  // Uma renovação por vez: duas concorrentes sobrescreveriam o par de tokens.
  let emCurso = store.renovando.get(subjectRef);
  if (!emCurso) {
    emCurso = pedirToken(fetcher, { grant_type: "refresh_token", refresh_token: t.refresh }, now)
      .then((novo) => { store.tokens.set(subjectRef, { ...novo, refresh: novo.refresh ?? t.refresh }); return novo; })
      .catch((e) => { desconectar(subjectRef); throw e instanceof OAuthError ? new OAuthError("LOGIN_NECESSARIO") : e; })
      .finally(() => store.renovando.delete(subjectRef));
    store.renovando.set(subjectRef, emCurso);
  }
  return (await emCurso).access;
}

// Só para testes.
export function _resetOAuth() { store.pendentes.clear(); store.tokens.clear(); store.renovando.clear(); }
