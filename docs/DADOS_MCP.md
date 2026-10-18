# O que o MCP do iFood expõe: catálogo para guiar agente e testes

18/10/2026. Fonte: `docs/mcp-ifood-referencia.md` (leitura da documentação) **+ varredura ao vivo** (`GET /api/mcp/explorar`, ver §6). Tudo marcado **[doc]** vem da documentação e ainda **não foi conferido** com a conta real; marcado **[real]** foi medido. O objetivo é decidir o que o agente pode **saber**, o que pode **inferir** e o que cada fato **muda nos testes**.

## 1. As 24 ferramentas (4 domínios)
| Domínio | Ferramenta | Efeito | Escopo | Uso no Guide |
|---|---|---|---|---|
| Usuário | `getUser` | leitura | BASIC `mcp.user.basic.read` (nome, e-mail, telefone); BEHAVIOR `mcp.user.behavior.read` (`hasClub`, `userBehaviorDescription`) | nome na saudação (opcional, escopo extra) |
| Usuário | `listAddresses` | leitura | `mcp.user.addresses.read` ✓ | local da busca **e hábitos** (`ordersByMerchantTypeWeekdayAndShift`) |
| Usuário | `createAddress` | **escrita** | `…addresses.write` | nunca |
| Descoberta | `searchOffers` | leitura | `…discovery.search.read` ✓ | busca por termo (já usada) |
| Descoberta | `browseOffers` | leitura | `…discovery.browse.read` ✓ | explorar sem termo (hoje não usada) |
| Descoberta | `getRecommendations` | leitura | `…discovery.recommendation.read` ✓ | **o de sempre, recentes, favoritos, ofertas** (hoje não usada) |
| Descoberta | `listItemTaxonomy` | leitura | `…discovery.browse.read` ✓ | categorias globais; ajuda a mapear "churrasco", "ingredientes" |
| Descoberta | `getMerchant` | leitura | `…discovery.details.read` ✓ | horário, entrega, mínimo, destaques, deeplink |
| Descoberta | `getItem` | leitura | `…discovery.details.read` ✓ | descrição, foto, grupos de opção, promoção |
| Carrinho (13) | `createCart`, `getCart`, `getCartDeliveryMethods`, `addItemToCart`, `updateCartItem`, `removeItemFromCart`, `listVouchers`, `setVoucher`, `removeVoucher`, `setCartDelivery`, `listPaymentMethods`, `setCartPayment`, `submitOrder` | escrita (menos as listas) | escopos de carrinho (não pedidos) | **nunca**: o Guide propõe, a compra termina no iFood |
| Pedido | `trackOrder`, `getOrder` | leitura | escopo de pedido | exigem `orderId`; só se vierem de `RECENT_ORDERS` |

Não existe: listar todos os pedidos, cancelar, reembolsar, menu como ferramenta (o catálogo de uma loja se navega com `searchOffers`/`browseOffers` + `refinements.merchantId`). Repetir pedido é `createCart(orderId)` (escrita).

## 2. Dados que já temos permissão de ler (escopos do login atual) **[doc]**
**Hábitos por endereço** (`listAddresses`): `results[]` com `addressId`, alias, componentes, coordenadas e "indicadores de uso", entre eles `ordersByMerchantTypeWeekdayAndShift`: contagem de pedidos **por tipo de loja × dia da semana × turno**. Atenção: os mapas de contagem vêm como **string** (converter antes de somar). Pode vir `dataWarning`. Até 20 endereços.

**Recomendações** (`getRecommendations`, `contentMode`):
| Modo | Loja | Item | O que dá |
|---|---|---|---|
| `RECENT_ORDERS` | sim | sim | **`lastOrderedAt`, `timesOrdered`, `lastOrderId`**: recorrência e "repetir o último" |
| `FAVORITE_MERCHANTS` | sim | não | lojas favoritas |
| `RECOMMENDED` | sim | sim | recomendação do iFood |
| `BEST_DEALS` | sim | sim | ofertas (promoção real) |
| `FEATURED_LOCAL` | sim | não | destaques locais |

Listas: `pageSize` 10 (máximo 25), `nextPageToken`/`hasMore`, `resultKind` MERCHANT ou ITEM (combinação inválida dá `INCOMPATIBLE_RESULT_KIND`). Tipos de loja: `RESTAURANT`, `GROCERIES`, `LIQUORSTORE`, `DRUGSTORE`, `PETSTORE`, `SHOPPING` (o enum existir não garante catálogo no endereço).

**Refinamentos da busca**: `itemTaxonomy` (OR entre ids), `merchantId`, `maxItemPrice`, `minItemPrice`, `maxDeliveryFee`, `maxDistanceKm` (linha reta), `maxDeliveryTimeMinutes`, `onlyOpen`, `sort` (`RELEVANCE`, `PRICE`, `DELIVERY_TIME`), `dietary` (`VEGETARIAN`, `VEGAN`, `GLUTEN_FREE`; sem enum para lactose), `requiredDeliveryMethod`.

## 3. O que dá para inferir (e o que não)
| Quero… | Como | Confiança | Limite |
|---|---|---|---|
| "o de sempre" | `RECENT_ORDERS` (ITEM) ordenado por `timesOrdered` e recência, cruzado com o dia e o turno de agora | média | contagem por dia/turno é por **tipo de loja**, não por prato; é preciso histórico |
| "repetir o último pedido" | `RECENT_ORDERS`, maior `lastOrderedAt`; o `lastOrderId` é a referência de reordenar | alta | reordenar é `createCart` (escrita): o Guide **propõe**, a pessoa conclui |
| "hoje é dia de lanche" | `ordersByMerchantTypeWeekdayAndShift[RESTAURANT][hoje][turno]` vs. outros dias | média | sem cozinha/prato; "lanche" exige cruzar com `listItemTaxonomy` ou o nome do item |
| "faz tempo que você não pede em X" | `lastOrderedAt` por loja | alta | só das lojas em `RECENT_ORDERS` |
| lojas preferidas | `FAVORITE_MERCHANTS` | alta | — |
| perfil de comportamento | `userBehaviorDescription` (BEHAVIOR) | desconhecida | escopo não pedido; texto livre do iFood |
| tem Clube (frete grátis) | `hasClub` (BEHAVIOR) | alta | escopo não pedido |

## 4. O que isso muda nos TESTES (decisões)
1. **Histórico pode vir vazio** (a referência avisa para conta de teste). Todo caminho de hábito precisa de teste com **histórico vazio**, **parcial** e **cheio**, e a demo precisa de **histórico simulado** (`FakeDomain`).
2. **Contagens são strings**: teste com número como string, vazio, "0", não numérico e valor gigante.
3. **Campos opcionais e nulos são normais** (`deliveryMethod: null`, `rating` ausente, `dataWarning`): o caos (`src/qualidade/caos.ts`) deve gerar essas formas; a varredura diz quais campos são realmente opcionais (§6).
4. **Paginação e limites**: `pageSize` máximo 25, `hasMore`; o agente não pode assumir que a primeira página tem o item certo.
5. **Erros do MCP** (`INCOMPATIBLE_RESULT_KIND`, `ORDER_NOT_FOUND`, falhas transitórias, token expirado): cada um vira uma linha da matriz de falhas, com a frase falada.
6. **Loja fechada / sem entrega**: já filtradas; testar com loja `isOpen:false` e `deliveryMethod:null`.
7. **Distância é linha reta**; **promoção** só pelos campos reais; **taxonomia** tem disponibilidade (`PLENTIFUL/ADEQUATE/SCARCE`).
8. **Dados da pessoa nunca vão a log, a TTS nem ao modelo além do necessário** (nome só o primeiro; endereço nunca falado; `orderId` nunca exposto).
9. Fixtures **reais** (formato medido pela varredura) substituem as inventadas: ver §6.

## 5. Lacunas da documentação a validar na varredura
- `ordersByMerchantTypeWeekdayAndShift` realmente vem em `listAddresses`? Formato dos dias e turnos?
- `RECENT_ORDERS` devolve o **item** pedido (nome) ou só a loja? Quantos itens?
- Existe algum campo de categoria/culinária da loja para casar com "lanche"?
- `getUser` funciona sem o escopo extra? O que devolve com ele?
- O MCP ao vivo expõe ferramentas além das 24 (ou menos)? (`divergenciasComADoc`)
- Quanto tempo leva cada chamada (para o orçamento de latência)?

## 6. Como rodar a varredura (você, uma vez)
A varredura precisa da **sua sessão conectada**, então roda no seu computador. Ela chama **só leituras** (`listAddresses`, `getUser`, `searchOffers`, `browseOffers`, `getRecommendations` em todos os modos, `listItemTaxonomy`, `getMerchant`, `getItem`, `getOrder`/`trackOrder` do último pedido) e devolve o **formato** das respostas: nomes de campo, tipos, nulos, tamanhos e, **só do catálogo público**, até 3 exemplos de texto. **Nunca** devolve nem grava nome, e-mail, telefone, endereço, coordenadas ou identificador de pedido (testado). Não chama carrinho, endereço novo nem checkout (travado em código e testado).

1. `.env`: `TELEMETRIA=1` e `MCP_MODE=real`.
2. `npm run build` e `npx next start -p 8080` (com `MCP_MODE=real`).
3. No Chrome: `http://localhost:8080/api/auth/login` (login do iFood) e depois `http://localhost:8080/api/mcp/explorar?gravar=1`.
4. O resultado fica em `quality/mcp-formas.json` (seguro para commitar) e é a base das fixtures e das lacunas da §5.
