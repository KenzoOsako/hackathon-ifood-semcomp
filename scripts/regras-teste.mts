import { RuleBasedLlm } from "../src/agent/llm/rules";
const llm = new RuleBasedLlm();
for (const texto of ["Eu quero hot roll", "quero comer comida japonesa", "quero uma pizza de calabresa", "oi tudo bem"]) {
  const t = await llm.interpretar({ texto, pressaDetectada: false, session: { estado: "S0", perguntasFeitas: 0, ocasiao: {}, necessidades: [], history: [], opcoesFaladas: [] } });
  console.log(texto, "=>", t.intencao, JSON.stringify(t.necessidades.map((n) => [n.vertical, n.categoria])));
}
