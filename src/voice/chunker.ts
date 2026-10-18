// Divide texto em PEDAÇOS FALÁVEIS. Objetivo: o primeiro pedaço sai cedo (a pessoa ouve algo logo) e os
// seguintes chegam antes de o anterior terminar. Funções puras; sem rede.

export interface ChunkOptions {
  firstMinChars: number; // o primeiro pedaço pode ser curto: reduz o tempo até o primeiro áudio
  minChars: number; // pedaços seguintes: evita micro-frases que soam picotadas
  maxChars: number; // acima disso, corta numa vírgula/ponto e vírgula/dois-pontos
}

export const DEFAULT_CHUNK: ChunkOptions = { firstMinChars: 12, minChars: 28, maxChars: 200 };

// Evita cortar em "R$ 39,90", "1,2 km", "3.5", "Sr.", "Dr.", "etc.".
const ABBREV = /(?:\b(?:sr|sra|dr|dra|etc|ex|av|r|nº|n)\.)$/i;

function endsSentence(buf: string, i: number): boolean {
  const c = buf[i];
  if (c !== "." && c !== "!" && c !== "?" && c !== "…") return false;
  const next = buf[i + 1];
  // Ponto no fim do que já chegou é ambíguo ("4." pode virar "4.5"): só vale quando vier o próximo caractere
  // (ou no flush). "!", "?" e "…" já bastam.
  if (next === undefined) return c !== ".";
  if (!/\s/.test(next)) return false; // "39,90" ou "e.g." não terminam frase
  if (c === "." && ABBREV.test(buf.slice(Math.max(0, i - 6), i + 1))) return false;
  return true;
}

export class SpeechChunker {
  private buf = "";
  private emitted = 0;

  constructor(private opts: ChunkOptions = DEFAULT_CHUNK) {}

  private min(): number {
    return this.emitted === 0 ? this.opts.firstMinChars : this.opts.minChars;
  }

  private take(end: number, out: string[]) {
    const piece = this.buf.slice(0, end).trim();
    this.buf = this.buf.slice(end);
    if (piece) {
      out.push(piece);
      this.emitted++;
    }
  }

  // Recebe um trecho novo (por exemplo, tokens do modelo) e devolve os pedaços que já estão prontos.
  push(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    for (;;) {
      let cut = -1;
      for (let i = 0; i < this.buf.length; i++) {
        if (endsSentence(this.buf, i) && i + 1 >= this.min()) { cut = i + 1; break; }
      }
      // frase longa demais sem ponto: corta na última vírgula (ou similar) antes do limite
      if (cut < 0 && this.buf.length > this.opts.maxChars) {
        const window = this.buf.slice(0, this.opts.maxChars);
        const comma = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": "));
        cut = comma > this.min() ? comma + 1 : window.lastIndexOf(" ") > this.min() ? window.lastIndexOf(" ") : this.opts.maxChars;
      }
      if (cut < 0) break;
      this.take(cut, out);
    }
    return out;
  }

  // Fim do texto: devolve o que sobrou.
  flush(): string[] {
    const out: string[] = [];
    this.take(this.buf.length, out);
    return out;
  }
}

export function splitSpeechChunks(text: string, opts: ChunkOptions = DEFAULT_CHUNK): string[] {
  const c = new SpeechChunker(opts);
  return [...c.push(text), ...c.flush()];
}
