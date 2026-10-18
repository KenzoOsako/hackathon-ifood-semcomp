import { LangChainLlm, criarModelo } from "../src/agent/llm/langchain";
for (const m of process.argv.slice(2)) {
  const llm = new LangChainLlm(await criarModelo("google", m), "google", m);
  for (let i = 0; i < 2; i++) {
    const t = Date.now();
    try { const r = await llm.interpretar({ texto: "quero comer hot roll", pressaDetectada: false, semCatalogo: [], session: { estado: "S0", perguntasFeitas: 0, ocasiao: {}, necessidades: [], history: [], opcoesFaladas: [] } }); console.log(m, "ok", Date.now() - t, r.intencao); }
    catch (e) { console.log(m, "ERRO", Date.now() - t, String((e as Error).message).slice(0, 200)); }
  }
}
