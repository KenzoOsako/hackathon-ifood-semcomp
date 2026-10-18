// Adaptador LangChain (D-013). Provedor e modelo vêm do ambiente; nada aqui fixa um modelo.
// Quem conduz a conversa é o atendente (src/agent/atendente), que liga as ferramentas neste modelo.
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type Provedor = "anthropic" | "openai" | "google";
export const PROVEDORES: ReadonlySet<string> = new Set<Provedor>(["anthropic", "openai", "google"]);

// Teto de saída: a fala do atendente é curta; se o modelo disparar, para logo em vez de segurar o turno.
const MAX_SAIDA = 600;

export async function criarModelo(provedor: Provedor, modelo: string): Promise<BaseChatModel> {
  // Import dinâmico: só carrega o pacote do provedor configurado.
  if (provedor === "anthropic") { const { ChatAnthropic } = await import("@langchain/anthropic"); return new ChatAnthropic({ model: modelo, temperature: 0, maxRetries: 1, maxTokens: MAX_SAIDA }); }
  if (provedor === "openai") { const { ChatOpenAI } = await import("@langchain/openai"); return new ChatOpenAI({ model: modelo, temperature: 0, maxRetries: 1, maxTokens: MAX_SAIDA }); }
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
  return new ChatGoogleGenerativeAI({ model: modelo, temperature: 0, maxRetries: 1, maxOutputTokens: MAX_SAIDA });
}
