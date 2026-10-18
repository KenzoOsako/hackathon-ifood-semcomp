// Orquestrador do Guide: um turno = interpretar (LLM) → regras em código → domínio → resposta.
// Estados S0–S7 conforme docs/AGENTE_CONVERSA_E_FLUXO.md §3. O prompt orienta; este arquivo garante
// teto de perguntas, nível que só rebaixa, encaminhamento único e que aprovação nunca é executada aqui.
import { falaRespeitaSnapshot, respostaTemplate } from "@/prompts/responder";
import { FRASES, LIMIARES_CONFIANCA } from "../frases";
import { PRESSA, rebaixar } from "../llm/rules";
import { temDadoPessoal } from "../privacidade";
import type { AgentReply, AgentSession, ConverseInput, DomainPort, EventoFeedback, LlmPort, Necessidade, Nivel, PlanoSnapshot, TurnoInterpretado } from "../types";

export const MAX_PERGUNTAS = 3;
const MAX_PERGUNTAS_L1 = 1;
const MAX_CONFIRMACOES_SEGUIDAS = 2;
const TIMEOUT_INTERPRETAR_MS = 8000;
const TIMEOUT_RESPONDER_MS = 8000;
const HISTORICO = 12;
const MAX_SESSOES = 2000;

// Frases fixas moram em ../frases (contrato com a voz); reexportadas para quem já importava daqui.
export { FRASES };

// Frases livres do LLM que não podem chegar ao usuário.
// Números da fala do plano são checados à parte, contra o snapshot (falaRespeitaSnapshot).
const PROIBIDO = /pedido (foi )?(feito|realizado|enviado|confirmado)|compra (foi )?(feita|realizada|concluida|concluída)|\bcpf\b|cart[aã]o|senha|[[\]*#]/i;

export interface Deps { llm: LlmPort; domain: DomainPort; now?: () => number }

export function novaSessao(subjectRef: string): AgentSession {
  return { subjectRef, estado: "S0", perguntasFeitas: 0, confirmacoesSeguidas: 0, restricoes: [], turnos: 0, encaminhado: false, history: [], ocasiao: {}, necessidades: [], recusadas: [] };
}

// Estado do agente por sujeito da sessão de visitante (mesmo processo; RAM, como D-010).
const g = globalThis as unknown as { __guideSessions?: Map<string, AgentSession> };
const sessoes = (g.__guideSessions ??= new Map());
export function sessaoDo(subjectRef: string): AgentSession {
  const s = sessoes.get(subjectRef) ?? novaSessao(subjectRef);
  // Reinserir move para o fim: o descarte por capacidade tira a menos usada, não a mais antiga.
  sessoes.delete(subjectRef); sessoes.set(subjectRef, s);
  if (sessoes.size > MAX_SESSOES) sessoes.delete(sessoes.keys().next().value!);
  return s;
}

// Conversa nova para o mesmo visitante (ex.: medir a jornada várias vezes). Login iFood não é afetado.
export function reiniciarSessao(subjectRef: string): AgentSession {
  sessoes.delete(subjectRef);
  return sessaoDo(subjectRef);
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const APROVACAO_EXPLICITA = /\b(aprovo|confirmo)( o)? plano\b/;

async function comTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); } finally { clearTimeout(timer); }
}

const AFIRMA = /^(sim|isso|exato|exatamente|certo|correto|pode|ok|beleza|fechou|perfeito|e isso|e sim)\b/;
const NEGA = /^(nao|negativo|errado|nada disso)\b/;
const CRITERIO_FALADO: Record<string, string> = { mais_barata: "pela opção mais barata", mais_rapida: "pela opção mais rápida", melhor_avaliada: "pela opção mais bem avaliada", favorita: "pela sua favorita", outra: "por outra opção" };

// Texto montado em código (não pelo LLM) com o que vai ser feito; undefined = nada a confirmar.
function resumoParaConfirmar(s: AgentSession, turno: TurnoInterpretado, texto: string): string | undefined {
  if (turno.intencao === "aprovar" && APROVACAO_EXPLICITA.test(texto) && s.plano) return `Entendi que você quer aprovar a versão ${s.plano.versao} do plano. É isso?`;
  if (turno.intencao === "ajustar" && turno.ajuste && s.plano) {
    return `Entendi: trocar ${turno.ajuste.categoria ? `a ${turno.ajuste.categoria}` : "o plano"} ${CRITERIO_FALADO[turno.ajuste.criterio]}. É isso?`;
  }
  if ((turno.intencao === "pedido" || turno.intencao === "responder") && turno.necessidades.length > 0) {
    const itens = turno.necessidades.filter((n) => n.fonte !== "inferido").map((n) => n.categoria);
    if (itens.length === 0) return undefined;
    const pessoas = turno.ocasiao.pessoas ? `, para ${turno.ocasiao.pessoas} pessoas` : "";
    const restricoes = [...new Set(turno.necessidades.flatMap((n) => n.restricoes))];
    const sem = restricoes.length ? `, sem ${restricoes.join(" e sem ")}` : "";
    return `Entendi: ${itens.join(" e ")}${pessoas}${sem}. É isso?`;
  }
  return undefined;
}

// Interromper o Guide é sinal de pressa, exceto quando ele acabou de perguntar (S2): aí a pessoa só está
// respondendo, e um "sim" curto não é pressa. Fala curta sozinha não conta: é ambígua demais sem calibração.
function pressaPelaVoz(s: AgentSession, input: ConverseInput): boolean {
  return input.sinais?.origem === "voz" && input.sinais.interrompeu && s.estado !== "S2";
}

// Telemetria nunca derruba o turno nem deixa estado pela metade.
function evento(deps: Deps, s: AgentSession, e: EventoFeedback) {
  void deps.domain.registrarEvento(s.subjectRef, e).catch(() => undefined);
}

export async function executarTurno(s: AgentSession, input: ConverseInput, deps: Deps): Promise<AgentReply> {
  const now = deps.now ?? (() => performance.now());
  const t0 = now();
  const tempos: AgentReply["tempos"] = { interpretarMs: 0, totalMs: 0 };
  const texto = norm(input.texto);
  const pressa = PRESSA.test(texto) || pressaPelaVoz(s, input);
  s.turnos += 1;

  // Resposta a uma confirmação pendente: "sim" segue com o que foi entendido, sem chamar o LLM de novo.
  const pendente = s.confirmacaoPendente;
  s.confirmacaoPendente = undefined;
  if (pendente && NEGA.test(texto)) return fechar(s, input, deps, { resposta: FRASES.confirmacaoNegada }, tempos, t0);
  if (pendente && AFIRMA.test(texto)) return despachar(s, input, deps, pendente.turno, pendente.texto, pendente.pressa, tempos, t0);

  // Confiança baixa do STT: a voz já deveria ter pedido para repetir; defesa aqui, sem gastar LLM.
  const confianca = input.sinais?.origem === "voz" ? input.sinais.confianca : undefined;
  if (confianca !== undefined && confianca < LIMIARES_CONFIANCA.repetir) {
    return fechar(s, input, deps, { resposta: FRASES.naoEntendi }, tempos, t0);
  }

  let turno: TurnoInterpretado;
  try {
    turno = await comTimeout(TIMEOUT_INTERPRETAR_MS, (signal) => deps.llm.interpretar({
      texto: input.texto, hipoteses: input.hipoteses, pressaDetectada: pressa,
      session: { estado: s.estado, nivel: s.nivel, perguntasFeitas: s.perguntasFeitas, ocasiao: s.ocasiao, necessidades: s.necessidades, history: s.history, opcoesFaladas: opcoesFaladas(s.plano) },
    }, signal));
  } catch {
    // Saída inválida ou falha do provedor: frase curta, nada inventado, nível intacto.
    tempos.interpretarMs = Math.round(now() - t0);
    return fechar(s, input, deps, { resposta: FRASES.naoEntendi }, tempos, t0);
  }
  tempos.interpretarMs = Math.round(now() - t0);

  // Confiança média: confirmar o entendido antes de agir. Não conta no teto de perguntas.
  // Quem acabou de responder a uma confirmação não é confirmado de novo (evita laço).
  const resumo = !pendente && confianca !== undefined && confianca < LIMIARES_CONFIANCA.confirmar ? resumoParaConfirmar(s, turno, texto) : undefined;
  if (resumo) {
    s.confirmacaoPendente = { turno, texto, pressa };
    return fechar(s, input, deps, { resposta: resumo }, tempos, t0);
  }
  return despachar(s, input, deps, turno, texto, pressa, tempos, t0);
}

function despachar(s: AgentSession, input: ConverseInput, deps: Deps, turno: TurnoInterpretado, texto: string, pressa: boolean, tempos: AgentReply["tempos"], t0: number): Promise<AgentReply> | AgentReply {
  if (pressa) s.nivel = "L0";
  if (turno.intencao !== "incerto") s.confirmacoesSeguidas = 0;

  switch (turno.intencao) {
    case "fora_escopo":
      if (s.estado === "S0") s.estado = "S1";
      return fechar(s, input, deps, { resposta: FRASES.foraEscopo }, tempos, t0);

    case "conversa":
      if (s.estado === "S0") s.estado = "S1";
      return fechar(s, input, deps, { resposta: FRASES.oQueFaco }, tempos, t0);

    case "incerto":
      return processarIncerto(s, input, deps, turno, tempos, t0);

    case "aprovar":
      return processarAprovar(s, input, deps, turno, texto, tempos, t0);

    case "consentir":
      return consentir(s, input, deps, turno, tempos, t0);

    case "ajustar":
      if (s.plano && turno.ajuste) return ajustar(s, input, deps, turno, tempos, t0);
      aplicarEstado(s, turno);
      return montar(s, input, deps, turno, tempos, t0);

    default:
      return processarPedidoOuResposta(s, input, deps, turno, pressa, tempos, t0);
  }
}

function processarIncerto(s: AgentSession, input: ConverseInput, deps: Deps, turno: TurnoInterpretado, tempos: AgentReply["tempos"], t0: number): AgentReply {
  // Confirmação de reconhecimento não conta no teto, mas tem limite próprio para não virar pergunta disfarçada.
  s.confirmacoesSeguidas += 1;
  if (s.confirmacoesSeguidas > MAX_CONFIRMACOES_SEGUIDAS) {
    return fechar(s, input, deps, { resposta: s.plano ? FRASES.jaEncaminhado : FRASES.semNecessidade }, tempos, t0);
  }
  const c = turno.confirmacao;
  const valida = Boolean(c && !PROIBIDO.test(c) && !temDadoPessoal(c) && c.trim().endsWith("?"));
  return fechar(s, input, deps, { resposta: valida && c ? c : FRASES.repetir }, tempos, t0);
}

function processarAprovar(s: AgentSession, input: ConverseInput, deps: Deps, turno: TurnoInterpretado, texto: string, tempos: AgentReply["tempos"], t0: number): Promise<AgentReply> | AgentReply {
  // A classificação do LLM não basta: só a frase explícita, no texto do usuário, sinaliza aprovação.
  // O agente só devolve planoId + versão; quem valida e aprova é o domínio.
  if (!APROVACAO_EXPLICITA.test(texto)) return consentir(s, input, deps, turno, tempos, t0);
  if (!s.plano) return fechar(s, input, deps, { resposta: FRASES.semPlano }, tempos, t0);
  s.estado = "S5"; s.encaminhado = true;
  return fechar(s, input, deps, { resposta: FRASES.aprovacaoEnviada, aprovacao: { planoId: s.plano.planoId, versao: s.plano.versao }, tela: { tipo: "aguardando_aprovacao", plano: s.plano } }, tempos, t0);
}

function processarPedidoOuResposta(s: AgentSession, input: ConverseInput, deps: Deps, turno: TurnoInterpretado, pressa: boolean, tempos: AgentReply["tempos"], t0: number): Promise<AgentReply> | AgentReply {
  if (!pressa) s.nivel = rebaixar(s.nivel, turno.nivel);
  const mudou = aplicarEstado(s, turno);
  if (s.necessidades.length === 0) {
    s.estado = "S1";
    return fechar(s, input, deps, { resposta: FRASES.semNecessidade }, tempos, t0);
  }
  if (s.plano && !mudou) return fechar(s, input, deps, { resposta: FRASES.jaEncaminhado, tela: { tipo: "aguardando_aprovacao", plano: s.plano } }, tempos, t0);
  if (devePerguntar(s, turno, pressa) && turno.pergunta) {
    s.perguntasFeitas += 1; s.estado = "S2";
    return fechar(s, input, deps, { resposta: comSaida(turno.pergunta) }, tempos, t0);
  }
  return montar(s, input, deps, turno, tempos, t0);
}

function devePerguntar(s: AgentSession, turno: TurnoInterpretado, pressa: boolean): boolean {
  const limite = s.nivel === "L1" ? MAX_PERGUNTAS_L1 : MAX_PERGUNTAS;
  // Pergunta com conteúdo proibido é descartada: segue para o plano em vez de falar algo indevido.
  return Boolean(turno.pergunta && !PROIBIDO.test(turno.pergunta) && !temDadoPessoal(turno.pergunta) && s.nivel !== "L0" && !pressa && s.perguntasFeitas < limite);
}

async function consentir(s: AgentSession, input: ConverseInput, deps: Deps, turno: TurnoInterpretado, tempos: AgentReply["tempos"], t0: number): Promise<AgentReply> {
  if (s.plano) {
    const resposta = s.encaminhado ? FRASES.jaEncaminhado : FRASES.encaminhar;
    s.estado = "S5"; s.encaminhado = true;
    evento(deps, s, { tipo: "reacao", planoId: s.plano.planoId, reacao: "aceitou", motivo: "outro" });
    return fechar(s, input, deps, { resposta, tela: { tipo: "aguardando_aprovacao", plano: s.plano } }, tempos, t0);
  }
  aplicarEstado(s, turno);
  return montar(s, input, deps, turno, tempos, t0);
}

const COMIDA = (n: Necessidade) => n.vertical !== "SHOPPING";
const ordenarStrings = (lista: string[]) => [...lista].sort((a, b) => a.localeCompare(b));
const assinatura = (s: AgentSession) => JSON.stringify([s.ocasiao.pessoas ?? null, s.necessidades.map((n) => [n.vertical, norm(n.categoria), ordenarStrings(n.restricoes), n.orcamento ?? null, n.fonte ?? "dito"])]);
const chave = (n: Necessidade) => norm(n.categoria).split(" ")[0];
const NAO_SUGERIR = /cerveja|vinho|vodka|whisky|cachaca|alcool|destilad|remedio|medic|farmacia/;

// Sugestões do Guide (fonte "inferido"): sem cota própria (o teto é o do plano, 5 itens), mas nunca o que foi
// recusado ou está fora do escopo. Sugestão que some da lista conta como recusa e não volta; o que o usuário
// pediu não vira sugestão de novo.
function aplicarSugestoes(s: AgentSession, lista: Necessidade[]): Necessidade[] {
  const anteriores = new Map(s.necessidades.map((n) => [chave(n), n]));
  const novas = lista.map((n) => ({ ...n }));
  const agora = new Set(novas.map(chave));
  for (const n of s.necessidades) if (n.fonte === "inferido" && !agora.has(chave(n)) && !s.recusadas.includes(chave(n))) s.recusadas.push(chave(n));
  for (const n of novas) if (n.fonte === "inferido" && anteriores.has(chave(n)) && anteriores.get(chave(n))!.fonte !== "inferido") n.fonte = "dito";
  return novas.filter((n) => n.fonte !== "inferido" || !(s.recusadas.includes(chave(n)) || NAO_SUGERIR.test(norm(n.categoria))));
}

// Devolve true se o pedido mudou de fato (aí o plano anterior deixa de valer).
function aplicarEstado(s: AgentSession, turno: TurnoInterpretado): boolean {
  const antes = assinatura(s);
  // Restrição rígida é da sessão: só soma e vale para toda comida/mercado, mesmo se o LLM omitir ou renumerar.
  for (const n of turno.necessidades) for (const r of n.restricoes) if (!s.restricoes.includes(norm(r))) s.restricoes.push(norm(r));
  // LLM que devolve lista vazia por esquecimento não apaga o que já foi entendido.
  if (turno.necessidades.length > 0) s.necessidades = aplicarSugestoes(s, turno.necessidades);
  s.necessidades = s.necessidades.map((n) => (COMIDA(n) ? { ...n, restricoes: [...new Set([...n.restricoes.map(norm), ...s.restricoes])] } : n));
  s.ocasiao = { ...s.ocasiao, ...turno.ocasiao };
  const mudou = assinatura(s) !== antes;
  if (mudou && s.plano) { s.plano = undefined; s.encaminhado = false; }
  return mudou;
}

function comSaida(pergunta: string): string {
  return /escolh/.test(norm(pergunta)) ? pergunta : `${pergunta.trimEnd()} Ou posso escolher por você.`;
}

async function montar(s: AgentSession, input: ConverseInput, deps: Deps, turno: TurnoInterpretado, tempos: AgentReply["tempos"], t0: number): Promise<AgentReply> {
  const now = deps.now ?? (() => performance.now());
  if (s.necessidades.length === 0) return fechar(s, input, deps, { resposta: FRASES.semNecessidade }, tempos, t0);
  const td = now();
  let plano: PlanoSnapshot;
  try {
    const itens = await Promise.all(s.necessidades.map(async (n) => ({ necessidade: n, opcoes: await deps.domain.buscarNecessidade(n, s.ocasiao) })));
    plano = await deps.domain.montarPlano({ subjectRef: s.subjectRef, ocasiao: s.ocasiao, itens });
  } catch {
    tempos.dominioMs = Math.round(now() - td);
    return fechar(s, input, deps, { resposta: FRASES.erroFerramenta }, tempos, t0);
  }
  tempos.dominioMs = Math.round(now() - td);
  for (const n of plano.naoAtendidas) evento(deps, s, { tipo: "necessidade_nao_atendida", categoria: n.categoria, causa: n.motivo });
  if (plano.blocos.length === 0) {
    // Plano vazio não vira plano: nada para encaminhar ou aprovar.
    s.plano = undefined; s.estado = "S1";
    const faltas = plano.naoAtendidas.map((n) => n.categoria).join(" e ");
    return fechar(s, input, deps, { resposta: `Ainda não tenho opção compatível para ${faltas}. Quer tentar outra coisa?` }, tempos, t0);
  }
  s.plano = plano; s.estado = "S3"; s.encaminhado = false;
  evento(deps, s, { tipo: "opcoes_exibidas", planoId: plano.planoId, versao: plano.versao, blocos: plano.blocos.length, origem: plano.origem });
  evento(deps, s, { tipo: "friccao", perguntas: s.perguntasFeitas, nivel: s.nivel ?? "L1", turnos: s.turnos });
  const resposta = await falar(deps, { plano, assumido: turno.assumido }, tempos);
  return fechar(s, input, deps, { resposta, fraseEspera: FRASES.espera, tela: { tipo: "mostrar_plano", plano } }, tempos, t0);
}

async function ajustar(s: AgentSession, input: ConverseInput, deps: Deps, turno: TurnoInterpretado, tempos: AgentReply["tempos"], t0: number): Promise<AgentReply> {
  const now = deps.now ?? (() => performance.now());
  const atual = s.plano!;
  const td = now();
  let plano: PlanoSnapshot;
  try {
    plano = await deps.domain.ajustarPlano({ subjectRef: s.subjectRef, planoId: atual.planoId, versao: atual.versao, categoria: turno.ajuste!.categoria, criterio: turno.ajuste!.criterio });
  } catch (error) {
    tempos.dominioMs = Math.round(now() - td);
    const semDado = error instanceof Error && error.message === "SEM_DADO_CRITERIO";
    return fechar(s, input, deps, { resposta: semDado ? FRASES.semDadoCriterio : FRASES.erroFerramenta, ...(semDado ? { tela: { tipo: "plano_atualizado" as const, plano: atual } } : {}) }, tempos, t0);
  }
  tempos.dominioMs = Math.round(now() - td);
  if (plano.versao === atual.versao) return fechar(s, input, deps, { resposta: FRASES.semMudanca, tela: { tipo: "plano_atualizado", plano: atual } }, tempos, t0);
  const mudou = plano.blocos.find((b, i) => b.principal.ref !== atual.blocos[i]?.principal.ref)?.categoria;
  // Nova versão invalida qualquer encaminhamento/aprovação anterior.
  s.plano = plano; s.estado = "S4"; s.encaminhado = false;
  evento(deps, s, { tipo: "reacao", planoId: plano.planoId, reacao: "ajustou", motivo: turno.ajuste!.criterio });
  const resposta = await falar(deps, { plano, mudou, assumido: [] }, tempos);
  return fechar(s, input, deps, { resposta, fraseEspera: FRASES.espera, tela: { tipo: "plano_atualizado", plano } }, tempos, t0);
}

async function falar(deps: Deps, input: { plano: PlanoSnapshot; mudou?: string; assumido: string[] }, tempos: AgentReply["tempos"]): Promise<string> {
  const now = deps.now ?? (() => performance.now());
  const tr = now();
  try {
    const fala = await comTimeout(TIMEOUT_RESPONDER_MS, (signal) => deps.llm.responder(input, signal));
    // Fala com número fora do snapshot, conteúdo proibido ou dado pessoal cai para o template.
    if (!fala || !falaRespeitaSnapshot(fala, input.plano) || PROIBIDO.test(fala) || temDadoPessoal(fala) || /muito pedid|\bnovo\b|\bnova\b/i.test(fala)) return respostaTemplate(input);
    return fala;
  } catch {
    return respostaTemplate(input);
  } finally {
    tempos.responderMs = Math.round(now() - tr);
  }
}

function opcoesFaladas(plano?: PlanoSnapshot): string[] {
  return plano ? plano.blocos.flatMap((b) => [b.principal, ...b.alternativas].map((o) => `${o.item} da ${o.loja}`)) : [];
}

function fechar(s: AgentSession, input: ConverseInput, deps: Deps, out: Pick<AgentReply, "resposta"> & Partial<Pick<AgentReply, "fraseEspera" | "tela" | "aprovacao">>, tempos: AgentReply["tempos"], t0: number): AgentReply {
  const now = deps.now ?? (() => performance.now());
  let resposta = out.resposta;
  // Anti-repetição só para a fala do plano: perguntas e erros podem ser repetidos legitimamente.
  if (resposta === s.ultimaFala && s.plano && out.tela && resposta !== FRASES.jaEncaminhado) resposta = FRASES.jaEncaminhado;
  s.ultimaFala = resposta;
  s.history.push({ role: "user", text: input.texto }, { role: "agent", text: resposta });
  if (s.history.length > HISTORICO) s.history.splice(0, s.history.length - HISTORICO);
  tempos.totalMs = Math.round(now() - t0);
  const nivel: Nivel = s.nivel ?? "L1";
  return { estado: s.estado, nivel, resposta, ...(out.fraseEspera ? { fraseEspera: out.fraseEspera } : {}), ...(out.tela ? { tela: out.tela } : {}), ...(out.aprovacao ? { aprovacao: out.aprovacao } : {}), origem: s.plano?.origem ?? "simulado", llm: deps.llm.nome, tempos };
}
