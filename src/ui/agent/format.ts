// Só formatação para exibição; a UI nunca soma nem recalcula valores.
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const fromReais = (value: number) => BRL.format(value);
export const fromCents = (cents: number) => BRL.format(cents / 100);

// O snapshot público só traz a referência do item; o nome vem de um mapa explícito ou da opção escolhida.
export function itemLabel(ref: string, option: { candidate: { itemId: string; itemName: string } } | null, names?: Record<string, string>) {
  if (names?.[ref]) return names[ref];
  return option?.candidate.itemId === ref ? option.candidate.itemName : `Item ${ref}`;
}
