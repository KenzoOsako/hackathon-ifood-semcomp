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

describe("nomesForaDoPlano: começo de frase não é nome inventado", () => {
  const plano = { planoId: "p", versao: 1, naoAtendidas: [], pendencias: [], origem: "real" as const, blocos: [{ necessidadeId: "n", vertical: "RESTAURANT" as const, categoria: "pizza", quantidade: 1, principal: { ref: "a", loja: "Forno e Cia", item: "pizza calabresa", precoCents: 3990, rotulo: "mais barata", motivo: "m", origem: "real" as const }, alternativas: [] }] };
  it("pergunta depois de quebra de linha ou de frase", async () => {
    const { nomesForaDoPlano } = await import("./guardas-fala");
    expect(nomesForaDoPlano("Separei a pizza da Forno e Cia.\n\nQuer seguir ou ajustar?", plano)).toEqual([]);
    expect(nomesForaDoPlano("Separei a pizza\nQuer ajustar?", plano)).toEqual([]);
    expect(nomesForaDoPlano("Separei a pizza do Zé Burger e mais.", plano)).toEqual(["Burger"]);
  });
});
