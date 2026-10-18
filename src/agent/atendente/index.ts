// ATENDENTE COM FERRAMENTAS: o agente do Guide. Uma cabeça só: o LLM vê a conversa inteira, conversa, pesquisa
// no iFood quando precisa e decide quando mostrar o plano, como um atendente de balcão. O código não decide a conversa;
// só guarda o que é proibido: aprovação só pela frase explícita da versão na tela, nada de álcool, sem dado pessoal,
// preço e loja só do que o iFood devolveu. Ferramentas só de leitura (nenhuma compra, carrinho ou pedido).
// Substituiu o agente por regras (orquestrador + formulário), que tomava decisões ruins nos fallbacks (18/10/2026).
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { FRASES } from "../frases";
import { sanearPlano } from "../guardas-fala";
import { temDadoPessoal } from "../privacidade";
import { montarSacola } from "../sacola";
import type { AgentReply, AgentSession, ConverseInput, DomainPort, GrupoOpcoes, Necessidade, OpcaoPlano, PlanoSnapshot } from "../types";

const MAX_PASSOS = 4;          // rodadas de ferramenta por turno (buscar, buscar, mostrar...)
const TIMEOUT_MS = 12_000;     // por chamada ao modelo
const HISTORICO = 16;          // mensagens da conversa que o modelo vê
const OPCOES_POR_BUSCA = 6;
const OPCOES_NA_TELA = 3;     // por busca: a tela é de voz, não um catálogo
const GRUPOS_NA_TELA = 3;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const APROVACAO_EXPLICITA = /\b(aprovo|confirmo)( o)? plano\b/;
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
- A tela mostra sozinha as opções de cada busca sua (até três por busca), com foto, nota, preço e prazo. Ao buscar, fale em uma frase o destaque (ex.: a mais bem avaliada) e pergunte qual a pessoa prefere; não leia a lista.
- A pessoa também escolhe tocando na tela: chega como "quero a <prato> da <loja>" ou "troca <item> pela <prato> da <loja>". Use o ref dessa opção (das buscas ou das alternativas do plano) em mostrar_plano. Para trocar um item do plano, chame mostrar_plano com TODOS os itens do plano, só mudando o ref do item trocado.

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
// grupoDe: cada opção aponta para a lista da busca em que apareceu (as que a pessoa viu juntas na tela).
type Memoria = { opcoes: Map<string, OpcaoPlano>; grupoDe: Map<string, OpcaoPlano[]>; resumoBuscas: string[] };
const g = globalThis as unknown as { __guideAtendente?: Map<string, Memoria> };
const memorias = (g.__guideAtendente ??= new Map());
function memoriaDe(subjectRef: string): Memoria {
  let m = memorias.get(subjectRef);
  if (!m) { m = { opcoes: new Map(), grupoDe: new Map(), resumoBuscas: [] }; memorias.set(subjectRef, m); }
  if (memorias.size > 2000) memorias.delete(memorias.keys().next().value!);
  return m;
}
export function reiniciarAtendente(subjectRef: string): void { memorias.delete(subjectRef); }

const reais = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const linhaOpcao = (o: OpcaoPlano) => [`ref=${o.ref}`, o.item, `loja ${o.loja}`, reais(o.precoCents), o.nota !== undefined ? `nota ${o.nota}` : "", o.prazo ?? "", o.freteCents !== undefined ? (o.freteCents === 0 ? "frete grátis" : `frete ${reais(o.freteCents)}`) : ""].filter(Boolean).join(" | ");

const VerticalArg = z.enum(["RESTAURANT", "GROCERIES", "SHOPPING"]).describe("RESTAURANT = comida pronta; GROCERIES = mercado; SHOPPING = presente");
const buscarSchema = z.object({
  categoria: z.string().min(1).max(60).describe("Prato ou produto concreto. Ex.: sushi, pizza margherita, comida árabe, pipoca"),
  consultas: z.array(z.string().min(1).max(80)).max(3).optional().describe("Até 3 termos de busca concretos para o mesmo item (sinônimos). Ex.: sushi → sushi, temaki, combinado"),
  vertical: VerticalArg,
  ordenar: z.enum(["relevancia", "melhor_avaliada", "mais_barata", "mais_rapida"]).optional(),
});
const mostrarSchema = z.object({
  pessoas: z.number().int().min(1).max(50).optional().describe("Quantas pessoas vão comer, se a pessoa disse"),
  itens: z.array(z.object({
    categoria: z.string().min(1).max(60),
    consultas: z.array(z.string().min(1).max(80)).max(3).optional(),
    vertical: VerticalArg,
    ref: z.string().max(200).optional().describe("ref da opção escolhida, vinda de buscar_no_ifood"),
    sugestao: z.boolean().optional().describe("true se foi você quem sugeriu este item, não a pessoa"),
  })).min(1).max(8),
});

const ferramentas = [
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
const necessidadeDe = (a: { categoria: string; consultas?: string[]; vertical: Necessidade["vertical"]; sugestao?: boolean }): Necessidade =>
  ({ id: `a${++seqNecessidade}`, vertical: a.vertical, categoria: a.categoria, restricoes: [], ...(a.consultas?.length ? { consultas: a.consultas } : {}), ...(a.sugestao ? { fonte: "inferido" as const } : {}) });

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
  if (APROVACAO_EXPLICITA.test(texto)) {
    if (!s.plano) return fim(FRASES.semPlano);
    const citada = texto.match(VERSAO_CITADA)?.[1];
    if (citada && Number(citada) !== s.plano.versao) { tela = { tipo: "aguardando_aprovacao", plano: s.plano }; return fim(FRASES.versaoMudou); }
    s.estado = "S5"; s.encaminhado = true;
    aprovacao = { planoId: s.plano.planoId, versao: s.plano.versao };
    tela = { tipo: "sacola", plano: { ...s.plano, sacola: montarSacola(s.plano) } };
    return fim(FRASES.aprovacaoEnviada);
  }
  if (s.plano && FECHAR.test(texto)) {
    s.estado = "S5"; s.encaminhado = true;
    tela = { tipo: "aguardando_aprovacao", plano: s.plano };
    return fim("Confere na tela e, se estiver tudo certo, é só aprovar.");
  }

  const contexto = [
    deps.nome ? `O primeiro nome da pessoa é ${deps.nome}.` : "",
    s.plano ? `Plano na tela agora (versão ${s.plano.versao}): ${s.plano.blocos.map(descreverBloco).join("; ")}.` : "Ainda não há plano na tela.",
    mem.resumoBuscas.length ? `Buscas que você já fez nesta conversa:\n${mem.resumoBuscas.slice(-4).join("\n")}` : "",
  ].filter(Boolean).join("\n");
  const msgs: BaseMessage[] = [
    new SystemMessage(`${SYSTEM_ATENDENTE}\n\n# Situação atual\n${contexto}`),
    ...s.history.slice(-HISTORICO).map((m) => (m.role === "user" ? new HumanMessage(m.text) : new AIMessage(m.text))),
    new HumanMessage(input.texto),
  ];
  const modelo = deps.modelo.bindTools!(ferramentas);

  let resposta = "";
  const grupos: GrupoOpcoes[] = [];
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
        if (saida.grupo) {
          grupos.push(saida.grupo);
          tela = { tipo: "mostrar_opcoes", plano: { ...(s.plano ?? planoVazio()), opcoes: grupos.slice(-GRUPOS_NA_TELA) } };
        }
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

type Saida = { texto: string; tela?: AgentReply["tela"]; grupo?: GrupoOpcoes };

async function executarFerramenta(nome: string, args: unknown, s: AgentSession, mem: Memoria, deps: AtendenteDeps): Promise<Saida> {
  if (nome === "buscar_no_ifood") {
    const a = buscarSchema.parse(args);
    if (ALCOOL.test(a.categoria)) return { texto: "Não busco bebida alcoólica. Ofereça outra coisa." };
    const opcoes = ordenar(await deps.domain.buscarNecessidade(necessidadeDe(a), s.ocasiao), a.ordenar).slice(0, OPCOES_POR_BUSCA);
    for (const o of opcoes) { mem.opcoes.set(o.ref, o); mem.grupoDe.set(o.ref, opcoes); }
    const texto = opcoes.length ? `Opções de ${a.categoria}:\n${opcoes.map(linhaOpcao).join("\n")}` : `Nenhuma opção de ${a.categoria} aberta com entrega agora.`;
    mem.resumoBuscas.push(texto.split("\n").slice(0, 4).join(" / "));
    if (mem.resumoBuscas.length > 8) mem.resumoBuscas.shift();
    console.info(`[atendente] buscar categoria="${a.categoria}" ordenar=${a.ordenar ?? "relevancia"} opcoes=${opcoes.length}`);
    return { texto, ...(opcoes.length ? { grupo: { categoria: a.categoria, ...(a.ordenar && a.ordenar !== "relevancia" ? { criterio: a.ordenar } : {}), itens: opcoes.slice(0, OPCOES_NA_TELA) } } : {}) };
  }
  if (nome === "mostrar_plano") {
    const a = mostrarSchema.parse(args);
    if (a.itens.some((i) => ALCOOL.test(i.categoria))) return { texto: "Plano não montado: bebida alcoólica não entra. Tire esse item." };
    if (a.pessoas) s.ocasiao = { ...s.ocasiao, pessoas: a.pessoas };
    const necessidades = a.itens.map(necessidadeDe);
    // O domínio real monta o plano a partir da busca de cada necessidade; por isso busca de novo aqui.
    const itens = await Promise.all(necessidades.map(async (n) => ({ necessidade: n, opcoes: await deps.domain.buscarNecessidade(n, s.ocasiao) })));
    const base = await deps.domain.montarPlano({ subjectRef: s.subjectRef, ocasiao: s.ocasiao, itens });
    // Nomes de loja e item vêm do catálogo: limpos antes de ir à tela e à fala.
    const plano: PlanoSnapshot = { ...sanearPlano(base), versao: (s.plano?.versao ?? 0) + 1, blocos: sanearPlano(base).blocos.map((b) => escolher(b, a.itens[necessidades.findIndex((n) => n.id === b.necessidadeId)]?.ref, mem)) };
    for (const b of plano.blocos) for (const o of [b.principal, ...b.alternativas]) mem.opcoes.set(o.ref, o);
    const atualizado = Boolean(s.plano);
    s.plano = plano; s.necessidades = necessidades; s.estado = atualizado ? "S4" : "S3"; s.encaminhado = false;
    console.info(`[atendente] mostrar_plano itens=${a.itens.length} blocos=${plano.blocos.length} naoAtendidas=${plano.naoAtendidas.length} versao=${plano.versao}`);
    const resumo = plano.blocos.map(descreverBloco).join("; ");
    const faltas = plano.naoAtendidas.map((n) => n.categoria).join(", ");
    return {
      texto: `Plano versão ${plano.versao} na tela: ${resumo || "nenhum item encontrado"}.${faltas ? ` Sem opção agora para: ${faltas}.` : ""}`,
      ...(plano.blocos.length ? { tela: { tipo: atualizado ? "plano_atualizado" as const : "mostrar_plano" as const, plano } } : {}),
    };
  }
  if (nome === "pedir_revisao") {
    if (!s.plano) return { texto: "Não há plano na tela ainda. Monte com mostrar_plano primeiro." };
    s.estado = "S5"; s.encaminhado = true;
    return { texto: "Revisão aberta na tela. Diga para a pessoa conferir e dizer \"aprovo o plano\".", tela: { tipo: "aguardando_aprovacao", plano: s.plano } };
  }
  return { texto: `Ferramenta desconhecida: ${nome}` };
}

// Item do plano para o modelo: a escolhida e as alternativas, com ref, para ele poder trocar quando a pessoa tocar.
const descreverBloco = (b: PlanoSnapshot["blocos"][number]) => `${b.categoria} (categoria=${b.categoria}, vertical=${b.vertical}): ${b.quantidade}x ${b.principal.item} da ${b.principal.loja} ${reais(b.principal.precoCents)} [ref=${b.principal.ref}]${b.sugestao ? " (sugestão sua)" : ""}${b.alternativas.length ? `; alternativas: ${b.alternativas.map((o) => `${o.item} da ${o.loja} ${reais(o.precoCents)} [ref=${o.ref}]`).join(", ")}` : ""}`;

const planoVazio = (): PlanoSnapshot => ({ planoId: "", versao: 0, blocos: [], naoAtendidas: [], pendencias: [], origem: "real" });

// A opção que a pessoa escolheu (ref de uma busca) vira a principal do bloco; a anterior vira alternativa. As outras
// opções da mesma busca (que a pessoa viu na tela) também ficam como alternativas, para trocar tocando.
function escolher(b: PlanoSnapshot["blocos"][number], ref: string | undefined, mem: Memoria): PlanoSnapshot["blocos"][number] {
  const escolhida = ref ? (b.principal.ref === ref ? b.principal : b.alternativas.find((o) => o.ref === ref) ?? mem.opcoes.get(ref)) : undefined;
  const principal = escolhida ?? b.principal;
  const vistas = (ref && mem.grupoDe.get(ref)) || mem.grupoDe.get(principal.ref) || [];
  const unicas = new Map<string, OpcaoPlano>();
  for (const o of [b.principal, ...b.alternativas, ...vistas]) if (o.ref !== principal.ref && !unicas.has(o.ref)) unicas.set(o.ref, o);
  return { ...b, principal, alternativas: [...unicas.values()].slice(0, MAX_ALTERNATIVAS) };
}
const MAX_ALTERNATIVAS = 3;
