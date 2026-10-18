// Sacola simulada: o que a tela mostra depois da aprovação explícita (docs/PLANO_TELA_GUIDE.md, passo 3).
// É só uma conta sobre o plano aprovado. Nada aqui chama o iFood: a chave não tem escopo de carrinho (F-002)
// e a compra final é no iFood. A tela não soma nada; subtotal, frete e total saem daqui.
import type { PlanoSnapshot, Sacola, SacolaLoja } from "./types";

export function montarSacola(plano: PlanoSnapshot): Sacola {
  const lojas = new Map<string, SacolaLoja>();
  for (const b of plano.blocos) {
    const o = b.principal;
    const loja = lojas.get(o.loja) ?? { loja: o.loja, itens: [], subtotalCents: 0, totalCents: 0, origem: o.origem };
    const subtotalCents = b.quantidade * o.precoCents;
    loja.itens.push({ ref: o.ref, item: o.item, categoria: b.categoria, quantidade: b.quantidade, precoCents: o.precoCents, subtotalCents });
    loja.subtotalCents += subtotalCents;
    // Frete é por loja, não por item: vale o primeiro informado para aquela loja.
    if (loja.freteCents === undefined && o.freteCents !== undefined) loja.freteCents = o.freteCents;
    if (o.origem === "simulado") loja.origem = "simulado";
    lojas.set(o.loja, loja);
  }
  const lista = [...lojas.values()].map((l) => ({ ...l, totalCents: l.subtotalCents + (l.freteCents ?? 0) }));
  return {
    planoId: plano.planoId,
    versao: plano.versao,
    lojas: lista,
    totalCents: lista.reduce((t, l) => t + l.totalCents, 0),
    freteDesconhecido: lista.some((l) => l.freteCents === undefined),
    simulacao: true,
  };
}
