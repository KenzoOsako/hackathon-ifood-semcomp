import { LangChainLlm, criarModelo } from "../src/agent/llm/langchain";
const llm = new LangChainLlm(await criarModelo("google", process.env.LLM_MODEL!), "google", process.env.LLM_MODEL!);
for (const texto of process.argv.slice(2)) {
  const t = await llm.interpretar({ texto, pressaDetectada: false, semCatalogo: ["GROCERIES", "SHOPPING"], session: { estado: "S0", perguntasFeitas: 0, ocasiao: {}, necessidades: [], history: [], opcoesFaladas: [] } });
  console.log(texto, "=>", t.intencao, t.nivel, JSON.stringify(t.necessidades.map((n) => [n.vertical, n.categoria, n.fonte, n.consultas])), t.pergunta ?? "");
}
