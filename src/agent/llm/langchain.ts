// Adaptador LangChain (D-013). Provedor e modelo vêm do ambiente; nada aqui fixa um modelo.
// O orquestrador só conhece LlmPort; LangChain não sai desta pasta.
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { sanearTurno } from "./sanear";
import { SYSTEM_INTERPRETAR, mensagemInterpretar } from "@/prompts/interpretar";
import { SYSTEM_RELEVANCIA, VeredictosSchema, mensagemRelevancia } from "@/prompts/relevancia";
import { SYSTEM_RESPONDER, mensagemResponder } from "@/prompts/responder";
import { TurnoInterpretadoSchema, type CandidatoJulgado, type InterpretarInput, type LlmPort, type Necessidade, type ResponderInput, type TurnoInterpretado, type Veredito } from "../types";

export type Provedor = "anthropic" | "openai" | "google";

export async function criarModelo(provedor: Provedor, modelo: string): Promise<BaseChatModel> {
  // Import dinâmico: só carrega o pacote do provedor configurado.
  // Teto de saída: o JSON do turno tem ~200 tokens e a fala ~100. Se o modelo disparar num campo, para logo
  // em vez de segurar o turno até o timeout.
  if (provedor === "anthropic") { const { ChatAnthropic } = await import("@langchain/anthropic"); return new ChatAnthropic({ model: modelo, temperature: 0, maxRetries: 1, maxTokens: MAX_SAIDA }); }
  if (provedor === "openai") { const { ChatOpenAI } = await import("@langchain/openai"); return new ChatOpenAI({ model: modelo, temperature: 0, maxRetries: 1, maxTokens: MAX_SAIDA }); }
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
  return new ChatGoogleGenerativeAI({ model: modelo, temperature: 0, maxRetries: 0, maxOutputTokens: MAX_SAIDA });
}

const MAX_SAIDA = 600;
const ATRASO_RESERVA_MS = 900;

// Resposta crua do modelo (tool call ou texto JSON), para aproveitar o que veio quando a validação estrita falha.
function bruto(msg: BaseMessage): unknown {
  const chamadas = (msg as AIMessage).tool_calls;
  if (chamadas?.length) return chamadas[0].args;
  const texto = typeof msg.content === "string" ? msg.content : msg.content.map((p) => ("text" in p ? p.text : "")).join("");
  try { return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return undefined; }
}

export class LangChainLlm implements LlmPort {
  readonly nome: string;
  constructor(private readonly model: BaseChatModel, provedor: string, modelo: string, private readonly reserva?: BaseChatModel) { this.nome = `${provedor}:${modelo}`; }

  // Modelo sobrecarregado (503) ou lento: a nova tentativa no mesmo modelo só soma espera (era 10 s+ de backoff).
  // Vai direto ao modelo de reserva, se houver; sem reserva, o erro sobe e o orquestrador usa o plano B (template).
  // Latência de cauda: se o principal passa de ATRASO_RESERVA_MS sem responder, a reserva é chamada em paralelo e vale
  // quem responder primeiro (a lentidão do provedor oscila de 1 s a 25 s no mesmo modelo).
  private async tentar<T>(fn: (m: BaseChatModel) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const reserva = this.reserva;
    if (!reserva) return fn(this.model);
    return new Promise<T>((resolve, reject) => {
      let falhas = 0, ultimo: unknown, resolvido = false;
      const ok = (v: T) => { if (!resolvido) { resolvido = true; clearTimeout(timer); resolve(v); } };
      const erro = (e: unknown) => { ultimo = e; falhas += 1; if (!resolvido && (signal?.aborted || falhas === 2)) { resolvido = true; clearTimeout(timer); reject(ultimo); } };
      const chamarReserva = () => { clearTimeout(timer); if (!iniciada) { iniciada = true; fn(reserva).then(ok, erro); } };
      let iniciada = false;
      const timer = setTimeout(chamarReserva, ATRASO_RESERVA_MS);
      fn(this.model).then(ok, (e) => { if (iniciada) erro(e); else { ultimo = e; falhas += 1; if (signal?.aborted) { resolvido = true; clearTimeout(timer); reject(e); } else chamarReserva(); } });
    });
  }

  async interpretar(input: InterpretarInput, signal?: AbortSignal): Promise<TurnoInterpretado> {
    const uma = (): Promise<TurnoInterpretado> => this.tentar(async (m) => {
      const estruturado = m.withStructuredOutput(TurnoInterpretadoSchema, { name: "turno_interpretado", includeRaw: true });
      const out = await estruturado.invoke([["system", SYSTEM_INTERPRETAR], ["human", mensagemInterpretar(input)]], { signal });
      // Validar de novo na borda: a saída do provedor não é confiável por si só. Se a validação estrita falhou
      // (parsed nulo), aproveita a resposta crua sem os campos de enfeite fora do formato.
      return TurnoInterpretadoSchema.parse(out.parsed ?? sanearTurno(bruto(out.raw)));
    }, signal);
    const turno = await uma();
    // Confiabilidade do modelo: um pedido claro que volta SEM necessidades (esquecimento ocasional) ganha uma nova
    // tentativa, uma só. Se a segunda também vier vazia ou falhar, vale a primeira e o agente pergunta o que a pessoa quer.
    if (turno.intencao === "pedido" && turno.necessidades.length === 0 && input.session.necessidades.length === 0 && !signal?.aborted) {
      try {
        const outra = await uma();
        if (outra.necessidades.length > 0) return outra;
      } catch { /* mantém a primeira resposta */ }
    }
    return turno;
  }

  // Juiz de relevância: uma chamada curta e estruturada. Índice fora da lista é ignorado (a saída do provedor não é confiável).
  async julgar(input: { necessidade: Necessidade; candidatos: CandidatoJulgado[] }, signal?: AbortSignal): Promise<Record<string, Veredito>> {
    const out = await this.tentar(async (m) => VeredictosSchema.parse(await m.withStructuredOutput(VeredictosSchema, { name: "veredictos_relevancia" }).invoke([["system", SYSTEM_RELEVANCIA], ["human", mensagemRelevancia(input.necessidade, input.candidatos)]], { signal })), signal);
    const mapa: Record<string, Veredito> = {};
    for (const { i, v } of out.itens) { const c = input.candidatos[i]; if (c) mapa[c.ref] = v; }
    return mapa;
  }

  async responder(input: ResponderInput, signal?: AbortSignal): Promise<string> {
    const msg = await this.tentar((m) => m.invoke([["system", SYSTEM_RESPONDER], ["human", mensagemResponder(input)]], { signal }), signal);
    const texto = typeof msg.content === "string" ? msg.content : msg.content.map((p) => ("text" in p ? p.text : "")).join("");
    return texto.trim();
  }
}
