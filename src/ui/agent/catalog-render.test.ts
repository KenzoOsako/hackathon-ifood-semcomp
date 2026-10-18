import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { PlanoSnapshot } from "@/agent/types";
import { montarSacola } from "@/agent/sacola";
import { RevisaoView, SacolaView } from "./guide-telas";

// Fixture de contrato, não evidência de consulta autenticada ou disponibilidade no CDN.
const photo = "https://static.ifood-static.com.br/image/upload/t_medium/photo.jpg";
const logo = "https://static.ifood-static.com.br/image/upload/t_thumbnail/logo.jpg";
const plano: PlanoSnapshot = { planoId: "p", versao: 1, origem: "real", pendencias: [], naoAtendidas: [], blocos: [
  { necessidadeId: "n", vertical: "RESTAURANT", categoria: "pizza", quantidade: 1, alternativas: [], principal: { ref: "i", lojaId: "l", loja: "Loja", item: "Pizza", precoCents: 1000, rotulo: "mais barata", motivo: "Preço", origem: "real", imagemUrl: photo, logoUrl: logo } },
] };
it("renderiza foto e logo na revisão", () => {
  const html = renderToStaticMarkup(createElement(RevisaoView, { plano, busy: false, onSend() {}, onAdjust() {} }));
  expect(html).toContain(encodeURIComponent(photo));
  expect(html).toContain(encodeURIComponent(logo));
});
it("renderiza mídia na sacola somente da mesma versão aprovada", () => {
  const sacola = montarSacola(plano);
  const render = (versao: number) => renderToStaticMarkup(createElement(SacolaView, { plano: { ...plano, versao, sacola } }));
  expect(render(1)).toContain(encodeURIComponent(photo));
  expect(render(2)).not.toContain(encodeURIComponent(photo));
  expect(render(2)).not.toContain(encodeURIComponent(logo));
});
it("busca logo de outro item da mesma loja quando o primeiro não tem", () => {
  const primeiro = { ...plano.blocos[0], principal: { ...plano.blocos[0].principal, logoUrl: undefined } };
  const segundo = { ...plano.blocos[0], necessidadeId: "n2", principal: { ...plano.blocos[0].principal, ref: "i2" } };
  const html = renderToStaticMarkup(createElement(RevisaoView, { plano: { ...plano, blocos: [primeiro, segundo] }, busy: false, onSend() {}, onAdjust() {} }));
  expect(html).toContain(encodeURIComponent(logo));
});
