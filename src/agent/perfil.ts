// Personalização mínima: o PRIMEIRO NOME da pessoa, para o Mimo abrir a conversa chamando-a pelo nome.
// Privacidade (decisão de produto, 18/10): só o primeiro nome, só na memória do servidor, nunca em log; vai à fala (TTS de
// terceiros) apenas na saudação e uma vez no encaminhamento do plano. Duas fontes, nesta ordem:
//   1) a conta do iFood (getUser, nível BASIC), SOMENTE se o escopo extra foi habilitado de propósito
//      (IFOOD_SCOPES_EXTRA=mcp.user.basic.read, que precisa estar aprovado no portal; sem isso o login falharia);
//   2) GUIDE_NOME_DEMO: nome combinado para a demo e para o modo simulado, sem chamar ninguém.
import type { McpTools } from "./domain-mcp";
import { limparNome } from "./guardas-fala";

const g = globalThis as unknown as { __guideNomes?: Map<string, string | null> };
const conhecidos = (g.__guideNomes ??= new Map());
const MAX = 500;
const TIMEOUT_MS = 3000;

// "felipe terossi" → "Felipe". Só letras, 2 a 20 caracteres; qualquer outra coisa não vira nome.
export function primeiroNome(texto: unknown): string | undefined {
  if (typeof texto !== "string") return undefined;
  const primeiro = limparNome(texto, 60).split(" ")[0] ?? "";
  if (!/^[\p{L}][\p{L}'-]{1,19}$/u.test(primeiro)) return undefined;
  return primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR");
}

// Acha o nome na resposta do getUser sem depender do formato exato (campo direto ou aninhado).
export function nomeNaResposta(r: unknown, prof = 0): string | undefined {
  if (!r || typeof r !== "object" || prof > 4) return undefined;
  const o = r as Record<string, unknown>;
  for (const k of ["fullName", "name", "nome", "firstName"]) {
    const n = primeiroNome(o[k]);
    if (n) return n;
  }
  for (const v of Object.values(o)) { const n = nomeNaResposta(v, prof + 1); if (n) return n; }
  return undefined;
}

const escopoDoPerfil = (env: NodeJS.ProcessEnv) => /\bmcp\.user\.basic\.read\b/.test(env.IFOOD_SCOPES_EXTRA ?? "");

// Já conhecido nesta sessão? Resposta imediata, sem rede (usada no caminho de cada turno).
export function nomeConhecido(subjectRef: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return conhecidos.get(subjectRef) ?? primeiroNome(env.GUIDE_NOME_DEMO);
}

export async function carregarNome(subjectRef: string, tools: McpTools | undefined, env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> {
  const demo = primeiroNome(env.GUIDE_NOME_DEMO);
  if (!tools || !escopoDoPerfil(env)) return demo;
  if (conhecidos.has(subjectRef)) return conhecidos.get(subjectRef) ?? demo;
  const nome = await Promise.race([
    tools.callTool("getUser", {}).then(nomeNaResposta).catch(() => undefined),
    new Promise<undefined>((r) => setTimeout(() => r(undefined), TIMEOUT_MS)),
  ]);
  conhecidos.set(subjectRef, nome ?? null);
  while (conhecidos.size > MAX) conhecidos.delete(conhecidos.keys().next().value!);
  return nome ?? demo;
}

export function __resetNomesParaTestes(): void { conhecidos.clear(); }
