// CONTRATO DO FLUXO EM PEDAÇOS entre o backend (Hyago: /api/converse) e a voz (Felipe).
// Formato: NDJSON (um evento JSON por linha), na ordem em que ficam prontos. A voz toca `speech` assim que
// chega, enquanto o backend ainda trabalha no resto. Mudar este arquivo exige avisar os dois lados.
import { z } from "zod";

export const ConverseEventSchema = z.discriminatedUnion("type", [
  // Reconhecimento imediato, só quando o trabalho vai demorar ("Já vejo isso para você."). Opcional.
  z.strictObject({ type: z.literal("ack"), text: z.string().trim().min(1).max(120) }),
  // Um pedaço para FALAR. `seq` começa em 0 e cresce de 1 em 1; `final` marca o último pedaço do turno.
  z.strictObject({ type: z.literal("speech"), seq: z.number().int().nonnegative(), text: z.string().trim().min(1).max(600), final: z.boolean().optional() }),
  // Evento para a TELA (snapshot do plano etc.). A voz não interpreta; repassa à interface.
  z.strictObject({ type: z.literal("screen"), event: z.string().min(1).max(60), payload: z.unknown() }),
  // Fim do turno. `turnId` permite descartar eventos de um turno que foi interrompido.
  z.strictObject({ type: z.literal("done"), turnId: z.string().min(1).max(64) }),
  // Falha do turno. `reply` é uma frase curta e segura para mostrar e falar.
  z.strictObject({ type: z.literal("error"), code: z.string().min(1).max(40), reply: z.string().trim().min(1).max(300) }),
]);
export type ConverseEvent = z.infer<typeof ConverseEventSchema>;

// Lê um corpo NDJSON em fluxo. Linhas inválidas viram um evento `error` (sem derrubar o turno inteiro).
export async function* readConverseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<ConverseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  const parse = (line: string): ConverseEvent | null => {
    if (!line.trim()) return null;
    try {
      const r = ConverseEventSchema.safeParse(JSON.parse(line));
      return r.success ? r.data : { type: "error", code: "EVENTO_INVALIDO", reply: "Resposta inválida do assistente." };
    } catch {
      return { type: "error", code: "EVENTO_INVALIDO", reply: "Resposta inválida do assistente." };
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const ev = parse(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
        if (ev) yield ev;
      }
    }
    buf += decoder.decode();
    const last = parse(buf);
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

export function encodeEvent(ev: ConverseEvent): string {
  return JSON.stringify(ConverseEventSchema.parse(ev)) + "\n";
}
