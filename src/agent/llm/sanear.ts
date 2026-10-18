// O modelo às vezes "dispara" num campo de texto curto (ex.: ocasiao.tipo vira uma frase sem espaços de
// 200 letras). Não vale perder o turno inteiro por um campo de enfeite: campo opcional fora do formato é
// descartado. Necessidades, restrições e intenção NÃO passam por aqui: seguem validadas à risca pelo schema.
const PALAVRA_LONGA = /\S{31,}/;
const curto = (v: unknown, max: number) => typeof v === "string" && v.length <= max && !PALAVRA_LONGA.test(v);

export function sanearTurno(bruto: unknown): unknown {
  if (!bruto || typeof bruto !== "object") return bruto;
  const t = structuredClone(bruto) as Record<string, unknown>;
  const ocasiao = t.ocasiao;
  if (ocasiao && typeof ocasiao === "object") {
    const o = ocasiao as Record<string, unknown>;
    for (const k of ["tipo", "quando", "local"]) if (k in o && !curto(o[k], 60)) delete o[k];
  }
  for (const k of ["pergunta", "confirmacao"]) if (k in t && !curto(t[k], 240)) delete t[k];
  if ("resposta" in t && !curto(t.resposta, 400)) delete t.resposta;
  if (Array.isArray(t.assumido)) t.assumido = t.assumido.filter((a) => curto(a, 120)).slice(0, 5);
  return t;
}
