// Política de apresentação: mesma origem do guarda do agente, limitada ao caminho de imagens.
// Não importa o guarda inteiro (que também depende de voz/prompts) no bundle da interface.
export function catalogImage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 400) return undefined;
  return /^https:\/\/static\.ifood-static\.com\.br\/image\/upload\/[\w\-./%?=&,]+$/.test(value) ? value : undefined;
}

export type CatalogMedia = { photo?: string; logo?: string };
