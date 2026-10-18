import { describe, expect, it } from "vitest";
import { catalogImage } from "./catalog-media";
import { paraOption } from "../agent/plano-tela";
import type { OpcaoPlano } from "@/agent/types";

const url = "https://static.ifood-static.com.br/image/upload/t_medium/item.jpg";
describe("mídia do catálogo", () => {
  it("preserva o recurso oficial completo", () => expect(catalogImage(url)).toBe(url));
  it.each([undefined, "", "/exemplos/falso.png", "http://static.ifood-static.com.br/image/upload/a.jpg", "https://evil.example/a.jpg", "https://static.ifood-static.com.br.evil.example/image/upload/a", "https://static.ifood-static.com.br@evil.example/image/upload/a", "https://static.ifood-static.com.br/outro/a", "data:image/png,a"])("rejeita origem/caminho inválido: %s", value => {
    expect(catalogImage(value)).toBeUndefined();
  });
  const option: OpcaoPlano = { ref: "item-a", lojaId: "loja-a", loja: "Loja", item: "Item", precoCents: 1000, rotulo: "mais barata", motivo: "Menor preço", origem: "real", imagemUrl: url, logoUrl: url };
  it("transporta mídia sem mudar preço ou identificadores", () => {
    const converted = paraOption(option);
    expect(converted.media).toEqual({ photo: url, logo: url });
    expect(converted.option.candidate).toMatchObject({ merchantId: "loja-a", itemId: "item-a", price: 10 });
  });
  it("não reaproveita a imagem anterior ao substituir um item", () => {
    expect(paraOption({ ...option, ref: "item-b", imagemUrl: undefined, logoUrl: undefined }).media).toEqual({ photo: undefined, logo: undefined });
    expect(paraOption({ ...option, imagemUrl: "https://evil.example/a" }).media.photo).toBeUndefined();
  });
  it("mantém mídia de demonstração somente na origem simulada", () => {
    expect(paraOption({ ...option, lojaId: "m-8", origem: "simulado" }).media.photo).toBe("/exemplos/bolo-chocolate.webp");
    expect(paraOption({ ...option, lojaId: "m-8", imagemUrl: undefined, logoUrl: undefined }).media.photo).toBeUndefined();
  });
});
