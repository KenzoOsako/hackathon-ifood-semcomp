# Exemplos de testes falados com o agente real (18/10/2026)

Origem: testes do Felipe na `/voz`, build de produção na porta 8080, **Gemini `gemini-3.5-flash-lite` + MCP real do iFood (São Carlos) + voz ElevenLabs**. Cada fala foi dita ao microfone e reconhecida (confiança 0,92 a 1,0). Servem de exemplo para entender o comportamento do agente e virar cenários em `src/evals/` (dono: Hyago). A coluna "modelo" e os tempos vêm do painel "O que o agente decidiu em cada turno".

## Conversa A: pizza para duas pessoas
| # | Usuário | Guide | Estado/nível | Tempos (interpretar / domínio / responder) |
|---|---|---|---|---|
| 1 | (digitado) "quero uma pizza de calabresa grande" | "Para quantas pessoas é a pizza ou posso escolher por você?" | S2 / L1 | 1638 / - / - |
| 2 | "A pizza é pra duas pessoas" | "Assumi o tamanho grande… Preparei a combinação de **pizza marguerita, pizza calabresa e guaraná** no Ponto da Esfiha São Carlos, a mais barata. **É preciso confirmar a composição com a loja.** Quer ajustar algo?" | S3 / L1 | 1336 / 2107 / 740 |
| 3 | "Confirma pra mim só o preço dessas pizzas, por gentileza" | "Essa já é a melhor opção para esse critério. Quer ajustar outra coisa?" | S3 / L1 | 1423 / 0 / - |
| 4 | "Enfim, pode fechar o pedido" | "Pronto, o plano está na sua tela. É só revisar e aprovar; a compra termina no iFood." | S5 / L1 | 1282 / - / - |

## Conversa B: "algo que não seja pizza" → churrasco
| # | Usuário | Guide | Estado/nível | Tempos |
|---|---|---|---|---|
| 1 | "Eu quero comer algo hoje que não seja pizza. O que você me recomenda?" | "Assumi refeição sem ser pizza… sugiro **duas unidades de pudim** no Ateliê do Coco, a mais barata. É preciso confirmar a composição com a loja." | S3 / L1 | 1401 / 1951 / 735 |
| 2 | "Na verdade eu não queria pudim, eu queria alguma coisa salgada. Talvez churrasco?" | "Assumi que você quer churrasco **para duas pessoas**. Preparei o **Cheddar Jr. na Burger King**, a mais barata. É preciso confirmar a composição com a loja, **pois o pedido mínimo é de vinte reais**." | S3 / L1 | 1506 / 1711 / 689 |
| 3 | "Eu quero churrasco, mas hoje eu tô me sentindo patrão. Quero gastar um pouco mais… de maior qualidade?" | "**Adicionei** duas unidades de **Baicroc Gourmet** na Lual Lanches e Açaí…, a melhor avaliada. A quantidade é estimada para duas pessoas e é preciso confirmar a composição com a loja." | S4 / L1 | 1394 / 9 / 720 |

## Latência vista nesses testes (voz + agente)
- Reconhecimento: 494 a 843 ms (a fala mais longa, de 29 palavras, foi a mais lenta).
- 1º som (frase "Hum, um instante."): 609 a 963 ms. **Dentro da meta de 1,2 s.**
- Voz (1º byte): 284 a 383 ms.
- Turno com busca real no MCP: interpretar ~1,4 s + domínio ~1,7 a 2,1 s + responder ~0,7 s, ou seja, **~4 s de backend e ~5 s até a 1ª palavra útil**. Turno sem busca: ~2,1 a 2,3 s.
- A 1ª chamada do dia custou ~3,7 s a mais (carregamento do módulo do Gemini). Fazer um turno de aquecimento antes de apresentar.

## Padrões observados (para o Hyago e o Kenzo)
| Padrão | Evidência | Esperado | Onde |
|---|---|---|---|
| Pedido específico vira pergunta | A1: "pizza de calabresa grande" em L1 com "para quantas pessoas?" | L0, zero perguntas (pedido específico) | prompt `interpretar` |
| Escolha por preço sem relevância | B1: pedido vago vira "pudim, a mais barata" | para pedido vago, relevância/qualidade antes de preço; ou perguntar uma preferência | ranking (Kenzo) / orquestrador |
| Categoria não encontrada é "preenchida" | B2 e B3: "churrasco" vira hambúrguer; a resposta não diz que não achou churrasco | "não achei churrasco por perto; o mais próximo é…" (regra de verdade) | orquestrador + `responder` |
| Quantidade/pessoas inventadas | B1 "duas unidades", B2 "para duas pessoas" sem o usuário ter dito | só assumir o que foi dito; se assumir, dizer | `interpretar` |
| Itens não pedidos | A2: marguerita e guaraná junto da calabresa, sem rótulo de sugestão | inferência só rotulada como "sugestão" e no máximo 2 | inferência rotulada (H6) |
| "Confirmar a composição" sem restrição | A2, B1, B2, B3 (e nos testes anteriores) | só quando há restrição alimentar; pedido mínimo/frete têm frase própria | `responder` (pendências) |
| Pedido mínimo na frase errada | B2: "confirmar a composição… pois o pedido mínimo é de vinte reais" | pendência de pedido mínimo dita como tal | `responder` |
| Pergunta de preço não entendida | A3: respondeu "melhor opção para esse critério" | responder com o preço do plano | intenção de detalhe |
| Verbo de carrinho | B3: "Adicionei duas unidades" (nada foi adicionado) | "Incluí no plano" (o Guide nunca adiciona nem compra) | `responder` |

O que funcionou: "pode fechar o pedido" levou ao plano na tela **sem aprovar**; as falas longas e hesitantes foram reconhecidas com confiança alta; o Guide não falou o endereço do usuário.

## Cenários propostos (formato de `src/evals/cenarios.ts`)
Alguns só fazem sentido com o LLM real (ou com o domínio gravado/replay). Os de categoria usam `FakeDomain` sem churrasco.
```ts
{ id: "V1", descricao: "Pedido específico sem pressa: zero perguntas", turnos: [
  { usuario: "Quero uma pizza de calabresa grande", esperado: { nivel: "L0", maxPerguntas: 0, temPlano: true } } ] },
{ id: "V2", descricao: "Categoria fora do catálogo: diz que não tem, não oferece outra coisa como se fosse a pedida", turnos: [
  { usuario: "Quero churrasco para hoje", esperado: { contem: /não (tenho|encontrei)|ainda não/i, naoContem: /Cheddar|hambúrguer|burger/i } } ] },
{ id: "V3", descricao: "Pendência (pedido mínimo, frete) não vira 'confirmar a composição'", turnos: [
  { usuario: "Pizza calabresa grande, pede logo.", esperado: { temPlano: true, naoContem: /confirmar a composição/i } } ] },
{ id: "V4", descricao: "Pergunta de preço é respondida com o preço do plano", turnos: [
  { usuario: "Pizza calabresa grande, pede logo.", esperado: { temPlano: true } },
  { usuario: "Confirma só o preço dessas pizzas", esperado: { contem: /R\$|reais/i, naoContem: /melhor opção para esse critério/i } } ] },
{ id: "V5", descricao: "Não inventa quantidade de pessoas nem unidades", turnos: [
  { usuario: "Quero comer algo que não seja pizza", esperado: { naoContem: /duas pessoas|duas unidades/i } } ] },
{ id: "V6", descricao: "Não diz que adicionou ao carrinho", turnos: [
  { usuario: "Pizza calabresa grande, pede logo.", esperado: { naoContem: /adicionei/i } } ] },
```
