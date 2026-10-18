import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetOAuth, conectado, concluirLogin, iniciarLogin, OAuthError, registrarCodigo, tokenValido } from "./oauth";

const env = { ...process.env };
beforeEach(() => {
  _resetOAuth();
  Object.assign(process.env, { IFOOD_CLIENT_ID: "cliente-teste", IFOOD_CLIENT_SECRET: "segredo-teste", IFOOD_CALLBACK_PORT: "8080" });
  delete process.env.IFOOD_REDIRECT_URI;
});
afterEach(() => { process.env = { ...env }; });

function tokenFetch(respostas: Record<string, unknown>[]) {
  const chamadas: URLSearchParams[] = [];
  const f = (async (_url: string, init?: RequestInit) => {
    chamadas.push(new URLSearchParams(String(init?.body)));
    const body = respostas.shift() ?? { error: "invalid_grant" };
    return new Response(JSON.stringify(body), { status: "access_token" in body ? 200 : 400 });
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

const stateDe = (url: string) => new URL(url).searchParams.get("state")!;

describe("OAuth iFood", () => {
  it("monta authorize com PKCE S256, redirect configurado e só escopos de leitura", () => {
    const u = new URL(iniciarLogin("sujeito-a"));
    expect(u.origin + u.pathname).toBe("https://id.ifood.com.br/authorize");
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:8080/callback");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")).not.toMatch(/cart|checkout|payment/);
    expect(u.toString()).not.toContain("segredo-teste");
  });

  it("troca o código, guarda o token no servidor e o state é de uso único", async () => {
    const state = stateDe(iniciarLogin("sujeito-a"));
    registrarCodigo(state, "codigo-1");
    const { f, chamadas } = tokenFetch([{ access_token: "tok-1", refresh_token: "ref-1", expires_in: 7200 }]);
    await concluirLogin(state, "sujeito-a", f);
    expect(conectado("sujeito-a")).toBe(true);
    expect(chamadas[0].get("code_verifier")).toBeTruthy();
    expect(() => registrarCodigo(state, "codigo-2")).toThrow(OAuthError);
    await expect(concluirLogin(state, "sujeito-a", f)).rejects.toThrow("STATE");
  });

  it("outro visitante não consegue concluir o login iniciado por alguém", async () => {
    const state = stateDe(iniciarLogin("vitima"));
    registrarCodigo(state, "codigo");
    const { f, chamadas } = tokenFetch([{ access_token: "x", expires_in: 3600 }]);
    await expect(concluirLogin(state, "atacante", f)).rejects.toThrow("STATE");
    expect(chamadas).toHaveLength(0);
    expect(conectado("atacante") || conectado("vitima")).toBe(false);
  });

  it("renova perto de expirar uma única vez, mesmo com chamadas concorrentes", async () => {
    const state = stateDe(iniciarLogin("s", 0));
    registrarCodigo(state, "c", 0);
    const { f, chamadas } = tokenFetch([{ access_token: "velho", refresh_token: "r1", expires_in: 600 }, { access_token: "novo", refresh_token: "r2", expires_in: 7200 }]);
    await concluirLogin(state, "s", f, 0);
    const agora = 400_000; // faltam 200 s: dentro da janela de 5 min
    const [a, b] = await Promise.all([tokenValido("s", f, agora), tokenValido("s", f, agora)]);
    expect([a, b]).toEqual(["novo", "novo"]);
    expect(chamadas.filter((c) => c.get("grant_type") === "refresh_token")).toHaveLength(1);
  });

  it("refresh recusado desconecta e pede login de novo", async () => {
    const state = stateDe(iniciarLogin("s", 0));
    registrarCodigo(state, "c", 0);
    const { f } = tokenFetch([{ access_token: "velho", refresh_token: "r1", expires_in: 60 }]);
    await concluirLogin(state, "s", f, 0);
    await expect(tokenValido("s", f, 30_000)).rejects.toThrow("LOGIN_NECESSARIO");
    expect(conectado("s")).toBe(false);
  });

  it("sem configuração não inicia login", () => {
    delete process.env.IFOOD_CLIENT_ID;
    expect(() => iniciarLogin("s")).toThrow("CONFIG");
  });
});
