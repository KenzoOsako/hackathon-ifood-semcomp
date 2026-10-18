// Adaptador LangChain (D-013). Provedor e modelo vêm do ambiente; nada aqui fixa um modelo.
// O orquestrador só conhece LlmPort; LangChain não sai desta pasta.
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { sanearTurno } from "./sanear";
import { SYSTEM_INTERPRETAR, mensagemInterpretar } from "@/prompts/interpretar";
import { SYSTEM_RESPONDER, mensagemResponder } from "@/prompts/responder";
import { TurnoInterpretadoSchema, type InterpretarInput, type LlmPort, type ResponderInput, type TurnoInterpretado } from "../types";

export type Provedor = "anthropic" | "openai" | "google";

export async function criarModelo(provedor: Provedor, modelo: string): Promise<BaseChatModel> {
  // Import dinâmico: só carrega o pacote do provedor configurado.
  // Teto de saída: o JSON do turno tem ~200 tokens e a fala ~100. Se o modelo disparar num campo, para logo
  // em vez de segurar o turno até o timeout.
  if (provedor === "anthropic") { const { ChatAnthropic } = await import("@langchain/anthropic"); return new ChatAnthropic({ model: modelo, temperature: 0, maxRetries: 1, maxTokens: MAX_SAIDA }); }
  if (provedor === "openai") { const { ChatOpenAI } = await import("@langchain/openai"); return new ChatOpenAI({ model: modelo, temperature: 0, maxRetries: 1, maxTokens: MAX_SAIDA }); }
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
  return new ChatGoogleGenerativeAI({ model: modelo, temperature: 0, maxRetries: 1, maxOutputTokens: MAX_SAIDA });
}

const MAX_SAIDA = 600;

// Resposta crua do modelo (tool call ou texto JSON), para aproveitar o que veio quando a validação estrita falha.
function bruto(msg: BaseMessage): unknown {
  const chamadas = (msg as AIMessage).tool_calls;
  if (chamadas?.length) return chamadas[0].args;
  const texto = typeof msg.content === "string" ? msg.content : msg.content.map((p) => ("text" in p ? p.text : "")).join("");
  try { return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return undefined; }
}

export class LangChainLlm implements LlmPort {
  readonly nome: string;
  constructor(private readonly model: BaseChatModel, provedor: string, modelo: string) { this.nome = `${provedor}:${modelo}`; }

  async interpretar(input: InterpretarInput, signal?: AbortSignal): Promise<TurnoInterpretado> {
    const estruturado = this.model.withStructuredOutput(TurnoInterpretadoSchema, { name: "turno_interpretado", includeRaw: true });
    const out = await estruturado.invoke([["system", SYSTEM_INTERPRETAR], ["human", mensagemInterpretar(input)]], { signal });
    // Validar de novo na borda: a saída do provedor não é confiável por si só. Se a validação estrita falhou
    // (parsed nulo), aproveita a resposta crua sem os campos de enfeite fora do formato.
    return TurnoInterpretadoSchema.parse(out.parsed ?? sanearTurno(bruto(out.raw)));
  }

  async responder(input: ResponderInput, signal?: AbortSignal): Promise<string> {
    const msg = await this.model.invoke([["system", SYSTEM_RESPONDER], ["human", mensagemResponder(input)]], { signal });
    const texto = typeof msg.content === "string" ? msg.content : msg.content.map((p) => ("text" in p ? p.text : "")).join("");
    return texto.trim();
  }
}
