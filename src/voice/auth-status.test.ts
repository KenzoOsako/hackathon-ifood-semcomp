import { describe, expect, it } from "vitest";
import { needsLogin } from "./auth-status";

describe("needsLogin", () => {
  it("só no modo real e sem conta conectada", () => {
    expect(needsLogin({ modo: "real", conectado: false })).toBe(true);
    expect(needsLogin({ modo: "real", conectado: true })).toBe(false);
    expect(needsLogin({ modo: "mock", conectado: false })).toBe(false);
  });
  it("resposta inesperada nunca mostra o botão", () => {
    for (const x of [null, undefined, {}, "x", { modo: "real" }, { conectado: false }]) expect(needsLogin(x)).toBe(false);
  });
});
