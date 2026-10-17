> **Escopo FoodPilot atualizado em 17/10/2026:** este guia descreve capacidades da plataforma, incluindo submitOrder; a [proposta final](PROPOSTA_DE_NEGOCIO_FOODPILOT.md) determina compra final no iFood e aprovação antes de adicionar itens remotamente. Ferramenta documentada não comprova disponibilidade autenticada, autorização ou implementação. Leia a [auditoria](AUDITORIA-ALINHAMENTO-2026-10-17.md).

# MCP iFood — guia técnico para desenvolvedores e agentes de código

**Projeto:** Hackathon iFood × SEMCOMP 2026. **Consulta:** 17/10/2026. **Destino sugerido no GitHub:** `docs/mcp-ifood-referencia.md`.

Este documento sintetiza a documentação oficial em português para os quatro integrantes e para Claude/Codex. A leitura cobre primeiros passos, autenticação, escopos, ferramentas, erros e casos de uso dos quatro domínios, além dos termos do portal. O inventário completo de fontes está no final.

**Limite da verificação:** capacidades e contratos abaixo são **documentados**, não um resultado de `tools/list` autenticado do agente da equipe. A disponibilidade efetiva depende de homologação, escopos e dados do ambiente. Não foram executadas compras nesta análise. Exemplos são ilustrativos e não contêm credenciais.

## 1. Leitura inicial para humanos e agentes

Leia primeiro `AGENTS.md` e a pasta `contexto/` na ordem do projeto. Use este guia como referência de integração; ele não escolhe o produto, a stack ou as regras de negócio do time e não substitui a documentação oficial vigente.

Antes de implementar uma chamada:

1. Confirme o nome e o `inputSchema` que o servidor efetivamente oferece ao cliente.
2. Identifique quais IDs vieram de respostas anteriores e qual usuário está autenticado.
3. Classifique a chamada como leitura, mutação ou checkout.
4. Use o formato de erro específico do domínio; HTTP bem-sucedido não basta.
5. Atualize o estado local com a resposta, sem completar campos ausentes por suposição.
6. Para ações com efeito externo, obtenha a autorização exigida pelo projeto e pelo usuário. Checkout exige confirmação explícita atual.

### Dez pontos que evitam os erros mais caros

- `listAddresses` inicia a seleção de endereço; `getUser` é opcional para personalização.
- A identidade é derivada do OAuth pelo gateway; não enviar um `userId` escolhido pelo agente.
- IDs de estabelecimento, item, opção e voucher vêm do servidor, nunca de exemplos ou nomes inventados.
- `getItem` precede a escolha de opções e o envio do item ao carrinho.
- Um carrinho criado do zero exige **pelo menos um item**; `createCart` não é idempotente.
- `itemId` identifica catálogo; `cartItemId` identifica uma linha deste carrinho. Update exige ambos.
- `options: []` é obrigatório mesmo em itens sem opções; customizações têm estrutura própria.
- Descobrir opções precede aplicar entrega, pagamento ou voucher.
- Depois da revisão final, somente a confirmação humana permite `submitOrder(..., userConsent: true)`.
- No rastreamento, obedecer ao intervalo recebido e parar quando `pollingStop === true`.

Fontes: [User — introdução][U1], [Discovery — introdução][D1], [Cart — introdução][C1], [Order — introdução][O1].

## 2. Plataforma e fronteiras

O endereço de conexão é **`https://consumer-mcp.ifood.com.br/marketplace`**. A documentação descreve um gateway que reúne quatro domínios, somando **24 ferramentas**:

| Domínio | Tools | Papel | Efeitos |
|---|---:|---|---|
| User / Account | 3 | Perfil e endereços | Duas leituras; `createAddress` pode persistir |
| Offer Discovery | 6 | Busca, navegação, curadoria, taxonomia e detalhes | Leitura |
| Cart | 13 | Carrinho, entrega, pagamento, cupons e checkout | Leituras e mutações; checkout cria pedido |
| Order Tracking | 2 | Status e detalhes do pedido | Leitura |

```mermaid
flowchart LR
    P[Portal: cadastro e homologação] --> A[OAuth do consumidor]
    A --> G[Cliente MCP + gateway marketplace]
    G --> U[User: endereço]
    U --> D[Discovery: estabelecimento e itens]
    D --> C[Cart: itens, entrega e pagamento]
    C --> H[Revisão e confirmação humana]
    H --> S[submitOrder]
    S --> O[Order: trackOrder e getOrder]
```

Distinga as identidades: a conta do portal administra o aplicativo; o agente registrado tem Client ID/Secret; o consumidor autoriza sua própria sessão; o cliente MCP executa o protocolo; a chave do provedor de LLM dá acesso ao modelo. O runtime do nosso produto é outra peça: instalar um cliente de desenvolvimento não implementa o aplicativo.

Os exemplos HTTP das páginas mostram APIs subjacentes e clientes ilustrativos. Não concatenar suas rotas de exemplo ao endpoint marketplace nem tratar nomes de SDK nos snippets como pacote instalado e validado. Use o transporte MCP do cliente e os schemas descobertos. Uma resposta a `curl -I` prova, no máximo, alcance HTTP; não comprova MCP, OAuth ou tools.

Não há ferramenta documentada para cancelar, reembolsar, administrar restaurante ou listar livremente todos os pedidos. Reordenação existe em `createCart(orderId)`; não é uma operação de `trackOrder`/`getOrder`. Catálogo de uma loja é navegado com `searchOffers`/`browseOffers` e `refinements.merchantId`, sem uma tool separada de menu. Fontes: [instalação][P2], [Discovery][D1], [Cart][C1], [Order][O1].

## 3. Portal, homologação e sandbox

### 3.1. Caminho até poder autenticar

1. Usar uma conta do portal com perfil adequado. Estudante/pessoal é destinado a sandbox; profissional inclui validações adicionais. A aprovação da conta profissional não equivale à homologação do agente.
2. Registrar o agente com logo quadrada PNG/SVG/JPG até 1 MB, nome, descrição, redirect URL, termos de uso e privacidade.
3. Solicitar os domínios necessários. São três grupos: dados de usuário, descoberta e criação de pedidos. A seleção é em cascata; pedidos inclui os anteriores.
4. Aguardar análise de segurança. As credenciais aparecem após a aprovação; a página informa que a aprovação não é notificada por e-mail.
5. Gerar e guardar o secret com segurança: ele é mostrado uma vez. Não regenerar por conveniência sem avaliar as integrações afetadas.
6. Verificar os **escopos técnicos liberados** e o callback efetivamente cadastrado.

Fontes: [conta][P1], [agente][P3]. No projeto, `http://localhost:8765/callback` é uma proposta/configuração local; só é o callback autorizado quando coincidir exatamente com o cadastro aprovado.

### 3.2. Consumidores de teste

Contas de teste são diferentes da conta administradora e têm identificação `ONLY_TEST_AGENT`. A criação requer agente ativo, aprovado ou parcialmente aprovado. O limite publicado é de **10 por usuário do portal**, com exclusão após **15 dias**.

O portal gera e-mail/telefone fictícios e mostra os OTPs; não esperar SMS ou e-mail real. Gerar novamente quando necessário; não colocar OTPs, códigos OAuth ou tokens em documentação. A conta de teste não deve ser confundida com a permissão `can_test`, destinada a funcionalidades não lançadas.

A documentação impede pedidos reais com essas contas, mas alerta que pagamentos reais efetuados em pedidos de teste, inclusive Pix, **não são reembolsados**. O teste técnico não autoriza pagamento. Fonte: [contas de teste][P4].

### 3.3. Quatro desenvolvedores

Cada integrante deve ter clone, configuração local e sessão OAuth próprios. Uma conta de consumidor de teste por pessoa evita mistura de carrinhos e histórico. Não copiar tokens de uma máquina para outra.

**Ponto a confirmar com a organização:** o uso de um único aplicativo OAuth pelo time e a forma autorizada de provisionar suas credenciais. Os [termos, §§6.1 e 9][T1] restringem credenciais compartilhadas e compartilhamento de acesso sem autorização expressa. Um cofre protege o armazenamento, mas não concede essa autorização. Esta ressalva substitui qualquer orientação anterior que tratasse distribuir um Client Secret como automaticamente permitido. Não compartilhar o login administrador do portal.

O mesmo localhost pode existir em quatro computadores, mas isso não comprova permissão de quatro sessões simultâneas. Limite de sessões e múltiplos callbacks não foi estabelecido nas páginas lidas. Na mesma máquina, dois logins usando a porta 8765 podem disputar o listener.

## 4. OAuth: fluxo e implementação

Fontes: [introdução][A1], [jornadas][A2], [implementação][A3], [erros][A5].

### 4.1. Cinco etapas

| Etapa | Requisição/ação | Validação essencial |
|---|---|---|
| Autorizar | GET `/authorize`, no navegador | `response_type=code`, cliente, redirect, escopos, state e PKCE |
| Receber retorno | Callback recebe `code` e `state` | Comparar state com o valor original antes de trocar o código |
| Trocar código | POST `/token` | `grant_type=authorization_code`, code, mesmo redirect, client_id, secret quando requerido e code_verifier |
| Renovar | POST `/token` | `grant_type=refresh_token`; guardar o novo par de tokens retornado |
| Encerrar | POST `/revoke` e limpeza local | Revogação invalida o acesso; novo uso requer autorização válida |

Endpoints documentados: `https://id.ifood.com.br/authorize`, `https://id.ifood.com.br/token`, `https://id.ifood.com.br/revoke`. Para abertura via aplicativo: `https://app.ifood.com.br/F4X4/authorize`.

`code_challenge` é SHA-256/base64url de um `code_verifier` aleatório e `code_challenge_method` é `S256`. O verifier só vai à troca de tokens, nunca ao redirecionamento. A página pede state aleatório com no mínimo oito caracteres; usar valor criptograficamente aleatório por tentativa, sem reutilização.

O redirect precisa coincidir em **esquema, host, porta e caminho**. `localhost` e `127.0.0.1` não devem ser tratados como intercambiáveis pelo implementador. HTTPS é a regra publicada, com exceção local. Aplicações móveis usam Universal Link/App Link; custom schemes não são suportados na jornada descrita.

A troca e a renovação com Client Secret são feitas no backend/cliente local capaz de protegê-lo, nunca no frontend público. PKCE não torna seguro embutir um secret em JavaScript distribuído ao navegador.

### 4.2. Jornadas de login

- **Any2App:** inicia pelo OneLink e aproveita o aplicativo iFood; sem aplicativo, há fallback web.
- **Login web:** usa `id.ifood.com.br`, com identificação por telefone/e-mail e os desafios aplicáveis.
- **Pending Action:** descrita como variação do login web, iniciada no desktop/agente e aprovada pelo aplicativo do consumidor; não implementar um protocolo de polling de tokens presumido a partir do nome.

A página atual organiza isso em duas jornadas principais, com Pending Action subordinada ao web; resumos antigos podem chamá-las de três métodos independentes. Os cinco passos OAuth continuam os mesmos.

### 4.3. Tokens e consentimentos

O exemplo de token mostra `expires_in: 3600`, mas a aplicação deve usar o valor recebido, não fixar uma duração universal. A documentação recomenda renovar com cinco minutos de antecedência. Na renovação, substituir access/refresh tokens anteriores pelos novos; não permitir duas renovações concorrentes sobrescreverem o par atualizado.

O consentimento OAuth permite compartilhar dados nos escopos autorizados; **não substitui a confirmação de cada compra**. O consumidor pode revogá-lo em Contas Conectadas no aplicativo. Parar acessos após revogação e oferecer reautenticação. Cache de dados privados deve ser isolado por usuário e limpo conforme a política aplicável.

### 4.4. Erros OAuth

| Situação | Códigos | Recuperação |
|---|---|---|
| Pedido de autorização inválido | `invalid_request`, `unauthorized_client`, `unsupported_response_type`, `invalid_scope` | Corrigir parâmetros/configuração; não repetir a mesma entrada |
| Usuário recusou | `access_denied` | Interromper o fluxo; explicar a necessidade de autorização |
| Credencial do aplicativo inválida | `invalid_client` | Conferir cliente/secret/método; token endpoint pode responder HTTP 401 |
| Código ou refresh inválido/expirado/reutilizado | `invalid_grant` | Refazer autorização; conferir redirect e cliente |
| Grant não suportado | `unsupported_grant_type` | Usar o grant correto, sem tentativa cega |
| Revogação com tipo inválido | `unsupported_token_type` | Corrigir token/tipo conforme contrato |
| Indisponibilidade | `server_error`, `temporarily_unavailable` | Backoff limitado, sem reenvio infinito |

Outros erros de token/revogação são documentados com HTTP 400; corpo OAuth usa `error`, `error_description` e opcional `error_uri`. Cliente/redirect inválidos podem ser rejeitados diretamente na tela do iFood sem retorno ao callback. Esses erros não têm o mesmo envelope dos erros de negócio do Cart.

## 5. Escopos

Fonte: [referência específica de escopos][A4]. Solicitar somente o conjunto homologado. Os grupos selecionados no portal não são os nomes técnicos que se enviam no parâmetro `scope`.

| Escopo técnico | Permissão descrita |
|---|---|
| `mcp.user.basic.read` | Nome, e-mail e telefone |
| `mcp.user.advanced.read` | Identificação fiscal/CPF/CNPJ |
| `mcp.user.addresses.read` | Endereços salvos |
| `mcp.user.behavior.read` | Dados comportamentais |
| `mcp.user.addresses.write` | Criar endereços |
| `mcp.discovery.search.read` | Busca textual |
| `mcp.discovery.browse.read` | Catálogo e taxonomia |
| `mcp.discovery.recommendation.read` | Listas curadas |
| `mcp.discovery.details.read` | Detalhes de loja/item |
| `mcp.cart.read` | Ler carrinho |
| `mcp.cart.write` | Criar/modificar carrinho |
| `mcp.cart.checkout` | Finalizar pedido |
| `mcp.cart.payment` | Consultar pagamentos |
| `mcp.orders.read` | Consultar pedidos/status |

A página de implementação também menciona escopos amplos de roteamento, como `mcp.cart`; confirmar a combinação requerida no cadastro/cliente, sem presumir que adicionar escopos amplos ou todos os exemplos resolva `invalid_scope`. O `llms.txt` usa nomes simplificados divergentes; não usar `user:read`/`cart:write` como substitutos dos nomes homologados.

## 6. Convenções e estado compartilhado entre domínios

| Valor | Origem | Uso correto |
|---|---|---|
| `candidateId` | Candidato de geocodificação | Confirmar criação; temporário, não é endereço salvo |
| `addressId` | Endereço persistido/listado | Criar carrinho; selecionar contexto de entrega |
| `userLocation` | Coordenadas do endereço escolhido | `{latitude, longitude}` em cinco tools Discovery |
| `merchantId` | Busca/navegação/recomendação | Detalhes, catálogo, carrinho e meios de pagamento |
| `itemId` | Catálogo/resultado do item | Criar/adicionar item; também validação em update |
| `optionId` / `customizationId` | Detalhe real do item | Seleções de opções e customizações |
| `cartId` | `createCart` | Retomar/alterar o carrinho existente |
| `cartItemId` | Item persistido no carrinho | Atualizar/remover essa linha específica |
| `paymentMethodId` | `listPaymentMethods` | Configurar pagamento; não é o texto `PIX` |
| `deliveryMethodId` / horário | `getCartDeliveryMethods` | Configurar entrega, sem hardcode |
| `code` + `campaignId` | `listVouchers` | Aplicar exatamente esse voucher ao carrinho atual |
| `orderId` | Checkout ou referência autorizada documentada | Rastrear/detalhar; reordenação quando suportada |

Payloads usam `lowerCamelCase`; enums costumam usar `SCREAMING_SNAKE_CASE`. Não transformar automaticamente todos os campos em snake_case por causa de exemplos Python ou instruções textuais.

Valores de preço documentados são números em **BRL decimal**: `32.90`, não centavos `3290`. A recomendação de implementação é usar cálculo monetário determinístico e os totais retornados pelo servidor. Não usar `preço || preçoBase`, pois desconto zero pode ser legítimo; distinguir zero de null/ausente.

IDs são tratados como opacos mesmo quando a documentação descreve UUIDs. Não gerar um UUID para preencher um identificador de recurso que deveria vir do servidor. Não reutilizar tokens de paginação com outra consulta/endereço sem suporte explícito.

## 7. User MCP — 3 ferramentas

Fontes: [introdução][U1], [tools][U2], [erros][U3], [casos][U4].

### 7.1. `getUser` — leitura de perfil

Entrada: sem parâmetros; identidade vem da sessão. O payload usa `success` e `data`. Há três níveis documentados:

| Tier | Dados adicionais |
|---|---|
| BASIC | `fullName`, `email`, `phone` |
| ADVANCED | Identificação fiscal e `paymentMethods` da conta |
| BEHAVIOR | `profileData.hasClub` e `profileData.userBehaviorDescription` |

Os campos dependem dos escopos. A tabela de tiers da página User associa o nível básico também aos escopos de endereço; verificar a concessão real em vez de inferir permissões pelo nome do tier. Pagamentos salvos do usuário não equivalem aos aceitos por uma loja. Não exigir dados fiscais/comportamentais se a função só precisa de endereço.

### 7.2. `listAddresses` — leitura e seleção de endereço

Entrada: sem parâmetros. Saída em `results[]`, com `addressId`, alias, componentes, CEP, complemento/referência, coordenadas e indicadores de uso. A página descreve ordenação por alias e recência, com limite de até 20; não presumir paginação ou acesso a endereços excluídos.

| Resultado | Comportamento documentado |
|---|---|
| Zero | Solicitar endereço e criar quando autorizado |
| Um | Informar o endereço usado e prosseguir; não exige confirmação extra só para seleção |
| Vários com comportamento disponível | Sugerir o provável e confirmar brevemente |
| Vários sem comportamento / `dataWarning` | Apresentar opções por alias, sem inventar preferência |

A inferência usa primeiro `ordersByMerchantTypeWeekdayAndShift`, depois último endereço e mais usado em 30 dias. Os mapas de contagem são **strings** e exigem conversão antes de aritmética. Não tratar ausência de histórico no sandbox como falha da integração. Mesmo endereço selecionado automaticamente deve aparecer na revisão final da compra.

### 7.3. `createAddress` — geocodificação e persistência

Entrada principal: `address` como string livre. Opcionais: `alias`, `complement`, `reference`; condicionais: `candidateId` e `neighborhood`.

- **Duas etapas:** enviar endereço, receber `matchConfidence` e `candidates[]`, obter escolha/confirmação e reenviar com o `candidateId` retornado e os dados aplicáveis. Não criar uma tool de geocodificação fictícia.
- **Single-shot:** se o usuário já forneceu endereço e complemento, o match é único e o bairro é resolvível, a primeira chamada pode persistir diretamente; a resposta sinaliza `createdDirectly`. Portanto a tool não é genericamente “somente preview”.
- **Bairro:** usar `neighborhood` explícito quando faltar no candidato; não colocá-lo em complemento/referência. Ambiguidade exige interação.
- **Idempotência:** confirmar com mesmo candidateId e mesmos parâmetros pode retornar `alreadyExists`; reutilizá-lo com dados diferentes gera conflito. Descartar candidatos ao finalizar a etapa; preservar o addressId retornado.

Não presumir que `formattedAddress` contém os mesmos componentes em listagem e criação; usar os campos estruturados quando existirem.

### 7.4. Erros User

Envelope: `errors` com `code`, `mcpCode`, `message`, `suggestedAction`, `retryable`.

| Código | Ação |
|---|---|
| `AUTHENTICATION_REQUIRED` | Interromper operações dependentes e reautenticar |
| `PLACE_NOT_FOUND` | Corrigir endereço com o usuário |
| `MISSING_ADDRESS` | Coletar endereço |
| `MISSING_NEIGHBORHOOD` | Coletar bairro e reenviar no campo próprio |
| `MISSING_CANDIDATE_ID` | Voltar à etapa de geocodificação/confirmar contrato |
| `CANDIDATE_ID_CONFLICT` | Obter novo candidato para os novos dados |
| `SERVICE_UNAVAILABLE` | Esperar conforme orientação; sem loop curto |

`retryable: true` pode significar corrigir a entrada antes, não repetir automaticamente. `PLACE_NOT_FOUND` e `MISSING_NEIGHBORHOOD` compartilham mcpCode; classificar pelo `code` textual. A página recomenda esperar minutos em indisponibilidade do serviço de endereço, mesmo havendo snippets genéricos de backoff.

## 8. Offer Discovery MCP — 6 ferramentas

Fontes: [introdução][D1], [tools][D2], [erros][D3], [casos][D4]. Todas são leituras. Cinco exigem `userLocation`; `listItemTaxonomy` é documentada como pública, sem localização/identidade no payload. Isso não prova que qualquer cliente entre no gateway protegido sem autenticação.

### 8.1. Entradas e finalidade

| Tool | Entradas obrigatórias | Opcionais principais | Uso |
|---|---|---|---|
| `searchOffers` | `query`, `userLocation` | `resultKind`, `merchantType`, `refinements`, paginação | Termo específico, como um prato |
| `browseOffers` | `merchantType`, `userLocation` | `resultKind`, `refinements`, paginação | Explorar sem texto de busca |
| `getRecommendations` | `contentMode`, `userLocation` | `resultKind`, `merchantType`, refinamentos próprios, paginação | Favoritos, recentes, recomendações, ofertas |
| `listItemTaxonomy` | `merchantType` | `expandFromTaxonomyId`, paginação | Categorias globais e expansão |
| `getMerchant` | `merchantId`, `userLocation` | — | Contexto operacional da loja selecionada |
| `getItem` | `merchantId`, `itemId`, `userLocation` | — | Detalhe e opções do item selecionado |

`merchantType`: `RESTAURANT`, `GROCERIES`, `LIQUORSTORE`, `DRUGSTORE`, `PETSTORE`, `SHOPPING`. Um enum existir não garante catálogo suficiente no endereço da demonstração.

### 8.2. Busca e refinamentos

As três listas usam `resultKind` (`MERCHANT` por padrão ou `ITEM`). Separe o objeto buscado dos filtros: “massa até R$40 perto de casa” vira termo descritivo em `query`, preço/distância em `refinements` e localização do endereço.

Busca documenta: `itemTaxonomy`, `merchantId`, `maxItemPrice`, `minItemPrice`, `maxDeliveryFee`, `maxDistanceKm`, `maxDeliveryTimeMinutes`, `onlyOpen`, `sort`, `dietary`, `requiredDeliveryMethod`. Não presumir que todas as outras tools aceitem a mesma lista: browse/recommendations têm subconjuntos e a página de recomendações menciona `priceRange` sem detalhar sua estrutura.

- Sorts publicados: `RELEVANCE`, `PRICE`, `DELIVERY_TIME`.
- Dietas publicadas: `VEGETARIAN`, `VEGAN`, `GLUTEN_FREE`. Isso não constitui garantia de alergênicos nem de ausência de contaminação cruzada. Não inventar enum sem lactose/proteico.
- Vários IDs em `itemTaxonomy` aplicam lógica OR, ampliando categorias; obter IDs das facets ou taxonomia, não de tradução livre.
- Distância publicada é em linha reta; não chamar isso de distância de percurso.

### 8.3. Recomendações e paginação

| `contentMode` | MERCHANT | ITEM |
|---|---|---|
| `RECOMMENDED` | Sim | Sim |
| `RECENT_ORDERS` | Sim | Sim |
| `FAVORITE_MERCHANTS` | Sim | Não |
| `BEST_DEALS` | Sim | Sim |
| `FEATURED_LOCAL` | Sim | Não |

`RECENT_ORDERS` acrescenta informações como `lastOrderedAt`, `timesOrdered`, `lastOrderId`. O último é referência opaca para reordenação conforme o contrato Cart; não equivale a uma API geral de histórico/status. Conta sem histórico pode produzir lista vazia.

Listas de ofertas: `pageSize` padrão 10, máximo 25. Taxonomia: padrão 50, máximo 100. Prosseguir com `nextPageToken` retornado e `hasMore`; não fabricar tokens. As categorias retornam disponibilidade `PLENTIFUL`, `ADEQUATE` ou `SCARCE`, sem comprovar um item comprável no endereço.

### 8.4. Respostas e detalhes

Lista MERCHANT fornece identidade/nome da loja, avaliação, abertura, entrega e distância; lista ITEM fornece item, preço e resumo da loja. `facets.itemTaxonomy` serve ao refinamento contextual.

`getMerchant` descreve `operatingHours`, `deliveryMethods`, `minimumOrderAmount`, `featuredItems` e deeplink. Horários publicados são locais; não converter como se já fossem UTC. Não é garantia de cardápio completo: navegar itens por filtros de merchant.

`getItem` descreve preço base/promocional, descrição, imagem e `optionGroups`. Cada grupo tem mínimo/máximo de seleções e opções com ID e preço adicional. Respeitar as cardinalidades. `promotionalUnitPrice` e `promotionalFee` são escalares, não um array universal `promotions`.

**Lacuna a validar:** Discovery fala em `optionGroupId`/`optionId`, enquanto Cart exige uma hierarquia Option/Customization e cita `customizationId`; o exemplo de getItem não demonstra essa tradução inteira. Não inventar um customizationId usando o ID do grupo. Conciliar os schemas reais antes de habilitar customizações complexas.

### 8.5. Erros Discovery

Também usa `errors`; os códigos de negócio documentados compartilham `mcpCode: -32301`.

| Código | Recuperação |
|---|---|
| `INVALID_QUERY` | Separar termo e filtros; pedir termo se faltar |
| `MISSING_LOCATION` | Resolver endereço/coordenadas |
| `MISSING_MERCHANT_VERTICAL` | Definir vertical em browse |
| `INCOMPATIBLE_RESULT_KIND` | Corrigir combinação com contentMode |
| `UNKNOWN_TAXONOMY_ID` | Voltar a categorias válidas |
| `INVALID_MERCHANT_VERTICAL` | Usar enum permitido |
| `MERCHANT_NOT_FOUND` / `MERCHANT_CLOSED` | Oferecer alternativas; não insistir na mesma loja |
| `ITEM_NOT_FOUND` | Atualizar catálogo e escolher alternativa |
| `ITEM_MERCHANT_MISMATCH` | Usar o par loja/item da mesma resposta |

Resultados vazios não são necessariamente erro. Explicar e negociar filtros; não relaxar silenciosamente uma restrição explicitamente exigida pelo usuário.

## 9. Cart MCP — 13 ferramentas

Fontes: [introdução][C1], [tools e schemas][C2], [erros][C3], [casos][C4]. **Não assumir carrinho vazio permitido.** Os exemplos atuais descrevem a criação com itens ou a partir de pedido anterior.

### 9.1. Catálogo de chamadas

| Tool | Entrada obrigatória | Condicionais/opcionais | Efeito e resposta |
|---|---|---|---|
| `createCart` | Do zero: `merchantId`, `addressId`, `items[]` com ≥1 item; ou reordenar: `orderId` | Entrega/pagamento já conhecidos podem ser informados | Novo carrinho; CartDetailsResponse; não idempotente |
| `getCart` | `cartId` | — | Leitura do estado completo |
| `getCartDeliveryMethods` | `cartId` | Carrinho já precisa de item/endereço | Leitura de métodos e horários |
| `addItemToCart` | `cartId`, `itemId`, `quantity`, `options[]` | `customerNote` | Adiciona linha/recalcula; guardar cartItemId |
| `updateCartItem` | `cartId`, `cartItemId`, `itemId`, `quantity`, `options[]` | `customerNote` | Substitui configuração da linha/recalcula |
| `removeItemFromCart` | `cartId`, `cartItemId` | — | Remove linha; último item pode excluir o carrinho |
| `removeVoucher` | `cartId` | — | Remove desconto; sem voucher é no-op |
| `listVouchers` | `cartId` | — | Lista vouchers aplicáveis a este carrinho |
| `setVoucher` | `cartId`, `code`, `campaignId` | Par vindo da listagem atual | Aplica desconto e recalcula |
| `setCartDelivery` | `cartId`, `deliveryMethodId` | `selectedTimeSlotId` quando exigido pelo método | Define entrega e recalcula |
| `listPaymentMethods` | `merchantId` | — | Lista métodos aceitos pela loja |
| `setCartPayment` | `cartId`, `paymentMethodId` | `cardTokenId` para cartão | Define pagamento; não finaliza sozinho |
| `submitOrder` | `cartId`, `userConsent` | `document` se fornecido, conforme contrato | Cria orderId, encerra carrinho, pode iniciar pagamento |

### 9.2. Criar, retomar e reordenar

Cada item inicial exige `itemId`, quantidade ≥1 e `options`, ainda que vazio. Não chamar createCart só para obter um ID e depois inserir o primeiro item. Se já existe carrinho, retomar com getCart em vez de criar duplicado.

Reordenação aceita `orderId` sem os campos de criação do zero; a documentação diz que merchant/endereço/itens são derivados e campos concomitantes são ignorados. Consultar getCart, revisar preço e disponibilidade atuais e conferir o endereço herdado. Não repetir um pedido sem nova revisão/consentimento.

Não foi documentado um TTL numérico do carrinho nem uma chave de idempotência para createCart/submitOrder. Em timeout com resultado incerto, não reenviar checkout automaticamente: primeiro reconciliar o estado pelo que o contrato permitir e informar a ambiguidade.

### 9.3. Itens, opções e remoção

`options` não é um mapa de textos livres. O modelo Cart tem opções com `optionId`, `quantity`, `customizations[]` obrigatório (pode ser vazio) e nota opcional. Uma customization possui `customizationId`, `quantity` e nota opcional; nomes podem aparecer para apresentação, mas não substituem IDs.

No update, enviar quantidade e opções completas, não só um patch parcial. A tabela permite omitir `customerNote` para manter a nota anterior, embora o texto introdutório fale em estado completo; validar o comportamento de limpar nota antes de implementá-lo. Quantidade zero não é a operação de remoção: usar removeItemFromCart.

Se remover o último item, procurar `agentHints.cartDeletedAfterLastItemRemoved` e invalidar o cartId local. Não interpretar uma resposta sem CartDetailsResponse como falha automaticamente nesse cenário.

### 9.4. Entrega, pagamento e voucher

Fluxos de descoberta obrigatórios: getCartDeliveryMethods → setCartDelivery; listPaymentMethods → setCartPayment; listVouchers → setVoucher. Valores são dinâmicos e vinculados ao contexto atual. Revisar novamente opções após mudanças relevantes de itens/endereço.

Modos de entrega publicados incluem `DELIVERY`, `TAKEOUT`, `PICKUP`; IDs como DEFAULT/EXPRESS são exemplos, não um enum fixo a codificar. Agendamento deve usar o identificador real do horário; a tabela Timeslot só mostra from/to, portanto a origem de selectedTimeSlotId precisa de validação no schema real.

Pagamento usa UUID do método, não `kind: PIX`. Kinds publicados incluem cartão crédito/débito, Pix e vales refeição/alimentação. O contrato exige cardTokenId para cartão, mas a tabela e o exemplo de listPaymentMethods o mostram null: não há fluxo completo de obtenção/tokenização demonstrado. Não coletar número de cartão em chat para preencher essa lacuna. Usar somente uma opção efetivamente suportada e autorizada para o teste.

Vouchers fornecem `code`, `campaignId`, efeito FIXED/PERCENTAGE, valor e possível teto. O total final é calculado pelo servidor; não reconstruir regras promocionais por conta própria.

### 9.5. Estado e totais retornados

CartDetailsResponse reúne `cartId`, `merchant`, `items`, `deliveryAddress`, `deliveryMethod`, `paymentMethod`, `fees`, `summary`, `warning`, `appDeeplink` e possíveis agentHints. Campos nulos são estados válidos de configuração incompleta.

`summary` apresenta subtotal, entrega, taxas adicionais, benefícios, voucher e total em BRL, com nomes/valores próprios. `warning.impact.canProceedToCheckout === false` deve bloquear checkout mesmo que exista um total. Guardar a resposta mais recente e conferir o estado antes de modificar e antes de submeter.

### 9.6. Checkout

Pré-condições: item disponível, carrinho com ≥1 item, entrega e pagamento definidos, avisos bloqueadores resolvidos e confirmação explícita. Mostrar itens/opções/quantidades, endereço, entrega, descontos, taxas, total e pagamento. Se houver mudança relevante após a confirmação, a recomendação de implementação é obter uma nova confirmação.

`userConsent: true` representa concordância real, não um default que o LLM pode preencher para passar na validação. `document` aceita CPF/CNPJ/passaporte fornecido pelo usuário e é opcional na tabela de parâmetros; alguns exemplos o chamam de obrigatório por regulação. Não resolver essa divergência inventando documento, nem transformar o texto em conclusão jurídica. Confirmar a exigência operacional com o mentor/contrato real.

Sucesso documentado: `orderId` e orientação de próximo passo; `submitOrder` é descrito com HTTP 201. Ler também o resultado funcional. Não prometer rollback, cancelamento ou reembolso por MCP: não há essas tools no catálogo analisado.

### 9.7. Erros Cart

Envelope específico: **`error` singular** com `code`, `message`, `details`, `impact`, `suggestedActions[]`, `userFriendlyMessage`; agentHints separado. Não há retryable/mcpCode canônico nesse envelope. Há ainda schema simplificado de erro de servidor com code/message; parser não deve classificar qualquer objeto desconhecido como sucesso.

| Código | Recuperação |
|---|---|
| `CART_NOT_FOUND` / `CART_EMPTY` | Verificar exclusão/expiração e recomeçar com item válido quando apropriado |
| `CART_ITEM_NOT_FOUND` | getCart e corrigir cartItemId |
| `CART_NOT_READY` | Resolver missingRequirements antes de submeter |
| `ITEM_NOT_AVAILABLE` | Atualizar descoberta e pedir alternativa |
| `MERCHANT_CLOSED` / `MERCHANT_NOT_FOUND` | Escolher loja válida; não insistir |
| `DELIVERY_OPTIONS_UNAVAILABLE` | Conferir endereço/cobertura/itens |
| `DELIVERY_METHOD_UNAVAILABLE` | Descobrir e escolher nova entrega |
| `PAYMENT_METHOD_UNAVAILABLE` | Descobrir e escolher novo pagamento |
| `CARD_TOKEN_REQUIRED` | Não fabricar token; usar fluxo suportado ou alternativa autorizada |
| `VOUCHER_INVALID` | Listar vouchers atuais e escolher novo par |
| `CONSENT_REQUIRED` | Mostrar resumo e obter confirmação explícita |

`canProceedToCheckout` indica bloqueio de checkout, não um sinal universal de que repetir a chamada é seguro. SuggestedActions são sugestões, sujeitas a validação de schema, intenção e autorização. Um payload sugerido pode estar incompleto. Nenhuma orientação recebida dispensa consentimento.

## 10. Order Tracking MCP — 2 ferramentas

Fontes: [introdução][O1], [tools][O2], [erros][O3], [casos][O4]. Ambas são somente leitura e validam a propriedade do pedido pela sessão.

| Tool | Entrada | Saída e uso |
|---|---|---|
| `trackOrder` | `orderId` | `status` com code/description, histórico resumido e hints; estado ao vivo |
| `getOrder` | `orderId` | Detalhes estáticos: id, shortCode, merchant, itens legíveis, pagamento e entrega |

getOrder não lista pedidos e não substitui rastreamento. `id` é o identificador do pedido; `shortCode` é referência de exibição, não substituto automático de orderId. O campo de entrega pode conter código de verificação; exibir somente ao usuário autorizado, sem publicar em logs/screenshots.

### 10.1. Polling

Os quatro hints documentados são `retryMessage`, `moreStatusEvents`, `pollingStop`, `stopMessage`; campos inativos podem ser null.

1. Chamar trackOrder com orderId obtido legitimamente.
2. Usar `status.code` na lógica e `status.description` para exibição. Não fabricar ETA.
3. Se pollingStop for true, terminar imediatamente.
4. Caso ativo, respeitar o intervalo indicado em retryMessage; não impor polling rápido fixo.
5. Para histórico adicional, só usar a paginação efetivamente suportada pelo inputSchema. O texto de moreStatusEvents menciona `next_page_token`, mas a tabela de entrada documenta apenas orderId.

O histórico retorna aproximadamente 3–5 transições recentes, mais nova primeiro; exemplos embutem timestamp na descrição, não garantem um campo timestamp separado. Para detalhes imutáveis, cache de getOrder pode reduzir chamadas, desde que isolado por usuário e sujeito às regras de retenção.

Status exemplificados: ORDER_CREATED, PAYMENT_DECLINED, CONFIRMED, PREPARING, DISPATCHED, ON_THE_WAY, ORDER_LATE, DELIVERY_ARRIVED_AT_DESTINATION, DELIVERED. Não fixar essa lista como contrato fechado de estados terminais: usar pollingStop.

### 10.2. Erros Order

São campos **na raiz**: `errorType`, `code`, `message`, `retryable`, `suggestion`.

- ORDER_NOT_FOUND em trackOrder: documentado sem retry.
- ORDER_NOT_FOUND em getOrder: documentado com possibilidade de retry breve, inclusive consistência eventual. Usar limite; não procurar indefinidamente um pedido inexistente.
- ORDER_ACCESS_DENIED: interromper; conferir a origem do ID e a sessão. Não enumerar outros IDs nem mudar de identidade para contornar a validação.

O mesmo code pode ter recuperação diferente conforme a tool. Não construir um único mapa global code → retry sem considerar domínio e operação.

## 11. Jornada ponta a ponta de referência

Esta é uma sequência técnica, não uma ideia de produto escolhida pelo time:

1. OAuth e consentimento de dados em sessão válida de teste.
2. listAddresses; selecionar endereço ou criar quando necessário/autorizado.
3. searchOffers, browseOffers ou getRecommendations conforme intenção; obter pares de IDs.
4. getMerchant e getItem; resolver disponibilidade, preço e opções.
5. createCart com loja, endereço e ≥1 item completo; ou reordenar com orderId permitido.
6. getCart e eventuais adições/updates/remoções; guardar os IDs retornados.
7. Descobrir e definir entrega; descobrir e definir pagamento; voucher opcional.
8. getCart final; resolver warning/error; apresentar resumo e obter confirmação humana.
9. submitOrder uma vez com os campos reais; tratar falha de negócio e resultado incerto separadamente.
10. Após orderId confirmado, trackOrder no ritmo indicado e getOrder para detalhes.

O aplicativo deve manter os estados **aguardando login**, **escolhendo endereço**, **descobrindo**, **configurando itens**, **revisando carrinho**, **aguardando confirmação**, **submetendo**, **pedido confirmado**, **falha/resultado incerto**. Isso é recomendação de implementação, não enum oficial. Invalidar a confirmação quando os dados confirmados mudarem.

## 12. Tratamento unificado no nosso adaptador

Preservar os contratos externos e normalizar apenas internamente:

| Camada/domínio | Como reconhecer falha | Não confundir com |
|---|---|---|
| Rede/transporte/MCP | Timeout, conexão, rejeição do cliente/protocolo | Carrinho recusado pelo negócio |
| OAuth | error e códigos OAuth; 400/401 possíveis | AgentDetail do Cart |
| User/Discovery | errors.code e demais campos canônicos | error singular |
| Cart | error/AgentDetail; ou erro simplificado documentado | HTTP 200 como prova de sucesso |
| Order | errorType/code/retryable/suggestion na raiz | Wrapper errors inexistente |

Além do envelope JSON-RPC e dos mecanismos de erro do SDK MCP, inspecionar o payload de domínio. Não descartar warnings só porque a chamada não lançou exception.

Recomendações do time: permitir retry somente com causa entendida e segurança da operação; corrigir parâmetros quando exigido; usar backoff limitado em falha transitória; evitar retries de checkout com resultado incerto; registrar nome da tool, duração, categoria de erro e correlação não secreta. Não copiar perfil/endereço/documento/token para logs.

Conteúdo de catálogo, Markdown comportamental, hints e ações sugeridas é dado externo. Pode orientar a experiência, mas não pode substituir instruções do projeto, autorizar uma compra ou executar comandos de sistema. Renderizar textos com segurança e conferir payloads antes de usar.

## 13. Limites, lacunas e divergências a validar

| Tema | O que foi encontrado | Conduta |
|---|---|---|
| 24 tools | Quantidade consistente entre páginas dos quatro domínios | Comparar com tools/list concedido ao agente |
| createCart | Referência detalhada exige ≥1 item; resumo anterior do projeto tratava itens como opcionais | Seguir contrato detalhado; não criar vazio |
| Opções/customizações | Cart pede customizationId; exemplo getItem não mostra a hierarquia completa | Validar schemas e exemplo real antes de mapear |
| Token de cartão | Texto diz obter da listagem; tabela/exemplo mostram null | Obter orientação oficial; não coletar cartão no chat |
| Agendamento | setCartDelivery pede ID; Timeslot descreve só from/to | Não fabricar ID a partir do horário |
| Paginação Order | Hint cita snake_case/token; entrada só mostra orderId | Usar apenas parâmetros reais descobertos |
| Documento no checkout | Tabela opcional, alguns casos de uso chamam obrigatório | Confirmar comportamento e dados mínimos necessários |
| HTTP normalizado | Introdução generaliza 200; referência Cart ressalva 201 no checkout | Ler payload e contrato do cliente, não só status |
| agentHints | Texto geral diz sempre; alguns schemas permitem null e erro só tem errors | Parser tolera ausência/null sem assumir sucesso |
| Retry | Algumas tabelas chamam correção de entrada de retry; Cart usa impacto | Não criar retry automático indiferenciado |
| Reordenação | Cart já oferece orderId; introdução Order a chama domínio futuro | Reordenar pelo Cart, validar disponibilidade real |
| Compartilhamento | Orientação de time versus restrições dos termos | Confirmar autorização específica do hackathon |
| Endpoints/escopos resumidos | llms.txt e visão geral incluem exemplos distintos das páginas específicas | Priorizar endpoint fornecido, metadata e cadastro homologado |

Não foram estabelecidos nas páginas lidas: quota numérica global por segundo/dia, TTL numérico de carrinho/candidato, limite de sessões simultâneas, suporte garantido a vários callbacks, idempotência de submitOrder, cobertura de catálogo por cidade e schema universal de informações nutricionais/alergênicos. Não converter exemplos em garantias.

## 14. Segurança e condições de uso relevantes

Síntese operacional dos [termos][T1], sem substituir sua leitura/aceite: menor privilégio, ambiente autorizado, não contornar limites, credenciais sem distribuição presumida, minimização de dados, cautela com terceiros/LLMs e logs sem segredos. Testar não autoriza produção. Publicar uma síntese documental não deve incluir dados obtidos de usuários, tokens ou resultados confidenciais do serviço.

A documentação e as marcas continuam de titularidade do iFood; os componentes criados pelo desenvolvedor têm regras próprias de licença ao registrar/publicar no portal. Alterações, suspensão e encerramento são previstos. Os termos também tratam obrigações de incidentes e privacidade, incluindo comunicação em até 24h em situações descritas no §7.10. Para qualquer decisão contratual, consultar o texto vigente completo.

Este guia usa paráfrases e nomes técnicos, não reproduz integralmente as páginas ou os exemplos da plataforma.

## 15. Setup e divisão de trabalho

Para setup do cliente no repositório, consulte `docs/setup-ifood.md`, se presente. A configuração local anterior foi reconhecida pelo OpenCode 1.19.3, mas isso não comprova OAuth nem ferramentas. Comandos de cliente precisam ser conferidos na versão usada. Não substituir o callback do aplicativo já aprovado sem coordenação.

Para Claude Code, o guia de instalação iFood descreve conexão HTTP e autenticação via `/mcp`; o comando completo e a porta devem ser validados na ajuda da versão instalada. Não inferir que a configuração do Claude Desktop ou de outro cliente seja automaticamente compartilhada com o Claude Code só por haver texto semelhante na página.

Divisão sugerida por responsabilidade, sem mudar a governança:

- Integração: OAuth, descoberta de schemas, adaptador por domínio e política de erro.
- Agente: decisão de tool, estado da conversa, proveniência dos IDs e confirmação.
- Interface: endereço/opções/carrinho, totais, estados de autenticação/falha e rastreamento.
- Integrador: contratos compartilhados, revisão, testes do fluxo e documentação dos limites.

As fatias precisam de cards/branches próprios. Não editar `regras-de-negocio.md` por agente. Uma pessoa pode contribuir em mais de uma área, mas arquivos/contratos compartilhados precisam de coordenação explícita.

## 16. Checklist de validação antes da demo

- [ ] Agente homologado; endpoint, callback e escopos reais registrados sem segredos.
- [ ] Cada integrante acessa com sessão autorizada própria; modelo de credenciais do time confirmado.
- [ ] tools/list real comparado ao catálogo de 24; diferenças registradas, sem fingir integração.
- [ ] Leitura de conta de teste validada com sessão/usuário corretos.
- [ ] Endereços: zero, um, vários, dataWarning, candidato ambíguo e bairro ausente tratados.
- [ ] Discovery: termo/filtros separados, paginação, lista vazia, loja fechada e par item/loja inválido tratados.
- [ ] Customizações reconciliadas com schema real; grupos obrigatórios respeitados.
- [ ] Cart criado com item inicial; options e customizations presentes quando exigidos.
- [ ] Update usa itemId e cartItemId; remover o último invalida o carrinho.
- [ ] Entrega, pagamento e voucher vêm das respectivas listagens atuais.
- [ ] Totais do servidor e warnings aparecem na revisão; mudança invalida consentimento anterior.
- [ ] Sem confirmação, não há submitOrder; timeout ambíguo não produz reenvio automático.
- [ ] Erros User/Discovery, Cart, Order e OAuth são diferenciados.
- [ ] Rastreamento respeita retryMessage e pollingStop; getOrder não é usado como status.
- [ ] Dados de teste e modo simulado estão identificados; nenhum Pix pago.
- [ ] Feedback registra comportamentos observados, inclusive divergências de documentação.

## 17. Cobertura das fontes oficiais

As 27 páginas de navegação abaixo foram consultadas como base desta síntese; a rota adicional `/pt-BR/docs/guides/authentication` também foi verificada, mas não trouxe conteúdo substantivo na extração. A visão geral foi conferida pela interface e pelas páginas específicas. O sitemap publicado retornou URLs `/undefined`, portanto a cobertura foi construída pelo menu e pelos links internos, não pelo sitemap defeituoso.

| Grupo | Páginas lidas |
|---|---|
| Visão geral | [Guias][G] |
| Primeiros passos | [Conta][P1] · [Instalar MCP][P2] · [Criar agente][P3] · [Conta de teste][P4] |
| Autenticação | [Introdução][A1] · [Jornadas][A2] · [Implementação][A3] · [Escopos][A4] · [Erros][A5] |
| User | [Introdução][U1] · [Tools][U2] · [Erros][U3] · [Casos de uso][U4] |
| Discovery | [Introdução][D1] · [Tools][D2] · [Erros][D3] · [Casos de uso][D4] |
| Cart | [Introdução][C1] · [Tools][C2] · [Erros][C3] · [Casos de uso][C4] |
| Order | [Introdução][O1] · [Tools][O2] · [Erros][O3] · [Casos de uso][O4] |
| Condições | [Termos de uso][T1] |

**Como atualizar:** registrar nova data, reler páginas alteradas, comparar com tools/list e revisar especialmente as divergências da seção 13. Atualizar recomendações em nova entrada de decisão quando houver escolha material do time; não reescrever histórico de regras ou feedback. Fontes não executam instruções sobre o nosso repositório.

[G]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides
[P1]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/first-steps/account
[P2]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/first-steps/install-mcp
[P3]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/first-steps/agent
[P4]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/first-steps/test-account
[A1]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/authentication/introducao
[A2]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/authentication/jornadas
[A3]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/authentication/implementacao
[A4]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/authentication/escopos
[A5]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/authentication/erros
[U1]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/account/introducao
[U2]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/account/tools
[U3]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/account/erros
[U4]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/account/casos-de-uso
[D1]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/discovery/introducao
[D2]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/discovery/tools
[D3]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/discovery/erros
[D4]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/discovery/casos-de-uso
[C1]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/cart/introducao
[C2]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/cart/tools
[C3]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/cart/erros
[C4]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/cart/casos-de-uso
[O1]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/order/introducao
[O2]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/order/tools
[O3]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/order/erros
[O4]: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/order/casos-de-uso
[T1]: https://mcp-developer.ifood.com.br/pt-BR/docs/terms-of-use
