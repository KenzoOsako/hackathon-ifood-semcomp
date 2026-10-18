// ATENDENTE COM FERRAMENTAS: o agente do Guide. Uma cabeça só: o LLM vê a conversa inteira, conversa, pesquisa
// no iFood quando precisa e decide quando mostrar o plano, como um atendente de balcão. O código não decide a conversa;
// só guarda o que é proibido: aprovação só pela frase explícita da versão na tela, nada de álcool, sem dado pessoal,
// preço e loja só do que o iFood devolveu. Ferramentas só de leitura (nenhuma compra, carrinho ou pedido).
// Substituiu o agente por regras (orquestrador + formulário), que tomava decisões ruins nos fallbacks (18/10/2026).
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { FRASES, LIMIARES_CONFIANCA } from "../frases";
import { sanearPlano, limparNome } from "../guardas-fala";
import { configurarItem, detalharPlano, impedimentosPlano, resumoComplementos } from "../complementos";
import { temDadoPessoal } from "../privacidade";
import { montarSacola } from "../sacola";
import type { AgentReply, AgentSession, ConverseInput, DomainPort, Necessidade, OpcaoPlano, PlanoSnapshot } from "../types";

const MAX_PASSOS = 4;          // rodadas de ferramenta por turno (buscar, buscar, mostrar...)
const TIMEOUT_MS = 12_000;     // por chamada ao modelo
const HISTORICO = 16;          // mensagens da conversa que o modelo vê
const OPCOES_POR_BUSCA = 6;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const APROVACAO_EXPLICITA = /^(aprovo|confirmo)( o)? plano(?: versao \d+)?$/;
const VERSAO_CITADA = /\bversao (\d+)\b/;
const FECHAR = /^(pode|pode fechar|fecha|fechou|fechado|fecha assim|pode ser|isso|isso mesmo|ok|beleza|sim|bora|vamos fechar|quero fechar|fechar)$/;
const ALCOOL = /cerveja|vinho|vodka|whisky|cacha[cç]a|gin\b|licor|drink|chopp|alco[oó]l/i;
const PROIBIDO = /pedido (foi )?(feito|realizado|enviado|confirmado)|compra (foi )?(feita|realizada|conclu[ií]da)|\bcpf\b|cart[aã]o|senha|[[\]*#]/i;

export const SYSTEM_ATENDENTE = `Você é o Guide, o atendente do iFood que conversa por voz. Você ajuda a pessoa a decidir o que pedir (refeição, mercado ou presente) e monta um plano para ela aprovar. A compra termina no app do iFood.

# Como você trabalha: como o melhor atendente de balcão
- Escute, entenda o que a pessoa quer de verdade e CONDUZA. Nunca deixe a pessoa sem um próximo passo.
- Pedido vago ou em aberto ("algo diferente", "tô com fome", "não sei"): ajude a decidir com 2 ou 3 opções concretas e variadas, ou ofereça escolher por ela.
- Quando a pessoa quiser saber o que existe, comparar ou escolher ("qual o melhor avaliado?", "o que tem de japonês?", "e mais barato?"): USE a ferramenta buscar_no_ifood e responda com base no que voltou (loja, prato, nota, preço). Pode buscar mais de uma categoria para comparar.
- Se a pessoa delegar ("escolhe você", "tanto faz") ou tiver pressa, decida você e siga.
- Pedido claro e específico ("pizza calabresa grande pra 4"): busque e mostre o plano direto, sem perguntas.
- Faça no máximo uma pergunta por vez, curta, com opções para escolher. No máximo três perguntas na conversa inteira: depois disso, decida.
- Quando já souber o que a pessoa quer, chame mostrar_plano com os itens (e o ref da opção escolhida, se ela escolheu uma). Depois diga em uma frase o que montou e pergunte: "É isso, ou quer mudar algo antes de fechar?".
- Se a pessoa pedir mudança num plano mostrado ("sem pipoca", "a mais barata", "troca a loja"), busque se precisar e chame mostrar_plano de novo com o plano inteiro atualizado.
- Se a pessoa concordar em fechar um plano já mostrado, chame pedir_revisao.
- Se a busca não achar nada, diga e ofereça outro caminho (outro prato, outra categoria).

# Como falar
- Português do Brasil, natural e curto: no máximo duas ou três frases. A tela mostra os detalhes; você não lê listas.
- Sem listas, símbolos, markdown ou emojis. Números por extenso só se forem poucos.
- Só cite loja, prato, preço, nota ou prazo que vieram de uma ferramenta nesta conversa. Nunca invente.

# Nunca
- Nunca diga que um pedido foi feito, enviado ou comprado. Você monta um plano; a pessoa aprova; a compra termina no iFood.
- Aprovar o plano só acontece quando a pessoa disser "aprovo o plano"; você não aprova por ela.
- Nada de bebida alcoólica, remédio ou conselho médico. Fora de refeição, mercado e presente: recuse com educação e ofereça ajuda.
- Nunca peça nem repita CPF, cartão, senha, telefone, e-mail ou endereço.`;

export interface AtendenteDeps { modelo: BaseChatModel; nomeModelo: string; domain: DomainPort; nome?: string; now?: () => number }

// Memória do atendente por sessão: opções que o iFood já devolveu (para o plano usar a escolhida) e um resumo delas.
type Memoria = { opcoes: Map<string, OpcaoPlano>; resumoBuscas: string[] };
const g = globalThis as unknown as { __guideAtendente?: Map<string, Memoria> };
const memorias = (g.__guideAtendente ??= new Map());
function memoriaDe(subjectRef: string): Memoria {
  let m = memorias.get(subjectRef);
  if (!m) { m = { opcoes: new Map(), resumoBuscas: [] }; memorias.set(subjectRef, m); }
  if (memorias.size > 2000) memorias.delete(memorias.keys().next().value!);
  return m;
}
export function reiniciarAtendente(subjectRef: string): void { memorias.delete(subjectRef); }

const reais = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const linhaOpcao = (o: OpcaoPlano) => [`ref=${o.ref}`, o.item, `loja ${o.loja}`, reais(o.precoCents), o.nota !== undefined ? `nota ${o.nota}` : "", o.prazo ?? "", o.freteCents !== undefined ? (o.freteCents === 0 ? "frete grátis" : `frete ${reais(o.freteCents)}`) : ""].filter(Boolean).join(" | ");

const VerticalArg = z.enum(["RESTAURANT", "GROCERIES", "SHOPPING"]).describe("RESTAURANT = comida pronta; GROCERIES = mercado; SHOPPING = presente");
const restricoesArg = z.array(z.string().min(1).max(60)).max(10).optional().describe("Restrições alimentares rígidas explicitamente ditas, como lactose, gluten, amendoim. Nunca remova restrições anteriores.");
const buscarSchema = z.object({
  categoria: z.string().min(1).max(60).describe("Prato ou produto concreto. Ex.: sushi, pizza margherita, comida árabe, pipoca"),
  consultas: z.array(z.string().min(1).max(80)).max(3).optional().describe("Até 3 termos de busca concretos para o mesmo item (sinônimos). Ex.: sushi → sushi, temaki, combinado"),
  vertical: VerticalArg,
  restricoes: restricoesArg,
  orcamento: z.object({ max: z.number().min(1), tipo: z.enum(["teto", "flexivel"]) }).optional(),
  ordenar: z.enum(["relevancia", "melhor_avaliada", "mais_barata", "mais_rapida"]).optional(),
});
const mostrarSchema = z.object({
  pessoas: z.number().int().min(1).max(50).optional().describe("Quantas pessoas vão comer, se a pessoa disse"),
  itens: z.array(z.object({
    categoria: z.string().min(1).max(60),
    consultas: z.array(z.string().min(1).max(80)).max(3).optional(),
    vertical: VerticalArg,
    restricoes: restricoesArg,
    orcamento: z.object({ max: z.number().min(1), tipo: z.enum(["teto", "flexivel"]) }).optional(),
    ref: z.string().max(200).optional().describe("ref da opção escolhida, vinda de buscar_no_ifood"),
    sugestao: z.boolean().optional().describe("true se foi você quem sugeriu este item, não a pessoa"),
  })).min(1).max(8),
});

const configurarSchema = z.object({ necessidadeId: z.string(), ref: z.string(), versao: z.number().int().min(1), selecoes: z.array(z.object({ grupoId: z.string(), opcaoId: z.string(), quantidade: z.number().int().min(1).max(99) })).max(100) });
const ferramentas = [
  tool(async () => "", { name: "configurar_complementos", description: "Salva as escolhas de complementos do item no plano. Use somente IDs de grupo e opção da situação atual. Não invente escolhas, confirme ambiguidades. Envie a seleção completa do item; array vazio recusa todos os opcionais.", schema: configurarSchema }),
  tool(async () => "", { name: "buscar_no_ifood", description: "Busca no iFood, perto da pessoa e em lojas abertas, opções reais de um prato ou produto. Devolve loja, prato, preço, nota, prazo e frete. Use para descobrir o que existe, comparar ou escolher.", schema: buscarSchema }),
  tool(async () => "", { name: "mostrar_plano", description: "Mostra na tela o plano com os itens decididos (substitui o plano anterior). Use quando já souber o que a pessoa quer.", schema: mostrarSchema }),
  tool(async () => "", { name: "pedir_revisao", description: "Leva o plano mostrado para a tela de revisão e aprovação, quando a pessoa concordar em fechar.", schema: z.object({}) }),
];

function comTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms))]);
}

const ordenar = (lista: OpcaoPlano[], criterio?: string) => {
  const v = [...lista];
  if (criterio === "melhor_avaliada") v.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));
  else if (criterio === "mais_barata") v.sort((a, b) => a.precoCents - b.precoCents);
  else if (criterio === "mais_rapida") v.sort((a, b) => (parseInt(a.prazo?.match(/\d+/)?.[0] ?? "999")) - (parseInt(b.prazo?.match(/\d+/)?.[0] ?? "999")));
  return v;
};

let seqNecessidade = 0;
function acumularRestricoes(s: AgentSession, novas: string[]) {
  const unidas = [...new Set([...s.restricoes, ...novas.map(r => limparNome(r)).filter(Boolean)])];
  if (unidas.some(r => !s.restricoes.includes(r))) { s.ultimaVersaoPlano = Math.max(s.ultimaVersaoPlano ?? 0, s.plano?.versao ?? 0); s.plano = undefined; s.estado = "S1"; s.encaminhado = false; }
  s.restricoes = unidas;
}
const necessidadeDe = (a: { categoria: string; consultas?: string[]; vertical: Necessidade["vertical"]; sugestao?: boolean; restricoes?: string[]; orcamento?: Necessidade["orcamento"] }, s: AgentSession): Necessidade => {
  acumularRestricoes(s, a.restricoes ?? []);
  return { id: `a${++seqNecessidade}`, vertical: a.vertical, categoria: a.categoria, restricoes: [...s.restricoes], ...(a.orcamento ? { orcamento: a.orcamento } : {}), ...(a.consultas?.length ? { consultas: a.consultas } : {}), ...(a.sugestao ? { fonte: "inferido" as const } : {}) };
};

export async function executarAtendente(s: AgentSession, input: ConverseInput, deps: AtendenteDeps): Promise<AgentReply> {
  const now = deps.now ?? (() => performance.now());
  const t0 = now();
  const tempos: AgentReply["tempos"] = { interpretarMs: 0, totalMs: 0 };
  const mem = memoriaDe(s.subjectRef);
  const texto = norm(input.texto).replace(/[.,!?;]/g, " ").replace(/\s+/g, " ").trim();
  s.turnos += 1;
  let tela: AgentReply["tela"];
  let aprovacao: AgentReply["aprovacao"];

  const fim = (resposta: string): AgentReply => {
    s.history.push({ role: "user", text: input.texto }, { role: "agent", text: resposta });
    if (s.history.length > 40) s.history.splice(0, s.history.length - 40);
    tempos.totalMs = Math.round(now() - t0);
    return { estado: s.estado, nivel: "L1", resposta, ...(tela ? { tela } : {}), ...(aprovacao ? { aprovacao } : {}), origem: s.plano?.origem ?? "simulado", llm: `atendente:${deps.nomeModelo}`, tempos };
  };

  // Guardas determinísticas (antes do modelo): aprovação e revisão não dependem de interpretação.
  if (input.origem === "voz" && input.sinais?.confianca !== undefined && input.sinais.confianca < LIMIARES_CONFIANCA.confirmar) return fim("Não entendi com segurança. Repita ou digite sua escolha antes de continuar.");
  // Restrições explícitas comuns persistem mesmo se o modelo esquecer de transmiti-las.
  const ditas = [...texto.matchAll(/\b(?:sem|alergi\w* a|intoleran\w* a)\s+(lactose|gluten|amendoim|leite|ovo|ovos|castanha|acucar)\b/g)].map(m => m[1]);
  if (ditas.some(r => !s.restricoes.includes(r))) {
    acumularRestricoes(s, ditas);
    // Um plano anterior não foi filtrado para a nova restrição.
    s.plano = undefined; s.estado = "S1"; s.encaminhado = false;
  }
  if (input.configuracao) {
    if (!s.plano) return fim(FRASES.semPlano);
    try {
      if (s.restricoes.length && input.configuracao.selecoes.length) return fim("Não consigo confirmar a composição dos complementos para suas restrições. Peça uma opção com composição verificada.");
      s.plano = configurarItem(s.plano, input.configuracao);
      s.ultimaVersaoPlano = s.plano.versao;
      s.estado = "S4"; s.encaminhado = false;
      tela = { tipo: "plano_atualizado", plano: s.plano };
      return fim("Complementos salvos. Confira o plano atualizado antes de aprovar.");
    } catch {
      tela = { tipo: "plano_atualizado", plano: s.plano };
      return fim("Não salvei as escolhas. Confira a versão atual, as opções disponíveis e os limites de cada grupo.");
    }
  }
  if (APROVACAO_EXPLICITA.test(texto)) {
    if (!s.plano) return fim(FRASES.semPlano);
    const citada = texto.match(VERSAO_CITADA)?.[1];
    if (!citada) return fim("Para aprovar, confira a tela e informe a versão do plano.");
    if (citada && Number(citada) !== s.plano.versao) { tela = { tipo: "aguardando_aprovacao", plano: s.plano }; return fim(FRASES.versaoMudou); }
    const bloqueios = impedimentosPlano(s.plano);
    if (bloqueios.length) { tela = { tipo: "plano_atualizado", plano: s.plano }; return fim(`Ainda falta configurar os itens. ${bloqueios[0]}`); }
    s.estado = "S5"; s.encaminhado = true;
    aprovacao = { planoId: s.plano.planoId, versao: s.plano.versao };
    tela = { tipo: "sacola", plano: { ...s.plano, sacola: montarSacola(s.plano) } };
    return fim(FRASES.aprovacaoEnviada);
  }
  if (s.plano && FECHAR.test(texto)) {
    if (impedimentosPlano(s.plano).length) { tela = { tipo: "plano_atualizado", plano: s.plano }; return fim("Complete e salve os complementos obrigatórios antes de revisar."); }
    s.estado = "S5"; s.encaminhado = true;
    tela = { tipo: "aguardando_aprovacao", plano: s.plano };
    return fim("Confere na tela e, se estiver tudo certo, é só aprovar.");
  }

  const contexto = [
    `Restrições rígidas da sessão: ${s.restricoes.join(", ") || "nenhuma informada"}. Preserve todas em cada busca.`,
    s.plano ? `Complementos por item (seleções são por unidade; IDs somente para ferramentas): ${JSON.stringify(s.plano.blocos.map(b => ({ necessidadeId: b.necessidadeId, ref: b.principal.ref, versao: s.plano!.versao, complementos: b.principal.complementos })))}` : "",
    deps.nome ? `O primeiro nome da pessoa é ${deps.nome}.` : "",
    s.plano ? `Plano na tela agora (versão ${s.plano.versao}): ${s.plano.blocos.map((b) => `${b.quantidade}x ${b.principal.item} da ${b.principal.loja}${b.sugestao ? " (sugestão sua)" : ""}`).join("; ")}.` : "Ainda não há plano na tela.",
    mem.resumoBuscas.length ? `Buscas que você já fez nesta conversa:\n${mem.resumoBuscas.slice(-4).join("\n")}` : "",
  ].filter(Boolean).join("\n");
  const msgs: BaseMessage[] = [
    new SystemMessage(`${SYSTEM_ATENDENTE}\n\n# Situação atual\n${contexto}`),
    ...s.history.slice(-HISTORICO).map((m) => (m.role === "user" ? new HumanMessage(m.text) : new AIMessage(m.text))),
    new HumanMessage(input.texto),
  ];
  const modelo = deps.modelo.bindTools!(ferramentas);

  let resposta = "";
  try {
    for (let passo = 0; passo <= MAX_PASSOS; passo++) {
      const ai = await comTimeout(modelo.invoke(msgs), TIMEOUT_MS) as AIMessage;
      msgs.push(ai);
      const chamadas = ai.tool_calls ?? [];
      if (!chamadas.length || passo === MAX_PASSOS) {
        resposta = typeof ai.content === "string" ? ai.content : ai.content.map((p) => ("text" in p ? p.text : "")).join("");
        break;
      }
      for (const c of chamadas) {
        const td = now();
        const saida = await executarFerramenta(c.name, c.args, s, mem, deps).catch((e): Saida => ({ texto: `ERRO na ferramenta: ${String(e).slice(0, 160)}` }));
        tempos.dominioMs = (tempos.dominioMs ?? 0) + Math.round(now() - td);
        if (saida.tela) tela = saida.tela;
        msgs.push(new ToolMessage({ tool_call_id: c.id ?? c.name, content: saida.texto }));
      }
    }
  } catch (error) {
    console.warn(`[atendente] falhou: ${String(error).slice(0, 200)}`);
    resposta = tela ? "Montei o plano na tela. É isso, ou quer mudar algo antes de fechar?" : FRASES.naoEntendi;
  }
  tempos.interpretarMs = Math.round(now() - t0) - (tempos.dominioMs ?? 0);

  resposta = resposta.replace(/[*#[\]_`]/g, "").replace(/\s+/g, " ").trim();
  if (!resposta || PROIBIDO.test(resposta) || temDadoPessoal(resposta)) {
    resposta = tela ? "Montei o plano na tela. É isso, ou quer mudar algo antes de fechar?" : "Me conta um pouco mais do que você quer, que eu te ajudo a escolher.";
  }
  if (!s.plano) s.estado = "S1";
  return fim(resposta);
}

type Saida = { texto: string; tela?: AgentReply["tela"] };

async function executarFerramenta(nome: string, args: unknown, s: AgentSession, mem: Memoria, deps: AtendenteDeps): Promise<Saida> {
  if (nome === "configurar_complementos") {
    if (!s.plano) return { texto: "Monte um plano primeiro." };
    const a = configurarSchema.parse(args);
    if (s.restricoes.length && a.selecoes.length) return { texto: "Composição dos complementos não verificada para as restrições. Não salve nem afirme segurança." };
    s.plano = configurarItem(s.plano, { ...a, planoId: s.plano.planoId });
    s.ultimaVersaoPlano = s.plano.versao;
    s.estado = "S4"; s.encaminhado = false;
    return { texto: "Complementos salvos; a versão atual precisa de nova revisão.", tela: { tipo: "plano_atualizado", plano: s.plano } };
  }
  if (nome === "buscar_no_ifood") {
    const a = buscarSchema.parse(args);
    if (ALCOOL.test(a.categoria)) return { texto: "Não busco bebida alcoólica. Ofereça outra coisa." };
    const opcoes = ordenar(await deps.domain.buscarNecessidade(necessidadeDe(a, s), s.ocasiao), a.ordenar).slice(0, OPCOES_POR_BUSCA);
    for (const o of opcoes) mem.opcoes.set(o.ref, o);
    const texto = opcoes.length ? `Opções de ${a.categoria}:\n${opcoes.map(linhaOpcao).join("\n")}` : `Nenhuma opção de ${a.categoria} aberta com entrega agora.`;
    mem.resumoBuscas.push(texto.split("\n").slice(0, 4).join(" / "));
    if (mem.resumoBuscas.length > 8) mem.resumoBuscas.shift();
    console.info(`[atendente] buscar categoria="${a.categoria}" ordenar=${a.ordenar ?? "relevancia"} opcoes=${opcoes.length}`);
    return { texto };
  }
  if (nome === "mostrar_plano") {
    const a = mostrarSchema.parse(args);
    if (a.itens.some((i) => ALCOOL.test(i.categoria))) return { texto: "Plano não montado: bebida alcoólica não entra. Tire esse item." };
    if (a.pessoas) s.ocasiao = { ...s.ocasiao, pessoas: a.pessoas };
    // Acumula antes de buscar para todas as necessidades receberem as mesmas restrições rígidas.
    acumularRestricoes(s, a.itens.flatMap(i => i.restricoes ?? []));
    const necessidades = a.itens.map(i => necessidadeDe(i, s));
    // O domínio real monta o plano a partir da busca de cada necessidade; por isso busca de novo aqui.
    const itens = await Promise.all(necessidades.map(async (n) => ({ necessidade: n, opcoes: await deps.domain.buscarNecessidade(n, s.ocasiao) })));
    const base = await deps.domain.montarPlano({ subjectRef: s.subjectRef, ocasiao: s.ocasiao, itens });
    // Nomes de loja e item vêm do catálogo: limpos antes de ir à tela e à fala.
    const escolhido: PlanoSnapshot = { ...base, versao: Math.max(s.ultimaVersaoPlano ?? 0, s.plano?.versao ?? 0) + 1, blocos: base.blocos.map((b) => escolher(b, a.itens[necessidades.findIndex((n) => n.id === b.necessidadeId)]?.ref)) };
    const plano = sanearPlano(await detalharPlano(escolhido, deps.domain.detalharItem?.bind(deps.domain)));
    if (s.restricoes.length) for (const b of plano.blocos) {
      if (b.principal.complementos?.grupos.length) b.principal.complementos.composicaoNaoVerificada = true;
    }
    const atualizado = Boolean(s.plano);
    s.plano = plano; s.necessidades = necessidades; s.estado = atualizado ? "S4" : "S3"; s.encaminhado = false;
    s.ultimaVersaoPlano = plano.versao;
    console.info(`[atendente] mostrar_plano itens=${a.itens.length} blocos=${plano.blocos.length} naoAtendidas=${plano.naoAtendidas.length} versao=${plano.versao}`);
    const resumo = plano.blocos.map((b) => `${b.quantidade}x ${b.principal.item} da ${b.principal.loja} (${reais(b.principal.precoCents)}); complementos: ${resumoComplementos(b.principal).join(", ") || "a configurar se houver"}`).join("; ");
    const faltas = plano.naoAtendidas.map((n) => n.categoria).join(", ");
    return {
      texto: `Plano versão ${plano.versao} na tela: ${resumo || "nenhum item encontrado"}.${faltas ? ` Sem opção agora para: ${faltas}.` : ""}`,
      ...(plano.blocos.length ? { tela: { tipo: atualizado ? "plano_atualizado" as const : "mostrar_plano" as const, plano } } : {}),
    };
  }
  if (nome === "pedir_revisao") {
    if (!s.plano) return { texto: "Não há plano na tela ainda. Monte com mostrar_plano primeiro." };
    if (impedimentosPlano(s.plano).length) return { texto: "Complete os complementos obrigatórios ou verifique os detalhes antes de revisar.", tela: { tipo: "plano_atualizado", plano: s.plano } };
    s.estado = "S5"; s.encaminhado = true;
    return { texto: "Revisão aberta na tela. Diga para a pessoa conferir e dizer \"aprovo o plano\".", tela: { tipo: "aguardando_aprovacao", plano: s.plano } };
  }
  return { texto: `Ferramenta desconhecida: ${nome}` };
}

// A opção que a pessoa escolheu (ref de uma busca) vira a principal do bloco; a anterior vira alternativa.
function escolher(b: PlanoSnapshot["blocos"][number], ref: string | undefined): PlanoSnapshot["blocos"][number] {
  if (!ref || b.principal.ref === ref) return b;
  const escolhida = b.alternativas.find((o) => o.ref === ref);
  if (!escolhida) throw new Error("OPCAO_FORA_DA_NECESSIDADE");
  return { ...b, principal: escolhida, alternativas: [b.principal, ...b.alternativas.filter((o) => o.ref !== ref)].slice(0, 3) };
}
