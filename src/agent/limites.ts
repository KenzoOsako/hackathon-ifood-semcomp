// Parâmetros de PRODUTO do agente, num lugar só e com o porquê. Não são limites técnicos: dá para subir cada um
// quando a experiência pedir (mais verticais, receitas maiores, outra cidade). Mudar aqui muda o agente inteiro.

// Necessidades por plano. Receita de bolo ou "o que precisa para um churrasco" passam de 5 itens de mercado;
// acima de 8 a fala e a tela viram lista de compras (a gente agrupa por loja antes de subir mais).
export const MAX_NECESSIDADES = 8;

// Consultas de busca por necessidade (sinônimos reais do mesmo item). Cada uma é uma chamada ao MCP, feitas em paralelo.
export const MAX_CONSULTAS = 3;

// Candidatos que o juiz de relevância avalia por necessidade (títulos curtos, uma chamada só).
export const MAX_CANDIDATOS_JUIZ = 12;

// O juiz roda no caminho da resposta: se passar disso, vale o veredito léxico (determinístico) e a conversa segue.
export const TIMEOUT_JUIZ_MS = 4000;
