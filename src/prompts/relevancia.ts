// Prompt do juiz de relevância (v1). Não conhece nenhum pedido em particular: julga o que o catálogo devolveu contra o
// que foi pedido, por critério geral. Os exemplos são ilustrações de vertical e de tipo, não regras para decorar.
import { z } from "zod";
import { MAX_CANDIDATOS_JUIZ } from "@/agent/limites";
import type { CandidatoJulgado, Necessidade } from "@/agent/types";

export const PROMPT_RELEVANCIA_VERSAO = "relevancia-v3";

export const SYSTEM_RELEVANCIA = `Você confere se itens de um catálogo de entrega (iFood: restaurantes, mercado e presentes) atendem ao que o usuário pediu. Devolva SOMENTE o JSON pedido.

# Veredito por item (campo i = posição do item na lista recebida)
- serve: é o que foi pedido, ou uma variação do MESMO produto ou prato (outra marca, tamanho, sabor, tipo ou versão). Pedido genérico aceita qualquer variação do produto: o tipo exato só importa se o usuário o disse.
- proximo: não é o pedido, mas é do mesmo tipo e poderia substituí-lo se a pessoa for avisada.
- nao_serve: é outra coisa. Preço, loja e aparecer na busca não tornam um item adequado.

# Como julgar
- Julgue pelo NOME do item e pelo que o pedido significa para quem compra, não por palavras soltas em comum.
- O pedido pode ser genérico, regional ou o nome de uma ocasião: reconheça os produtos e pratos que fazem parte dele.
- Tipos diferentes não se substituem: sobremesa não substitui refeição; ingrediente não substitui prato pronto, nem o contrário; presente de uma categoria não substitui outra.
- Combo, kit ou item que reúne vários produtos ("A + B + bebida") NÃO é o produto pedido sozinho: no máximo proximo, a menos que a pessoa tenha pedido combo ou kit. Prefira sempre o item individual.
- Em dúvida entre proximo e nao_serve, escolha nao_serve. Dizer "não achei" é melhor do que oferecer o item errado.
- O mesmo item em lojas diferentes recebe o mesmo veredito.
- Ilustração (outro assunto): pedido "camiseta"; "Camiseta básica algodão" serve; "Regata" proximo; "Caneca" nao_serve.`;

export const VeredictosSchema = z.object({
  itens: z.array(z.object({
    i: z.number().int().min(0).max(MAX_CANDIDATOS_JUIZ).describe("posição do item na lista recebida"),
    v: z.enum(["serve", "proximo", "nao_serve"]),
  })).max(MAX_CANDIDATOS_JUIZ),
});

export function mensagemRelevancia(n: Necessidade, candidatos: CandidatoJulgado[]): string {
  return JSON.stringify({
    pedido: n.categoria,
    consultasUsadas: n.consultas ?? [],
    vertical: n.vertical,
    itens: candidatos.map((c, i) => ({ i, item: c.item, loja: c.loja ?? null })),
  });
}
