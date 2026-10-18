// Descrição do estabelecimento para o cartão de sugestão da interface. Montada SÓ de campos reais da opção (nada que o
// modelo escreva): nota, avaliações, distância, prazo, frete, pedido mínimo e promoção. Campo ausente some da frase.
// A interface pode montar o próprio layout com os campos estruturados; esta é a versão em uma linha.
export interface DadosDescricao {
  nota?: number;
  avaliacoes?: number;
  distanciaKm?: number;
  prazo?: string;
  freteCents?: number;
  pedidoMinimoCents?: number;
  precoCents: number;
  precoOriginalCents?: number;
}

const reais = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const num = (n: number) => String(n).replace(".", ",");

export function descricaoDe(d: DadosDescricao): string {
  const partes: string[] = [];
  if (d.nota !== undefined) partes.push(`nota ${num(d.nota)}${d.avaliacoes ? ` (${d.avaliacoes} avaliações)` : ""}`);
  if (d.distanciaKm !== undefined) partes.push(`a ${num(d.distanciaKm)} km`);
  if (d.prazo) partes.push(`entrega ${d.prazo}`);
  if (d.freteCents !== undefined) partes.push(d.freteCents === 0 ? "frete grátis" : `frete ${reais(d.freteCents)}`);
  if (d.pedidoMinimoCents) partes.push(`pedido mínimo ${reais(d.pedidoMinimoCents)}`);
  if (d.precoOriginalCents && d.precoOriginalCents > d.precoCents) partes.push(`em promoção (de ${reais(d.precoOriginalCents)})`);
  return partes.join(" · ");
}
