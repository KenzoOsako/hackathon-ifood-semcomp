// ATENDENTE COM FERRAMENTAS: o agente do Mimo. Uma cabeça só: o LLM vê a conversa inteira, conversa, pesquisa
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
import { chaveLoja, montarSacola } from "../sacola";
import { unificarMercado } from "../mercado-unico";
import type { AgentReply, AgentSession, ConverseInput, DomainPort, GrupoOpcoes, Necessidade, OpcaoPlano, PlanoSnapshot } from "../types";
import type { Sinal } from "@/data/sinais";

const MAX_PASSOS = 4;          // rodadas de ferramenta por turno (buscar, buscar, mostrar...)
const TIMEOUT_MS = 12_000;     // por chamada ao modelo
const HISTORICO = 16;          // mensagens da conversa que o modelo vê
const OPCOES_POR_BUSCA = 6;
const OPCOES_NA_TELA = 3;     // por busca: a tela é de voz, não um catálogo
const GRUPOS_NA_TELA = 3;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const APROVACAO_EXPLICITA = /^(aprovo|confirmo)( o)? plano(?: versao \d+)?$/;
const VERSAO_CITADA = /\bversao (\d+)\b/;
const FECHAR = /^(pode|pode fechar|fecha|fechou|fechado|fecha assim|pode ser|isso|isso mesmo|ok|beleza|sim|bora|vamos fechar|quero fechar|fechar)$/;
// Promessa de ação ("vou buscar", "deixa eu olhar") e afirmação sobre a tela, no texto já normalizado (sem acento).
const PROMESSA = /\b(vou|vamos|deixa eu|deixe-me|ja vou|estou) (te )?(buscar|procurar|olhar|ver|pesquisar|mostrar|montar|separar|checar|verificar)\b/;
const DIZ_TELA = /\b(na|sua|da|pra|para a) tela\b/;
const ALCOOL =/cerveja|vinho|vodka|whisky|cacha[cç]a|gin\b|licor|drink|chopp|alco[oó]l/i;
const PROIBIDO = /pedido (foi )?(feito|realizado|enviado|confirmado)|compra (foi )?(feita|realizada|conclu[ií]da)|\bcpf\b|cart[aã]o|senha|[[\]*#]/i;

export const SYSTEM_ATENDENTE = `Você é o Mimo, o atendente do iFood que conversa por voz. Você ajuda a pessoa a decidir o que pedir (refeição, mercado ou presente) e monta um plano para ela aprovar. A compra termina no app do iFood.

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

# Ocasiões especiais: um roteiro com várias vertentes
- Aniversário, surpresa, data romântica, festa, visita: o roteiro depende de QUEM é a pessoa. Pense nela: quem é (namorado, namorada, mãe, amigo, criança), do que gosta, o momento. Não existe roteiro padrão; não repita sugestões de outras conversas.
- Se você não sabe nada do gosto da pessoa, faça primeiro UMA pergunta curta sobre ela, com opções concretas e variadas (ex.: "Do que ele mais gosta: um doce, um salgado caprichado ou um presente?"). Se já souber, proponha DE UMA VEZ um roteiro de 2 ou 3 itens, de lojas e verticais diferentes quando fizer sentido, coerente com o gosto dela, e diga o roteiro em uma frase.
- Se um item do roteiro tiver um caminho que muda tudo, pergunte isso UMA vez ANTES de buscar esse item, com prós e contras curtos, e não busque nada nesse turno (ex.: um bolo pode ser comprado pronto, que chega rápido, ou feito em casa, que é mais pessoal).
- "Pronto": busque o item pronto (bolo em confeitaria é RESTAURANT). "Fazer": monte a lista COMPLETA de ingredientes de uma receita simples como itens de mercado (GROCERIES), um item por ingrediente. Ex.: bolo de chocolate → farinha de trigo, ovos, açúcar, chocolate em pó, leite, manteiga, fermento em pó. Lista de mercado NÃO se busca item por item: chame mostrar_plano direto com todos os ingredientes (e os outros itens do plano), que ele mesmo busca cada um e junta tudo num mercado só (um pedido, um frete). Se faltar algo nesse mercado, pergunte se a pessoa quer outro item de lá ou trazer de outra loja (que vira outro pedido); não traga de outra loja por conta própria.
- Cada loja é um pedido separado no iFood. Quando o plano tiver mais de uma loja, diga isso na revisão.
- Opções na tela não são plano: depois de buscar, diga "separei algumas opções", nunca "montei o plano". Plano é só depois de mostrar_plano.
- Para comparar, busque cada item do roteiro e deixe a tela mostrar as opções lado a lado.
- Em mostrar_plano, dê um nome curto à ocasião (ocasiao) e, para cada item, uma linha de porque ligada à pessoa e ao momento, com o que ela disse do gosto dela, sem preço, nota ou número.

# Faça o que diz, e só diga o que fez
- Nunca diga que vai buscar, olhar ou mostrar algo sem chamar a ferramenta NA MESMA resposta. Se vai buscar, busque agora.
- Só diga que algo está na tela se uma ferramenta desta resposta colocou na tela. Se a busca não achou nada, nada aparece na tela: diga que não encontrou.

# Como falar
- Português do Brasil, natural e curto: no máximo duas ou três frases. A tela mostra os detalhes; você não lê listas.
- Sem listas, símbolos, markdown ou emojis. Números por extenso só se forem poucos.
- Só cite loja, prato, preço, nota ou prazo que vieram de uma ferramenta nesta conversa. Nunca invente.

# Nunca
- Nunca diga que um pedido foi feito, enviado ou comprado. Você monta um plano; a pessoa aprova; a compra termina no iFood.
- Aprovar o plano só acontece quando a pessoa disser "aprovo o plano"; você não aprova por ela.
- Nada de bebida alcoólica, remédio ou conselho médico. Fora de refeição, mercado e presente: recuse com educação e ofereça ajuda.
- Nunca peça nem repita CPF, cartão, senha, telefone, e-mail ou endereço.`;

// sinal: registro anônimo de demanda (src/data/sinais.ts); opcional para os testes não dependerem dele.
export interface AtendenteDeps { modelo: BaseChatModel; nomeModelo: string; domain: DomainPort; nome?: string; now?: () => number; sinal?: (s: Sinal) => void }

// Memória do atendente por sessão: opções que o iFood já devolveu (para o plano usar a escolhida) e um resumo delas.
// grupoDe: cada opção aponta para a lista da busca em que apareceu (as que a pessoa viu juntas na tela).
// doPlano: categoria de cada opção que já esteve num plano (ex.: a do mercado escolhido, achada na busca dentro da loja).
type Memoria = { opcoes: Map<string, OpcaoPlano>; grupoDe: Map<string, { categoria: string; itens: OpcaoPlano[] }>; doPlano: Map<string, string>; resumoBuscas: string[] };
const g = globalThis as unknown as { __guideAtendente?: Map<string, Memoria> };
const memorias = (g.__guideAtendente ??= new Map());
function memoriaDe(subjectRef: string): Memoria {
  let m = memorias.get(subjectRef);
  if (!m) { m = { opcoes: new Map(), grupoDe: new Map(), doPlano: new Map(), resumoBuscas: [] }; memorias.set(subjectRef, m); }
  if (memorias.size > 2000) memorias.delete(memorias.keys().next().value!);
  return m;
}
// Sinal é bônus: um registro que falha não pode virar erro de ferramenta nem derrubar o turno.
function registrar(deps: AtendenteDeps, sinal: Sinal): void { try { deps.sinal?.(sinal); } catch { /* descarta */ } }
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

  ordenar: z.enum(["relevancia", "melhor_avaliada", "mais_barata", "mais_rapida"]).optional(),
});
const mostrarSchema = z.object({
  ocasiao: z.string().max(40).optional().describe("Nome curto da ocasião para o título do plano. Ex.: Surpresa de aniversário"),
  pessoas: z.number().int().min(1).max(50).optional().describe("Quantas pessoas vão comer, se a pessoa disse"),
  itens: z.array(z.object({
    categoria: z.string().min(1).max(60),
    consultas: z.array(z.string().min(1).max(80)).max(3).optional(),
    vertical: VerticalArg,
    restricoes: restricoesArg,
    ref: z.string().max(200).optional().describe("ref da opção escolhida, vinda de buscar_no_ifood"),
    sugestao: z.boolean().optional().describe("true se foi você quem sugeriu este item, não a pessoa"),
    porque: z.string().max(120).optional().describe("Uma linha: por que este item serve à ocasião, sem preço, nota ou número. Ex.: o doce favorito da pessoa para abrir a noite"),
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
const necessidadeDe = (a: { categoria: string; consultas?: string[]; vertical: Necessidade["vertical"]; sugestao?: boolean; restricoes?: string[] }, s: AgentSession): Necessidade => {
  acumularRestricoes(s, a.restricoes ?? []);
  return { id: `a${++seqNecessidade}`, vertical: a.vertical, categoria: a.categoria, restricoes: [...s.restricoes], ...(a.consultas?.length ? { consultas: a.consultas } : {}), ...(a.sugestao ? { fonte: "inferido" as const } : {}) };
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
    registrar(deps, { tipo: "aprovado", itens: s.plano.blocos.length });
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
  let usouFerramenta = false;
  try {
    for (let passo = 0, cobrou = false; passo <= MAX_PASSOS; passo++) {
      const ai = await comTimeout(modelo.invoke(msgs), TIMEOUT_MS) as AIMessage;
      msgs.push(ai);
      const chamadas = ai.tool_calls ?? [];
      if (!chamadas.length || passo === MAX_PASSOS) {
        resposta = typeof ai.content === "string" ? ai.content : ai.content.map((p) => ("text" in p ? p.text : "")).join("");
        // Prometeu buscar ou mostrar sem chamar ferramenta: cobra UMA vez para fazer de verdade nesta resposta.
        if (!usouFerramenta && !cobrou && passo < MAX_PASSOS && PROMESSA.test(norm(resposta))) {
          cobrou = true;
          msgs.push(new HumanMessage("[nota do sistema] Você disse que ia buscar ou mostrar algo, mas não chamou nenhuma ferramenta. Chame a ferramenta agora; se não for buscar, responda sem prometer."));
          continue;
        }
        break;
      }
      usouFerramenta = true;
      for (const c of chamadas) {
        const td = now();
        const saida = await executarFerramenta(c.name, c.args, s, mem, deps).catch((e): Saida => ({ texto: `ERRO na ferramenta: ${String(e).slice(0, 160)}` }));
        tempos.dominioMs = (tempos.dominioMs ?? 0) + Math.round(now() - td);
        if (saida.grupo) {
          grupos.push(saida.grupo);
          if (!tela || tela.tipo === "mostrar_opcoes") tela = { tipo: "mostrar_opcoes", plano: { ...(s.plano ?? planoVazio()), opcoes: grupos.slice(-GRUPOS_NA_TELA) } };
        }
        if (saida.tela) tela = saida.tela;
        msgs.push(new ToolMessage({ tool_call_id: c.id ?? c.name, content: saida.texto }));
      }
    }
  } catch (error) {
    console.warn(`[atendente] falhou: ${String(error).slice(0, 200)}`);
    resposta = tela ? falaDaTela(tela.tipo) : FRASES.naoEntendi;
  }
  tempos.interpretarMs = Math.round(now() - t0) - (tempos.dominioMs ?? 0);

  resposta = resposta.replace(/[*#[\]_`]/g, "").replace(/\s+/g, " ").trim();
  // Só diz o que fez: promessa que continuou vazia, ou "está na tela" sem nada ter ido para a tela, vira fala honesta.
  if (!usouFerramenta && PROMESSA.test(norm(resposta))) resposta = "Me diz de novo o que você quer que eu procure, que eu busco agora.";
  if (!tela && DIZ_TELA.test(norm(resposta)) && (!s.plano || /opco|itens|resultado/.test(norm(resposta)))) resposta = "Não encontrei opções abertas para isso agora. Quer que eu tente outra coisa?";
  if (!resposta || PROIBIDO.test(resposta) || temDadoPessoal(resposta)) {
    resposta = tela ? falaDaTela(tela.tipo) : "Me conta um pouco mais do que você quer, que eu te ajudo a escolher.";
  }
  if (!s.plano) s.estado = "S1";
  return fim(resposta);
}

type Saida = { texto: string; tela?: AgentReply["tela"]; grupo?: GrupoOpcoes };

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
    const grupo = { categoria: a.categoria, vertical: a.vertical, itens: opcoes };
    for (const o of opcoes) { mem.opcoes.set(o.ref, o); mem.grupoDe.set(o.ref, grupo); }
    const texto = opcoes.length ? `Opções de ${a.categoria}:\n${opcoes.map(linhaOpcao).join("\n")}` : `Nenhuma opção de ${a.categoria} aberta com entrega agora. NADA foi para a tela.`;
    mem.resumoBuscas.push(texto.split("\n").slice(0, 4).join(" / "));
    if (mem.resumoBuscas.length > 8) mem.resumoBuscas.shift();
    registrar(deps, { tipo: "busca", vertical: a.vertical, categoria: a.categoria, restricoes: s.restricoes, resultados: opcoes.length });
    console.info(`[atendente] buscar categoria="${a.categoria}" ordenar=${a.ordenar ?? "relevancia"} opcoes=${opcoes.length}`);
    return { texto, ...(opcoes.length ? { grupo: { categoria: a.categoria, vertical: a.vertical, ...(a.ordenar && a.ordenar !== "relevancia" ? { criterio: a.ordenar } : {}), itens: opcoes.slice(0, OPCOES_NA_TELA) } } : {}) };
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
    const titulo = textoLivre(a.ocasiao, 40);
    const refDe = (b: PlanoSnapshot["blocos"][number]) => a.itens[necessidades.findIndex((n) => n.id === b.necessidadeId)]?.ref;
    const opcoesDe = (id: string) => itens.find((i) => i.necessidade.id === id)?.opcoes ?? [];
    const escolhido: PlanoSnapshot = { ...base, ...(titulo ? { titulo } : {}), versao: Math.max(s.ultimaVersaoPlano ?? 0, s.plano?.versao ?? 0) + 1, blocos: base.blocos.map((b) => escolher(b, refDe(b), mem, s.restricoes.length > 0, opcoesDe(b.necessidadeId))) };
    // Lista de mercado num mercado só (um carrinho do iFood é de uma loja); o que a pessoa escolheu não é trocado.
    const buscarNaLoja = deps.domain.buscarNaLoja?.bind(deps.domain);
    const { plano: unificado, faltas } = await unificarMercado(escolhido, opcoesDe, new Set(base.blocos.filter((b) => refDe(b)).map((b) => b.necessidadeId)),
      buscarNaLoja && ((b, lojaId) => buscarNaLoja(necessidades.find((n) => n.id === b.necessidadeId)!, lojaId, s.ocasiao)));
    for (const f of faltas) for (const o of f.foraDaLoja) { mem.opcoes.set(o.ref, o); mem.doPlano.set(o.ref, norm(f.categoria)); }
    const plano = sanearPlano(await detalharPlano(unificado, deps.domain.detalharItem?.bind(deps.domain)));
    if (s.restricoes.length) for (const b of plano.blocos) {
      if (b.principal.complementos?.grupos.length) b.principal.complementos.composicaoNaoVerificada = true;
    }
    for (const b of plano.blocos) {
      const porque = justificativaContextual(a.itens[necessidades.findIndex((n) => n.id === b.necessidadeId)]?.porque);
      if (porque) b.porque = porque;
    }
    for (const b of plano.blocos) for (const o of [b.principal, ...b.alternativas]) { mem.opcoes.set(o.ref, o); mem.doPlano.set(o.ref, norm(b.categoria)); }
    // Nada encontrado: não vira plano (nem substitui o que está na tela), e o modelo é avisado de que nada apareceu.
    if (!plano.blocos.length) {
      console.info(`[atendente] mostrar_plano itens=${a.itens.length} blocos=0 (nada aberto)`);
      return { texto: `NADA foi para a tela: nenhuma opção aberta com entrega agora para ${plano.naoAtendidas.map((n) => n.categoria).join(", ") || "esses itens"}. Diga isso com clareza e ofereça outro caminho.` };
    }
    const atualizado = Boolean(s.plano);
    s.plano = plano; s.necessidades = necessidades; s.estado = atualizado ? "S4" : "S3"; s.encaminhado = false;
    s.ultimaVersaoPlano = plano.versao;
    registrar(deps, { tipo: "plano", ocasiao: a.ocasiao, pessoas: s.ocasiao.pessoas, categorias: plano.blocos.map((b) => b.categoria), naoAtendidas: plano.naoAtendidas.map((n) => n.categoria) });
    console.info(`[atendente] mostrar_plano itens=${a.itens.length} blocos=${plano.blocos.length} naoAtendidas=${plano.naoAtendidas.length} versao=${plano.versao}`);
    const resumo = plano.blocos.map((b) => `${descreverBloco(b)}; complementos: ${resumoComplementos(b.principal).join(", ") || "a configurar se houver"}`).join("; ");
    const semOpcao = plano.naoAtendidas.filter((n) => !faltas.some((f) => f.categoria === n.categoria)).map((n) => n.categoria).join(", ");
    // Falta no mercado escolhido: o modelo pergunta; com as refs de fora, consegue trazer de outra loja se a pessoa quiser.
    const faltaMercado = faltas.map((f) => `${f.categoria} (a ${f.loja} não tem; em outra loja, que vira outro pedido: ${f.foraDaLoja.map((o) => `${o.item} da ${o.loja} ${reais(o.precoCents)} [ref=${o.ref}]`).join(", ") || "nada aberto"})`).join("; ");
    const pedidos = new Set(plano.blocos.map((b) => chaveLoja(b.principal))).size;
    return {
      texto: `Plano versão ${plano.versao} na tela: ${resumo}.${pedidos > 1 ? ` São ${pedidos} pedidos separados no iFood, um por loja.` : ""}${semOpcao ? ` Sem opção agora para: ${semOpcao}.` : ""}${faltaMercado ? ` Ficaram de fora para manter o mercado num pedido só: ${faltaMercado}. Pergunte se a pessoa quer outro item do mesmo mercado ou trazer de outra loja.` : ""}`,
      tela: { tipo: atualizado ? "plano_atualizado" as const : "mostrar_plano" as const, plano },
    };
  }
  if (nome === "pedir_revisao") {
    if (!s.plano) return { texto: "Não há plano na tela ainda. Monte com mostrar_plano primeiro." };
    if (impedimentosPlano(s.plano).length) return { texto: "Complete os complementos obrigatórios ou verifique os detalhes antes de revisar.", tela: { tipo: "plano_atualizado", plano: s.plano } };
    s.estado = "S5"; s.encaminhado = true;
    const lojas = [...new Map(s.plano.blocos.map((b) => [chaveLoja(b.principal), b.principal.loja])).values()];
    const pedidos = lojas.length > 1 ? ` São ${lojas.length} pedidos separados no iFood, um por loja (${lojas.join(", ")}), cada um com seu frete: diga isso.` : "";
    return { texto: `Revisão aberta na tela.${pedidos} Diga para a pessoa conferir e dizer "aprovo o plano".`, tela: { tipo: "aguardando_aprovacao", plano: s.plano } };
  }
  return { texto: `Ferramenta desconhecida: ${nome}` };
}

// Item do plano para o modelo: a escolhida e as alternativas, com ref, para ele poder trocar quando a pessoa tocar.
const descreverBloco = (b: PlanoSnapshot["blocos"][number]) => `${b.categoria} (categoria=${b.categoria}, vertical=${b.vertical}): ${b.quantidade}x ${b.principal.item} da ${b.principal.loja} ${reais(b.principal.precoCents)} [ref=${b.principal.ref}]${b.sugestao ? " (sugestão sua)" : ""}${b.alternativas.length ? `; alternativas: ${b.alternativas.map((o) => `${o.item} da ${o.loja} ${reais(o.precoCents)} [ref=${o.ref}]`).join(", ")}` : ""}`;

// Fala de reserva coerente com o que está na tela (opções não são plano).
const falaDaTela = (tipo: string) => tipo === "mostrar_opcoes" ? "Separei algumas opções na tela. Qual delas você prefere?" : "Montei o plano na tela. É isso, ou quer mudar algo antes de fechar?";

// Texto livre do modelo que vai para a tela: sem números (fato só vem do iFood), sem dado pessoal, sem marcação.
function textoLivre(t: string | undefined, max: number): string | undefined {
  const limpo = (t ?? "").replace(/[*#[\]_`<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  if (!limpo || /\d/.test(limpo) || PROIBIDO.test(limpo) || temDadoPessoal(limpo)) return undefined;
  return limpo;
}

// O texto do modelo explica o contexto pessoal; atributos de oferta continuam nos campos do catálogo.
function justificativaContextual(t: string | undefined): string | undefined {
  const texto = textoLivre(t, 90);
  if (!texto) return undefined;
  const atributos = /preco|frete|entrega|prazo|minuto|hora|nota|avaliad|promo|desconto|barat|rapid|gratis|gratuit|cupom|custo|taxa|disponiv|abert|fechad|estoque|qualidade|melhor|segur|alerg|lactose|gluten|composicao|saudavel/;
  return atributos.test(norm(texto)) ? undefined : texto;
}

const planoVazio = (): PlanoSnapshot => ({ planoId: "", versao: 0, blocos: [], naoAtendidas: [], pendencias: [], origem: "real" });

// A opção que a pessoa escolheu vira a principal do bloco; a anterior vira alternativa. Vale uma alternativa do bloco ou
// uma opção que a pessoa viu numa busca da MESMA categoria; opção de outra necessidade é recusada. As outras opções
// dessa busca também ficam como alternativas, para trocar tocando. frescas: tudo o que a busca de agora trouxe para o
// item (elegível agora); doPlano: opção que já esteve num plano para este item (ex.: a do mercado único).
function escolher(b: PlanoSnapshot["blocos"][number], ref: string | undefined, mem: Memoria, exigirElegibilidadeAtual: boolean, frescas: OpcaoPlano[] = []): PlanoSnapshot["blocos"][number] {
  const mesmaCategoria = (r: string) => { const g = mem.grupoDe.get(r); return g && norm(g.categoria) === norm(b.categoria) ? g : undefined; };
  const jaNoPlano = (r: string) => mem.doPlano.get(r) === norm(b.categoria);
  let principal = b.principal;
  if (ref && ref !== b.principal.ref) {
    const escolhida = b.alternativas.find((o) => o.ref === ref) ?? frescas.find((o) => o.ref === ref)
      ?? (!exigirElegibilidadeAtual && (mesmaCategoria(ref) || jaNoPlano(ref)) ? mem.opcoes.get(ref) : undefined);
    if (!escolhida) throw new Error("OPCAO_FORA_DA_NECESSIDADE");
    principal = escolhida;
  }
  const vistas = exigirElegibilidadeAtual ? [] : (ref && mesmaCategoria(ref)?.itens) || mesmaCategoria(principal.ref)?.itens || [];
  const unicas = new Map<string, OpcaoPlano>();
  for (const o of [b.principal, ...b.alternativas, ...vistas]) if (o.ref !== principal.ref && !unicas.has(o.ref)) unicas.set(o.ref, o);
  return { ...b, principal, alternativas: [...unicas.values()].slice(0, MAX_ALTERNATIVAS) };
}
const MAX_ALTERNATIVAS = 3;
