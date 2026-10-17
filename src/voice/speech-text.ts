import { stripSpokenNoise } from "./guard";

// Transforma o texto da tela em texto FALADO. Voz não é legenda: sem markdown, valores por extenso
// e resposta curta (a tela mostra o resto). Função pura, sem rede.

const money = (reais: number, centavos: number): string => {
  const r = reais === 1 ? "1 real" : `${reais} reais`;
  if (centavos === 0) return r;
  const c = centavos === 1 ? "1 centavo" : `${centavos} centavos`;
  return reais === 0 ? c : `${r} e ${c}`;
};

export function normalizeForSpeech(input: string): string {
  let t = input
    .replace(/\[(?:simulado|simulada)\]\s*/gi, "Simulado: ");
  t = stripSpokenNoise(t)
    .replace(/[*_`#>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^\s*(\d+)\.\s+/gm, "Opção $1: ");
  // R$ 1.250,50 -> "1250 reais e 50 centavos"; R$ 16 -> "16 reais"
  t = t.replace(/R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/g, (_m, inteiro: string, dec?: string) => {
    const reais = Number(inteiro.replace(/\./g, ""));
    const centavos = dec ? Number(dec.padEnd(2, "0")) : 0;
    return money(reais, centavos);
  });
  t = t
    .replace(/\b(\d+)\s*min\b/gi, "$1 minutos")
    .replace(/\b(\d+(?:,\d+)?)\s*km\b/gi, "$1 quilômetros")
    .replace(/\bv(\d+)\b/g, "versão $1");
  // Quebras de linha viram pausa; espaços repetidos somem.
  return t.replace(/\s*\n+\s*/g, ". ").replace(/\.{2,}/g, ".").replace(/\s{2,}/g, " ").trim();
}

// Corta em fronteira de frase. O restante continua na tela; a voz não lê tudo.
export function limitSpeech(text: string, maxChars = 320): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const end = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
  return (end > 80 ? slice.slice(0, end + 1) : slice.replace(/\s+\S*$/, "")).trim();
}

export function toSpeech(text: string, maxChars = 320): string {
  return limitSpeech(normalizeForSpeech(text), maxChars);
}
