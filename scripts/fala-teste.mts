import { LangChainLlm, criarModelo } from "../src/agent/llm/langchain";
const llm = new LangChainLlm(await criarModelo("google", process.env.LLM_MODEL!), "google", process.env.LLM_MODEL!);
const op = { ref: "a", loja: "Ponto da Esfiha São Carlos", item: "1 Pizza Marguerita + 1 Pizza Calabresa + Guaranáscarlos", precoCents: 15999, rotulo: "mais barata", motivo: "menor preço com entrega", origem: "real" as const };
const plano = { planoId: "p", versao: 1, naoAtendidas: [{ categoria: "pipoca", motivo: "x" }, { categoria: "refrigerante", motivo: "x" }], pendencias: [], origem: "real" as const, blocos: [{ necessidadeId: "n1", vertical: "RESTAURANT" as const, categoria: "pizza calabresa", quantidade: 2, principal: op, alternativas: [] }] };
for (let i = 0; i < 4; i++) console.log("-", await llm.responder({ plano, assumido: ["Pizza sabor calabresa"], anteriores: ["Qual o sabor da pizza ou posso escolher por você?"] }));
