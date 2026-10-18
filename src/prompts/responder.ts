// Prompt de resposta (v1): transforma o snapshot do domínio em fala no tom do Guide.
// Estilo é do Felipe (docs/AGENTE_CONVERSA_E_FLUXO.md §5); fatos só do snapshot.
import type { PlanoSnapshot, ResponderInput } from "@/agent/types";

export const PROMPT_RESPONDER_VERSAO = "responder-v4";

export const SYSTEM_RESPONDER = `Você é o Guide, copiloto de compras do iFood. Você vai falar um plano que já foi montado.

# Tom
Assistente pessoal receptiva e objetiva. Português do Brasil, natural, ritmo ágil. Sem gírias, sem elogiar a escolha, sem pedir desculpa.

# Como falar
- Fala curta, para ser ouvida: no máximo duas frases curtas (até 25 palavras) mais o fecho. Sem preâmbulo ("incluí no plano", "montei") quando só há um item: vá direto ao item. Nada de listas, símbolos, markdown, emojis, colchetes ou tags.
- Para cada bloco, diga só a opção principal: item, loja e o rótulo dela (ex.: "a mais barata"). Alternativas ficam na tela.
- Se houver "mudou", fale SOMENTE o bloco que mudou.
- Bloco com "sugestao": true não foi pedido pelo usuário. Apresente como sugestão ("e sugiro pipoca para o filme"), nunca como se ele tivesse pedido.
- Se houver "assumido", diga em poucas palavras o que você assumiu.
- Nunca fale endereço, telefone, e-mail ou documento.
- Se houver necessidade não atendida, diga que ainda não tem essa opção.
- Bloco com cobertura "proxima": o catálogo NÃO tem o que foi pedido e este é o mais parecido. Diga "não achei <categoria>; o mais parecido é <item> da <loja>" e nunca o apresente como se fosse o pedido.
- Termine com "Quer ajustar algo?".

# Verdade
- Use apenas os dados do JSON. Não cite preço, nota, prazo ou motivo que não estejam nele. Não diga "muito pedido" nem "novo".
- Nunca diga que o pedido foi feito. Quem aprova é o usuário, e a compra termina no iFood.
- Só fale em confirmar a composição com a loja se uma pendência disser "restrição" (alergia ou intolerância). Pedido mínimo, quantidade estimada e "opções do item" NÃO são sobre composição: não os trate assim.
- Nunca use verbos de ação de compra ("adicionei", "coloquei no carrinho", "comprei", "reservei"): você monta um plano; quem aprova é o usuário e a compra termina no iFood. Diga "incluí no plano" ou "montei".`;

export function mensagemResponder(input: ResponderInput): string {
  return JSON.stringify({
    mudou: input.mudou ?? null,
    assumido: input.assumido,
    blocos: input.plano.blocos.map((b) => ({ categoria: b.categoria, quantidade: b.quantidade, item: b.principal.item, loja: b.principal.loja, rotulo: b.principal.rotulo, motivo: b.principal.motivo, sugestao: Boolean(b.sugestao), cobertura: b.cobertura ?? "exata" })),
    naoAtendidas: input.plano.naoAtendidas,
    pendencias: input.plano.pendencias,
  });
}

// Reserva determinística: usada se o LLM falhar, demorar ou citar número fora do snapshot.
export function respostaTemplate(input: ResponderInput): string {
  const blocos = input.mudou ? input.plano.blocos.filter((b) => b.categoria === input.mudou) : input.plano.blocos;
  const fala = (b: (typeof blocos)[number]) => `${b.quantidade > 1 ? `${b.quantidade}x ` : ""}${b.principal.item} da ${b.principal.loja}, ${b.principal.rotulo}`;
  const proximas = blocos.filter((b) => b.cobertura === "proxima");
  const normais = blocos.filter((b) => b.cobertura !== "proxima");
  const pedidas = normais.filter((b) => !b.sugestao).map(fala);
  const sugeridas = normais.filter((b) => b.sugestao).map(fala);
  const partes = pedidas.length ? [...pedidas] : [];
  if (sugeridas.length) partes.push(`${pedidas.length ? "e " : ""}como sugestão, ${sugeridas.join(" e ")}`);
  const inicio = input.mudou ? "Troquei: " : "Montei assim: ";
  const assumido = input.assumido.length ? ` Assumi ${input.assumido.join(" e ")}.` : "";
  const faltas = input.plano.naoAtendidas.length ? ` Ainda não tenho opção para ${input.plano.naoAtendidas.map((n) => n.categoria).join(" e ")}.` : "";
  // O que o catálogo não tem exato é dito como tal: "não achei X; o mais parecido é Y".
  const parecidas = proximas.map((b) => `Não achei ${b.categoria}; o mais parecido é ${b.principal.item} da ${b.principal.loja}.`).join(" ");
  const corpo = partes.length ? `${inicio}${partes.join("; ")}.` : "";
  return [corpo, parecidas].filter(Boolean).join(" ") + `${assumido}${faltas} Quer ajustar algo?`;
}

// Números citados na fala precisam existir no snapshot (preço, nota, quantidade, prazo).
export function numerosPermitidos(plano: PlanoSnapshot): Set<string> {
  const ok = new Set<string>();
  const add = (s: string) => { for (const m of s.match(/\d+(?:[.,]\d+)?/g) ?? []) ok.add(m.replace(".", ",")); };
  for (const b of plano.blocos) {
    add(b.categoria);
    for (const o of [b.principal, ...b.alternativas]) {
      add(o.loja); // "Loja 24h", "Padaria 2 Irmãos": o dígito do nome é fato do plano
      add((o.precoCents / 100).toFixed(2)); add(String(o.precoCents / 100));
      if (o.freteCents !== undefined) add((o.freteCents / 100).toFixed(2));
      if (o.nota !== undefined) add(String(o.nota));
      add(o.item); add(o.prazo ?? "");
    }
    add(String(b.quantidade));
  }
  plano.pendencias.forEach(add);
  plano.naoAtendidas.forEach((n) => add(n.categoria));
  return ok;
}

export function falaRespeitaSnapshot(fala: string, plano: PlanoSnapshot): boolean {
  const ok = numerosPermitidos(plano);
  return (fala.match(/\d+(?:[.,]\d+)?/g) ?? []).every((n) => ok.has(n.replace(".", ",")));
}
