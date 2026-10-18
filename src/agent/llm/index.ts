import type { LlmPort } from "../types";
import { LangChainLlm, criarModelo, type Provedor } from "./langchain";
import { RuleBasedLlm } from "./rules";

const PROVEDORES = new Set<Provedor>(["anthropic", "openai", "google"]);

// LLM_PROVIDER + LLM_MODEL escolhem o modelo; sem eles, modo degradado por regras (declarado em `llm` na resposta).
export async function criarLlm(env: NodeJS.ProcessEnv = process.env): Promise<LlmPort> {
  const provedor = env.LLM_PROVIDER as Provedor | undefined;
  const modelo = env.LLM_MODEL;
  if (!provedor || !modelo) return new RuleBasedLlm();
  if (!PROVEDORES.has(provedor)) throw new Error("LLM_PROVIDER inválido");
  return new LangChainLlm(await criarModelo(provedor, modelo), provedor, modelo);
}
