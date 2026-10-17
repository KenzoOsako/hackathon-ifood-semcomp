import { describe, expect, it } from "vitest";
import { VisitorSessions } from "./visitor-session";

const req = (cookie?: string) => new Request("https://demo.invalid/api/chat", { headers: cookie ? { cookie } : {} });
describe("sessão efêmera do visitante", () => {
  it("gera cookie seguro e não adota token escolhido pelo cliente", () => {
    const sessions = new VisitorSessions(2); const result = sessions.resolve(req("foodpilot_visitor=chosen"), true);
    expect(result.cookie).toContain("HttpOnly"); expect(result.cookie).toContain("SameSite=Strict"); expect(result.cookie).toContain("Secure");
    expect(result.cookie).not.toContain("chosen");
    expect(sessions.resolve(req(result.cookie!.split(";")[0]), false).visitor).toBe(result.visitor);
  });
  it("expira em 30 minutos absolutos e recupera capacidade", () => {
    let time = 0; const sessions = new VisitorSessions(1, () => time);
    const first = sessions.resolve(req(), true); const cookie = first.cookie!.split(";")[0];
    expect(() => sessions.resolve(req(), true)).toThrow();
    time = 30 * 60_000;
    expect(() => sessions.resolve(req(cookie), false)).toThrow();
    expect(sessions.resolve(req(), true).visitor).not.toBe(first.visitor);
  });
  it("nega cookie duplicado e sessão expirada durante I/O", async () => {
    let time = 0; const sessions = new VisitorSessions(1, () => time);
    const result = sessions.resolve(req(), true); const cookie = result.cookie!.split(";")[0];
    expect(() => sessions.resolve(req(`${cookie}; ${cookie}`), false)).toThrow();
    await expect(sessions.run(result.visitor, () => { time = 30 * 60_000; return "privado"; })).rejects.toThrow();
  });
});
