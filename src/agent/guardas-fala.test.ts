import { describe, expect, it } from "vitest";

describe("urlDoIfood", () => {
  it("aceita só https do CDN do iFood", async () => {
    const { urlDoIfood } = await import("./guardas-fala");
    expect(urlDoIfood("https://static.ifood-static.com.br/image/upload/a.png")).toBeTruthy();
    expect(urlDoIfood("http://static.ifood-static.com.br/a.png")).toBeUndefined();
    expect(urlDoIfood("https://evil.com/static.ifood-static.com.br/a.png")).toBeUndefined();
    expect(urlDoIfood("javascript:alert(1)")).toBeUndefined();
    expect(urlDoIfood(42)).toBeUndefined();
  });
});
