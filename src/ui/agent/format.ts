// Só formatação para exibição; a UI nunca soma nem recalcula valores.
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const fromReais = (value: number) => BRL.format(value);
export const fromCents = (cents: number) => BRL.format(cents / 100);
