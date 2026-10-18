// Imagens só do mock (exemplo do aniversário). O contrato do candidato ainda não tem campo de imagem,
// então a UI procura pelo merchantId; sem entrada aqui, o cartão usa o ícone neutro de sempre.
// Quando o MCP real trouxer imagens, isto some e o componente lê o campo do contrato.
export type MockMedia = { logo: string; photo: string };

const MEDIA: Record<string, MockMedia> = {
  "m-8": { logo: "/exemplos/logo-bolos-e-cia.png", photo: "/exemplos/bolo-chocolate.webp" },
  "m-9": { logo: "/exemplos/logo-casa-dos-presentes.png", photo: "/exemplos/rosa-vermelha.webp" },
};

export function mockMediaFor(merchantId: string): MockMedia | undefined {
  return MEDIA[merchantId];
}
