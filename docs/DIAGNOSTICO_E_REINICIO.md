# Diagnóstico e reinício (18/10/2026, 04h)

Escrito depois de seis rodadas de teste real em que o Guide errou de formas diferentes a cada vez. Objetivo: separar o que é bug nosso do que é o mundo, e fixar um caminho que não dependa de remendo por caso.

## 1. O que o log mostrou (conversa do macarrão Alfredo, 03h50)
| Busca | Itens devolvidos | Elegíveis | Leitura |
|---|---|---|---|
| mercado: queijo parmesão | 16 | 0 | existe no catálogo, nada utilizável |
| mercado: macarrão | 1 | 0 | idem |
| mercado: creme de leite | 2 | 0 | idem |
| restaurante: macarrão Alfredo | 0 | 0 | não existe como prato |

Um item só é elegível se a loja está **aberta e tem método de entrega** (`isOpen === true && deliveryMethod`). De madrugada, o mercado tem itens, mas não entrega. O agente respondeu "ainda não tenho opção compatível": a pessoa ouviu "não existe", quando o fato era "existe, mas não entrega agora".

## 2. Causas, da mais para a menos importante
1. **Testamos de madrugada.** A varredura do MCP (02h) e todos os testes de conteúdo foram entre 02h e 04h. Mercado sem entrega, restaurante com pouca oferta: o catálogo de madrugada não representa o de domingo às 12h. Tudo que "aprendemos" sobre o catálogo é um retrato da madrugada.
2. **Remendamos o agente com esse retrato.** Fizemos o agente aprender que "mercado está vazio" e dizer isso ao planejador; o planejador passou a evitar mercado. No teste do Alfredo ele chegou a buscar o prato pronto em vez dos ingredientes, que era exatamente o que a pessoa queria. Foi uma regressão causada por nós (corrigida: o "vazio" agora só vale quando a busca volta **sem item algum**, dura 10 minutos, e "tem item mas fechado" é tratado à parte).
3. **O agente não distingue "não existe" de "indisponível agora".** Não havia esse conceito: toda ausência virava "não tenho". Corrigido na fala do plano vazio e no motivo de cada item.
4. **Não existe a jornada "receita → ingredientes → onde comprar".** O pedido do Felipe ("quero fazer um macarrão Alfredo, o que compro e onde?") é um caso de uso central, e o agente só o trata por acaso (decompõe em itens quando o modelo decide). Falta tratar como jornada: lista, loja por item, o que não achou.
5. **O fluxo é de perguntas, mas a pessoa disse "não sei o que quero".** O agente pergunta sabor/tipo em vez de explorar e recomendar (o MCP tem `getRecommendations`, ainda não usado, e dá erro `INTERNAL` de vez em quando).
6. **Ranking por menor preço.** Mais barato primeiro faz o agente escolher item parcial (esfiha de R$ 6, fatia). Corrigido: frente da lista por nota, preço suspeito vai para trás, rótulo diz a verdade.
7. **Remendo a quente, sem rede de segurança de dados reais.** Cada correção mexeu em comportamento (juiz, ranking, planejador) e só era conferida a olho. Não existe um conjunto de pedidos com catálogo real gravado (de dia) que diga, a cada mudança, se piorou.

## 3. Latência (fato, não opinião)
Um pedido com busca real: interpretar ~2 s + MCP ~2 s por rodada (o `searchOffers` leva 1,6 a 2,1 s e várias necessidades somam, em paralelo) + juiz ~1 s + responder ~0,8 s = 6 a 7,5 s. A parte do iFood não é nossa. O que é nosso: o número de rodadas e o juiz.

## 4. O que ficou certo e deve ser preservado
Guardas da fala (nome inventado ≠ início de frase), saneamento na fronteira, combo não vale como o item, item avulso só sem o completo, busca em vertical alternativa, fonte "dito" nunca vira sugestão, sem mock no Guide, reserva de modelo e fala natural. Testes: 555.

## 5. Caminho a seguir (até o congelamento das 10h30)
Princípio: **parar de corrigir caso a caso; criar a rede de segurança e fechar as jornadas.**

1. **Hoje cedo (agora → 08h): o catálogo de verdade.** Rodar a varredura e as buscas de cenário **de dia** (ou o mais próximo possível do horário da demo) e gravar as respostas reais como fixtures. Esse passa a ser o conjunto de regressão (pizza, churrasco, festa+filme, Alfredo, bolo, presente, lanche), com expectativa objetiva: item certo no topo, sem avulso, sem combo, sem item inventado.
2. **Fechar 4 jornadas, cada uma com teste:**
   - *Quero X* (direto): busca, juiz, melhor opção por nota/preço, fala curta.
   - *Ocasião* (festa, filme): itens principais primeiro, sugestões só se houver resultado.
   - *Receita/ingredientes*: lista de itens, onde comprar cada um, e o que está indisponível agora (com o motivo).
   - *Não sei o que quero*: explorar com `getRecommendations`/ofertas, sem interrogatório; no máximo uma pergunta.
3. **Latência**: uma fala contextual logo depois do `interpretar` (informa o que está sendo buscado, não é "um instante"), cache de buscas por 5 a 10 minutos, juiz só quando o texto não basta.
4. **Medir a cada passo** com `taxaDeTemplate`, tempos e o conjunto de regressão. Nada entra sem o conjunto passar.
5. **Demo**: roteiro com 3 pedidos que o conjunto garante, aquecimento antes de apresentar, e plano B (fala por modelo de reserva).

## 6. O que NÃO vamos fazer
Mais regras por caso no prompt, mais "ilustrações" no planejador, e nenhuma conclusão sobre o catálogo tirada de teste feito de madrugada.
