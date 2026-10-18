// Aquecimento: a 1ª fala depois de conectar pagava ~3,7 s de partida a frio (carregar o pacote do modelo e abrir a sessão
// com o MCP do iFood + listAddresses) antes mesmo de o atendente começar. Quem abre a tela já chama /api/auth/status, então é
// ali que isso dispara, em segundo plano. Só prepara conexões: não chama o modelo (não gasta cota) nem pesquisa nada.
import { dominioRealDo } from "./domain-mcp/por-sujeito";
import { PROVEDORES, criarModelo, type Provedor } from "./llm/langchain";

const g = globalThis as unknown as { __guideAquecido?: Set<string> };
const aquecidos = (g.__guideAquecido ??= new Set<string>());

export function aquecerAgente(subjectRef: string, real: boolean): void {
  const provedor = process.env.LLM_PROVIDER;
  const modelo = process.env.ATENDENTE_MODEL || process.env.LLM_MODEL;
  if (provedor && PROVEDORES.has(provedor) && modelo && !aquecidos.has("modelo")) {
    aquecidos.add("modelo");
    void criarModelo(provedor as Provedor, modelo).catch(() => aquecidos.delete("modelo")); // só carrega o pacote do provedor
  }
  if (real && !aquecidos.has(subjectRef)) {
    aquecidos.add(subjectRef);
    if (aquecidos.size > 2000) aquecidos.delete(aquecidos.values().next().value!);
    void dominioRealDo(subjectRef).catch(() => aquecidos.delete(subjectRef)); // abre o MCP e resolve o local da pessoa
  }
}
