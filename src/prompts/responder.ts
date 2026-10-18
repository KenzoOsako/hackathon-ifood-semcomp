// Prompt de resposta (v1): transforma o snapshot do domínio em fala no tom do Guide.
// Estilo é do Felipe (docs/AGENTE_CONVERSA_E_FLUXO.md §5); fatos só do snapshot.
import type { PlanoSnapshot, ResponderInput } from "@/agent/types";

export const PROMPT_RESPONDER_VERSAO = "responder-v2";

export const SYSTEM_RESPONDER = `Você é o Guide, copiloto de compras do iFood. Você vai falar um plano que já foi montado.

# Tom
Assistente pessoal receptiva e objetiva. Português do Brasil, natural, ritmo ágil. Sem gírias, sem elogiar a escolha, sem pedir desculpa.

# Como falar
- No máximo três frases curtas. Nada de listas, símbolos, markdown, emojis, colchetes ou tags.
- Escreva preço, tempo, nota e quantidade sempre em **algarismos** ("R$ 39,90", "35 minutos", "nota 4,4", "2 itens"). Nunca por extenso: a camada de voz converte para fala, e o número em algarismo é o que permite conferir a fala contra o plano.
- Para cada bloco, diga só a opção principal: item, loja e o rótulo dela (ex.: "a mais barata"). Alternativas ficam na tela.
- Se houver "mudou", fale SOMENTE o bloco que mudou.
- Se houver "assumido", diga em poucas palavras o que você assumiu.
- Se houver necessidade não atendida, diga que ainda não tem essa opção.
- Termine com "Quer ajustar algo?".

# Verdade
- Use apenas os dados do JSON. Não cite preço, nota, prazo ou motivo que não estejam nele. Não diga "muito pedido" nem "novo".
- Nunca diga que o pedido foi feito. Quem aprova é o usuário, e a compra termina no iFood.
- Se houver restrição nas pendências, diga que é preciso confirmar a composição com a loja.`;

export function mensagemResponder(input: ResponderInput): string {
  return JSON.stringify({
    mudou: input.mudou ?? null,
    assumido: input.assumido,
    blocos: input.plano.blocos.map((b) => ({ categoria: b.categoria, quantidade: b.quantidade, item: b.principal.item, loja: b.principal.loja, rotulo: b.principal.rotulo, motivo: b.principal.motivo })),
    naoAtendidas: input.plano.naoAtendidas,
    pendencias: input.plano.pendencias,
  });
}

// Reserva determinística: usada se o LLM falhar, demorar ou citar número fora do snapshot.
export function respostaTemplate(input: ResponderInput): string {
  const blocos = input.mudou ? input.plano.blocos.filter((b) => b.categoria === input.mudou) : input.plano.blocos;
  const partes = blocos.map((b) => {
    const prefixo = b.quantidade > 1 ? `${b.quantidade}x ` : "";
    return `${prefixo}${b.principal.item} da ${b.principal.loja}, ${b.principal.rotulo}`;
  });
  const inicio = input.mudou ? "Troquei: " : "Montei assim: ";
  const assumido = input.assumido.length ? ` Assumi ${input.assumido.join(" e ")}.` : "";
  const faltas = input.plano.naoAtendidas.length ? ` Ainda não tenho opção para ${input.plano.naoAtendidas.map((n) => n.categoria).join(" e ")}.` : "";
  return `${inicio}${partes.join("; ")}.${assumido}${faltas} Quer ajustar algo?`;
}

// Números citados na fala precisam existir no snapshot (preço, nota, quantidade, prazo).
export function numerosPermitidos(plano: PlanoSnapshot): Set<string> {
  const ok = new Set<string>();
  const add = (s: string) => { for (const m of s.match(/\d+(?:[.,]\d+)?/g) ?? []) ok.add(m.replace(".", ",")); };
  for (const b of plano.blocos) {
    for (const o of [b.principal, ...b.alternativas]) {
      add((o.precoCents / 100).toFixed(2)); add(String(o.precoCents / 100));
      if (o.freteCents !== undefined) add((o.freteCents / 100).toFixed(2));
      if (o.nota !== undefined) add(String(o.nota));
      add(o.item); add(o.prazo ?? "");
    }
    add(String(b.quantidade));
  }
  plano.pendencias.forEach(add);
  return ok;
}

export function falaRespeitaSnapshot(fala: string, plano: PlanoSnapshot): boolean {
  const ok = numerosPermitidos(plano);
  return (fala.match(/\d+(?:[.,]\d+)?/g) ?? []).every((n) => ok.has(n.replace(".", ",")));
}
