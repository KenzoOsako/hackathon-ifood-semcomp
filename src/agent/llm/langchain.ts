// Adaptador LangChain (D-013). Provedor e modelo vêm do ambiente; nada aqui fixa um modelo.
// O orquestrador só conhece LlmPort; LangChain não sai desta pasta.
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SYSTEM_INTERPRETAR, mensagemInterpretar } from "@/prompts/interpretar";
import { SYSTEM_RESPONDER, mensagemResponder } from "@/prompts/responder";
import { TurnoInterpretadoSchema, type InterpretarInput, type LlmPort, type ResponderInput, type TurnoInterpretado } from "../types";

export type Provedor = "anthropic" | "openai" | "google";

export async function criarModelo(provedor: Provedor, modelo: string): Promise<BaseChatModel> {
  // Import dinâmico: só carrega o pacote do provedor configurado.
  if (provedor === "anthropic") { const { ChatAnthropic } = await import("@langchain/anthropic"); return new ChatAnthropic({ model: modelo, temperature: 0, maxRetries: 1 }); }
  if (provedor === "openai") { const { ChatOpenAI } = await import("@langchain/openai"); return new ChatOpenAI({ model: modelo, temperature: 0, maxRetries: 1 }); }
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
  return new ChatGoogleGenerativeAI({ model: modelo, temperature: 0, maxRetries: 1 });
}

export class LangChainLlm implements LlmPort {
  readonly nome: string;
  constructor(private readonly model: BaseChatModel, provedor: string, modelo: string) { this.nome = `${provedor}:${modelo}`; }

  async interpretar(input: InterpretarInput, signal?: AbortSignal): Promise<TurnoInterpretado> {
    const estruturado = this.model.withStructuredOutput(TurnoInterpretadoSchema, { name: "turno_interpretado" });
    const out = await estruturado.invoke([["system", SYSTEM_INTERPRETAR], ["human", mensagemInterpretar(input)]], { signal });
    // Validar de novo na borda: a saída do provedor não é confiável por si só.
    return TurnoInterpretadoSchema.parse(out);
  }

  async responder(input: ResponderInput, signal?: AbortSignal): Promise<string> {
    const msg = await this.model.invoke([["system", SYSTEM_RESPONDER], ["human", mensagemResponder(input)]], { signal });
    const texto = typeof msg.content === "string" ? msg.content : msg.content.map((p) => ("text" in p ? p.text : "")).join("");
    return texto.trim();
  }
}
