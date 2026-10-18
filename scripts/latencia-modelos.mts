// Mede interpretar + responder reais por modelo (3 rodadas). Uso: npx tsx scripts/latencia-modelos.ts modeloA modeloB ...
import { LangChainLlm, criarModelo } from "../src/agent/llm/langchain";
const modelos = process.argv.slice(2);
const entrada = (texto: string) => ({ texto, pressaDetectada: false, session: { estado: "S0" as const, perguntasFeitas: 0, ocasiao: {}, necessidades: [], history: [], opcoesFaladas: [] } });
const plano = { planoId: "p", versao: 1, naoAtendidas: [], pendencias: [], origem: "real" as const, blocos: [{ necessidadeId: "n1", vertical: "RESTAURANT" as const, categoria: "pizza", quantidade: 1, principal: { ref: "a", loja: "Forno e Cia", item: "pizza calabresa grande", precoCents: 3990, rotulo: "a mais barata", motivo: "menor preço", origem: "real" as const }, alternativas: [] }] };
for (const m of modelos) {
  const llm = new LangChainLlm(await criarModelo("google", m), "google", m);
  const ti: number[] = [], tr: number[] = [];
  for (let i = 0; i < 3; i++) {
    let t = Date.now(); try { await llm.interpretar(entrada("quero uma pizza calabresa para duas pessoas")); ti.push(Date.now() - t); } catch (e) { ti.push(-1); }
    t = Date.now(); try { await llm.responder({ plano, assumido: [] }); tr.push(Date.now() - t); } catch (e) { tr.push(-1); }
  }
  console.log(m.padEnd(26), "interpretar", ti.join("/"), "| responder", tr.join("/"));
}
