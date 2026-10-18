// Palavras-chave do reconhecimento: ensinam ao STT os NOMES do nosso mundo (lojas, itens, o próprio "Guide").
// Medido em 17/10: com elas, "Pizzaria Nona" virou "Pizzaria Nonna". Fixas aqui; as dinâmicas (o que está na
// tela agora) chegam do cliente, sanitizadas. O provedor recusa caracteres estranhos (400), então limpamos.
export const BASE_KEYTERMS = [
  "Guide", "iFood", "calabresa", "margherita", "espetinho", "açaí", "smash", "cheddar", "X-Burger",
  "Pizzaria Nonna", "Forno e Cia", "Mercado do Bairro", "Mercado Central", "Lanchonete da Praça",
  "Burger do Zé", "Gourmet Smash", "Casa e Sabor", "Gamer Center", "Livraria Central",
  "pipoca de micro-ondas", "refrigerante", "lembrancinha",
];

const MAX_TERMS = 100;
const MAX_LEN = 50;

export function sanitizeTerm(raw: string): string | null {
  const t = raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} '-]/gu, " ") // só letras (com acento), números, espaço, hífen e apóstrofo
    .replace(/\s{2,}/g, " ")
    .trim();
  return t.length >= 2 && t.length <= MAX_LEN ? t : null;
}

export function buildKeyterms(dynamic: unknown = []): string[] {
  const extra = Array.isArray(dynamic) ? dynamic.filter((x): x is string => typeof x === "string").slice(0, 60) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...extra, ...BASE_KEYTERMS]) {
    const t = sanitizeTerm(raw);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
}

// Lê `?terms=<json>` (lista de textos). Entrada inválida é ignorada: nunca derruba o reconhecimento.
export function termsFromUrl(url: string): string[] {
  const raw = new URL(url).searchParams.get("terms");
  if (!raw || raw.length > 2500) return buildKeyterms();
  try {
    return buildKeyterms(JSON.parse(raw));
  } catch {
    return buildKeyterms();
  }
}
