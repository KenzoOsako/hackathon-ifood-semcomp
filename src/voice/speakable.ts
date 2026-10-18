// "Fala válida": verifica se um texto serve para ser FALADO pelo Guide. É um portão de qualidade para testes e evals
// (não bloqueia nada em produção). Regras vêm do guia de estilo de voz (docs/AGENTE_CONVERSA_E_FLUXO.md §5).
export interface SpeakableOptions {
  maxChars?: number; // fala longa cansa; o prompt pede no máximo três frases curtas
  maxSentences?: number;
}

const MARKDOWN = /[*#_`<>[\]{}|~\\]/;
const LIST_ITEM = /^\s*(?:[-•]|\d+[.)])\s+/m;
const EMOJI = /\p{Extended_Pictographic}/u;
const URL = /https?:\/\/|www\./i;
const PEDIDO_FEITO = /pedido (?:foi )?(?:feito|realizado|enviado|confirmado)|compra (?:foi )?(?:feita|realizada|conclu[ií]da)/i;
const DADO_SENSIVEL = /\bcpf\b|cart[aã]o|\bsenha\b/i;

export function speakableIssues(text: string, opts: SpeakableOptions = {}): string[] {
  const { maxChars = 400, maxSentences = 4 } = opts;
  const issues: string[] = [];
  const t = text.trim();
  if (!t) return ["vazio"];
  if (MARKDOWN.test(t)) issues.push("símbolo ou markdown");
  if (LIST_ITEM.test(t)) issues.push("lista");
  if (EMOJI.test(t)) issues.push("emoji");
  if (URL.test(t)) issues.push("endereço de internet");
  if (PEDIDO_FEITO.test(t)) issues.push("diz que o pedido foi feito");
  if (DADO_SENSIVEL.test(t)) issues.push("menciona dado sensível");
  if (t.length > maxChars) issues.push(`longa demais (${t.length} caracteres)`);
  // Frases: separa por . ! ? seguidos de espaço, sem contar decimais ("39,90") nem "R$".
  const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length > maxSentences) issues.push(`frases demais (${sentences.length})`);
  return issues;
}
