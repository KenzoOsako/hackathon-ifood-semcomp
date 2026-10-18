// Mecanismos de segurança da CAMADA DE VOZ. Funções puras, sem rede.
// Limite honesto: são proteções de borda. Regras críticas (aprovar, total, filtros, não comprar)
// continuam sendo CÓDIGO do domínio (src/domain); nada aqui aprova ou compra.

// 1) Texto falado limpo: sem tags de áudio, URLs, blocos de código ou chamadas de ferramenta.
export function stripSpokenNoise(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[[^\]\n]{1,40}\]/g, " ") // tags como [happy], [calm]
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<[^>\n]{1,60}>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// 2) Dados sensíveis: mascarar ANTES de enviar ao modelo ou gravar em log.
const onlyDigits = (s: string) => s.replace(/\D/g, "");

function luhn(num: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export interface Redaction {
  text: string;
  found: Array<"cpf" | "cnpj" | "cartao" | "email">;
}

export function redactSensitive(input: string): Redaction {
  const found: Redaction["found"] = [];
  let text = input;
  const mark = (kind: Redaction["found"][number]) => {
    if (!found.includes(kind)) found.push(kind);
    return "[dado removido]";
  };
  text = text.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, () => mark("email"));
  // CNPJ (14 dígitos), CPF (11), cartão (13 a 19 com Luhn). Separadores comuns são aceitos.
  text = text.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, () => mark("cnpj"));
  text = text.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, () => mark("cpf"));
  text = text.replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => {
    const d = onlyDigits(m);
    return d.length >= 13 && d.length <= 19 && luhn(d) ? mark("cartao") : m;
  });
  return { text, found };
}

// 3) Intenção de aprovar por voz. NUNCA aprova: só indica que a interface deve pedir a confirmação
// explícita (toque, ou frase com a versão). Um "sim" isolado não é aprovação.
export interface ApprovalIntent {
  intent: "approve" | "none";
  version?: number;
}

const NUMBER_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5 };

export function detectApprovalIntent(text: string): ApprovalIntent {
  const t = text.toLowerCase().normalize("NFC");
  const verb = /\b(aprovo|aprovar|aprovado|confirmo|pode aprovar|pode confirmar)\b/.test(t);
  const object = /\b(plano|proposta|pedido|vers[aã]o)\b/.test(t);
  if (!verb || !object) return { intent: "none" };
  const m = t.match(/vers[aã]o\s+(\d+|um|uma|dois|duas|tr[eê]s|quatro|cinco)\b/);
  const version = m ? (NUMBER_WORDS[m[1]] ?? Number(m[1])) : undefined;
  return { intent: "approve", ...(version && Number.isFinite(version) ? { version } : {}) };
}

// 4) Tentativa de manipular o agente. Heurística: o fluxo decide recusar e registrar o evento.
const INJECTION = [
  /ignor(e|ar)\s+(todas?\s+)?(as\s+)?(suas\s+)?(instru[cç][õo]es|regras)/,
  /esque[cç]a\s+(tudo|as\s+regras|as\s+instru[cç][õo]es)/,
  /voc[eê]\s+agora\s+[eé]\s+/,
  /(revele|mostre|diga|repita).{0,30}(prompt|instru[cç][õo]es|regras)/,
  /(modo|mode)\s+(desenvolvedor|developer|admin)/,
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/,
  /system\s+prompt|prompt\s+do\s+sistema/,
];

export function looksLikeInjection(text: string): boolean {
  const t = text.toLowerCase();
  return INJECTION.some((re) => re.test(t));
}
