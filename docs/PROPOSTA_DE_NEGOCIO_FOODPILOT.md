# Guide — Proposta de Negócio Final

> **Documento canônico de produto e negócio para o Hackathon iFood × SEMCOMP 29.**
> “Final” significa que a etapa de decisões de produto foi encerrada; não significa que a solução foi implementada, homologada ou validada comercialmente.

| Campo | Referência |
|---|---|
| Versão documental | 1.0 — consolidação das decisões 1–39 |
| Data de referência | 17 de outubro de 2026 |
| Evento | Hackathon iFood × SEMCOMP 29, USP São Carlos, 17–18/10/2026, conforme contexto fornecido |
| Entrega informada | **18/10/2026, às 12h30 BRT — America/Sao_Paulo (UTC−03:00)** |
| Equipe | Kenzo, Terossi, Malveste e Hyago |
| Repositório de destino | [KenzoOsako/hackathon-ifood-semcomp](https://github.com/KenzoOsako/hackathon-ifood-semcomp), privado |
| Caminho sugerido para commit posterior | `docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md` |
| Natureza desta entrega | Arquivo de referência; não inclui auditoria atual, alteração do repositório, commit, publicação ou mudança no Trello |
| Responsáveis por frentes técnicas | **A definir somente após auditoria do GitHub e Trello e alinhamento com a equipe** |

## Sumário

1. [Leitura, autoridade e estado das evidências](#1-leitura-autoridade-e-estado-das-evidências)
2. [Sumário executivo](#2-sumário-executivo)
3. [Contexto do hackathon e oportunidade](#3-contexto-do-hackathon-e-oportunidade)
4. [Problema, segmentos e personas hipotéticas](#4-problema-segmentos-e-personas-hipotéticas)
5. [Jobs to be Done e proposta de valor](#5-jobs-to-be-done-e-proposta-de-valor)
6. [Escopo e limites do produto](#6-escopo-e-limites-do-produto)
7. [Jornada do consumidor e diálogo de referência](#7-jornada-do-consumidor-e-diálogo-de-referência)
8. [Motor de recomendação e cinco modos](#8-motor-de-recomendação-e-cinco-modos)
9. [Experiência, voz e acessibilidade](#9-experiência-voz-e-acessibilidade)
10. [Matriz de requisitos funcionais](#10-matriz-de-requisitos-funcionais)
11. [Matriz de requisitos não funcionais](#11-matriz-de-requisitos-não-funcionais)
12. [Arquitetura proposta e fluxo de execução](#12-arquitetura-proposta-e-fluxo-de-execução)
13. [MCP, OAuth, autorização e checkout](#13-mcp-oauth-autorização-e-checkout)
14. [IA, modelo e provedores de voz](#14-ia-modelo-e-provedores-de-voz)
15. [Dados, memória, Supabase e isolamento](#15-dados-memória-supabase-e-isolamento)
16. [Privacidade, segurança alimentar e ética](#16-privacidade-segurança-alimentar-e-ética)
17. [Modelo de negócio, operação e hipóteses](#17-modelo-de-negócio-operação-e-hipóteses)
18. [Alternativas e posicionamento competitivo](#18-alternativas-e-posicionamento-competitivo)
19. [Prioridades P0, P1 e P2](#19-prioridades-p0-p1-e-p2)
20. [Critérios de aceite e definição de pronto](#20-critérios-de-aceite-e-definição-de-pronto)
21. [Validação, experimentos e indicadores](#21-validação-experimentos-e-indicadores)
22. [Riscos e mitigação](#22-riscos-e-mitigação)
23. [Roadmap e cronograma do hackathon](#23-roadmap-e-cronograma-do-hackathon)
24. [Equipe, governança e auditoria anterior às tarefas](#24-equipe-governança-e-auditoria-anterior-às-tarefas)
25. [Demonstração, pitch e perguntas](#25-demonstração-pitch-e-perguntas)
26. [Bloqueios e próximos passos](#26-bloqueios-e-próximos-passos)
27. [Glossário](#27-glossário)
28. [Apêndice A — rastreabilidade das decisões 1–39](#28-apêndice-a--rastreabilidade-das-decisões-139)
29. [Apêndice B — fontes, evidências e manutenção](#29-apêndice-b--fontes-evidências-e-manutenção)

## 1. Leitura, autoridade e estado das evidências

### 1.1 Convenções

- **[DECISÃO APROVADA]**: requisito de produto ou direção de negócio aprovado na etapa de decisões. A aprovação não comprova entrega técnica e não autoriza acesso a dados de terceiros.
- **[A VALIDAR]**: capacidade, contrato, hipótese operacional ou estado que exige evidência técnica, documental, de usuário ou da organização do evento.
- **[HIPÓTESE]**: benefício ou comportamento esperado, ainda sem comprovação empírica nesta proposta.
- **[FUTURO/ROADMAP]**: evolução fora do núcleo demonstrável prioritário. Não deve ser apresentada como funcionalidade disponível.

As tabelas de requisitos usam “prioridade proposta” para orientar o recorte depois da auditoria. A equipe pode adiar uma implementação sem revogar a decisão de produto. Qualquer mudança no significado de uma decisão aprovada precisa de registro explícito.

### 1.2 Autoridade deste documento

**[DECISÃO APROVADA]** As decisões 1–38 são requisitos aprovados. A decisão 39 encerra o questionário e estabelece a auditoria do repositório e Trello antes de distribuir tarefas. Não reabrir essas perguntas apenas para produzir documentação.

O pedido de consolidação de 17/10/2026 é a fonte principal do conteúdo final. Materiais anteriores ajudam a contextualizar, mas não substituem as decisões consolidadas. Em conflito com código ou documentação antiga, registrar a divergência e planejar a atualização; não afirmar que o código já atende ao requisito.

### 1.3 Estado histórico, não certificação atual

**[A VALIDAR]** Foi relatado um snapshot associado ao commit `6c1b414411fcbc8ffaa0832d2617fd3f03fa79bd` e ao [PR #4](https://github.com/KenzoOsako/hackathon-ifood-semcomp/pull/4), referido como mesclado em 17/10/2026 às 16h44 BRT. Esses identificadores são referências para auditoria posterior. **Este documento não confirmou o HEAD atual, o merge, os testes, o deploy ou o conteúdo atual do Trello.**

No snapshot anteriormente relatado, a base era Next.js 16.4.2, React 19.3, TypeScript, Zod, Vitest e API routes. Havia interface textual, recomendações com dados mock, parser de keywords, ranking determinístico e memória efêmera em RAM. Não havia MCP real, OAuth da aplicação, voz, LLM ou memória persistente naquele relato. As versões, os componentes e essas ausências devem ser rechecados; não são inventário atual confirmado.

Nenhuma métrica de conversão, satisfação, latência, qualidade ou sucesso com consumidores foi produzida por esta consolidação. Nenhum acesso, aprovação, parceria, direito de uso de marca, capacidade transacional ou integração oficial é inferido da proposta.

## 2. Sumário executivo

**[DECISÃO APROVADA]** O Guide é um copiloto de compras por conversação, com voz como interação primária e texto sempre disponível. Seu MVP ajuda consumidores do iFood a decidir o que comer, comparar até três recomendações iniciais contextualizadas e aprovar uma proposta de carrinho. A compra final acontece no iFood.

O produto se concentra em três problemas: indecisão diante das opções, fricção entre intenção e escolha e personalização insuficiente para o contexto do momento. A experiência transforma pedidos como “quero jantar algo diferente, rápido e dentro do meu orçamento” em opções explicadas, com refinamento e controle pelo consumidor.

**[DECISÃO APROVADA]** O protótipo será um site Next.js. A integração real com o MCP do iFood é prioritária e precisa ser validada por operação. O uso de dados pessoais depende da autorização adequada; visitantes não recebem contexto privado da conta. Preferências e feedback podem enriquecer recomendações, mediante controles de memória e privacidade.

**[HIPÓTESE]** Ao reduzir esforço de decisão e facilitar a descoberta relevante, o Guide pode contribuir para conversão, retenção, satisfação e recompra na plataforma. A proposta prevê uso gratuito ao consumidor. Esses efeitos são hipóteses de valor, não resultados observados nem compromissos do iFood.

**[DECISÃO APROVADA]** O sucesso mínimo no hackathon é **uma jornada demonstrável por voz OU texto**, com autorização, contexto MCP real, recomendação e proposta de carrinho. Voz permanece a direção principal do produto, mas a demonstração pode usar texto se isso preservar uma jornada íntegra e verificável. A existência de carrinho real transferível ou acompanhamento posterior depende de capacidades comprovadas do MCP.

**[FUTURO/ROADMAP]** Uma integração nativa no aplicativo oficial iFood e a expansão Guide Market são possibilidades futuras. Não representam parceria, aprovação ou compromisso de implementação.

## 3. Contexto do hackathon e oportunidade

O documento considera o evento iFood × SEMCOMP 29, na USP São Carlos, em 17 e 18 de outubro de 2026, com entrega informada para 18/10 às 12h30 BRT. **[A VALIDAR]** A equipe deve conferir no regulamento vigente os formatos de entrega, critérios de avaliação, uso de APIs, limites de ambiente e regras de demonstração. O formato de apresentação aqui preparado é de cinco minutos de pitch e três de perguntas; seu enquadramento no roteiro oficial também deve ser conferido.

A oportunidade é demonstrar que um agente pode transformar intenção em uma decisão de compra compreensível sem esconder limites ou retirar o controle do consumidor. O foco do hackathon é uma prova funcional delimitada, apoiada por uma tese de negócio testável e por evidências de integração real.

O prazo curto exige distinguir ambição de produto de compromisso de entrega. A prioridade não é cobrir todas as decisões com telas superficiais: é validar a dependência MCP, implementar um fluxo consistente e documentar honestamente as demais capacidades. Segurança de autorização, restrições alimentares e confirmação antes de mutações não são itens opcionais para caber no prazo.

## 4. Problema, segmentos e personas hipotéticas

### 4.1 Tríade do problema

| Problema aprovado | Manifestação possível | Resposta proposta | Evidência necessária |
|---|---|---|---|
| Indecisão | Consumidor navega entre muitas opções sem formar uma escolha | Até três opções explicadas e refinamento contextual | Observação de tarefas e motivos de abandono |
| Fricção | Preferências, orçamento e comparação precisam ser reconstruídos em etapas | Conversa contínua, comparação e proposta de carrinho | Tempo, interações e pontos de interrupção |
| Personalização insuficiente | Sugestões não refletem intenção, rotina ou preferência atual | Contexto autorizado, feedback e memória controlável | Relevância percebida e adequação das explicações |

**[HIPÓTESE]** Esses problemas podem ocorrer com intensidades distintas. O documento não estima sua frequência na base do iFood nem afirma insuficiência universal da experiência atual.

### 4.2 Segmentos

**[DECISÃO APROVADA]** O público-alvo é amplo: consumidores do iFood. O MVP não restringe o produto a estudantes, trabalhadores ou a uma faixa etária específica. Segmentos abaixo são recortes úteis para pesquisa, não públicos exclusivos nem segmentos já validados.

| Persona hipotética | Situação | Necessidade | Cuidado de produto |
|---|---|---|---|
| Pessoa com pouco tempo | Precisa escolher uma refeição entre compromissos | Conciliar ETA e adequação do pedido | Não tratar ETA estimado como garantia |
| Pessoa orientada a orçamento | Quer controlar o gasto total | Distinguir teto rígido de objetivo flexível | Considerar frete e taxas conhecidos |
| Pessoa indecisa | Sabe que quer comer, mas não escolheu categoria | Delegar descoberta e comparar poucas opções | Explicar sugestões e permitir rejeição |
| Pessoa que busca variedade | Percebe repetição em escolhas recentes | Descobrir alternativas compatíveis | Usar histórico somente quando autorizado |
| Pessoa com restrição alimentar | Precisa evitar ingredientes ou condições específicas | Filtrar, explicitar incerteza e confirmar composição | Não emitir garantia de segurança alimentar |

Essas personas podem se sobrepor na mesma sessão. A pesquisa deve incluir pessoas com diferentes familiaridades digitais, preferências por voz/texto e necessidades de acessibilidade.

## 5. Jobs to be Done e proposta de valor

### 5.1 Jobs to be Done

- Quando estou com fome e indeciso, quero explicar o que desejo em linguagem natural para receber poucas opções justificadas e escolher com menos esforço.
- Quando tenho limite de gasto ou tempo, quero que as sugestões respeitem essas condições e deixem claros os custos e estimativas.
- Quando quero variar, quero descobrir alternativas compatíveis sem reconstruir todas as minhas preferências.
- Quando uma sugestão não serve, quero dizer o motivo e ajustar a próxima rodada mantendo o contexto.
- Quando decido comprar, quero revisar o carrinho e continuar no iFood sabendo o que foi efetivamente preparado.
- Quando compartilho preferências, quero controlar o que fica salvo, por quanto tempo e para qual finalidade.

### 5.2 Proposta de valor

**[DECISÃO APROVADA]** “Diga o que você quer comer, refine poucas opções explicadas e aprove sua proposta de carrinho para continuar a compra no iFood.”

| Beneficiário | Benefício pretendido | Natureza |
|---|---|---|
| Consumidor | Menor esforço para decidir e maior clareza sobre alternativas | Hipótese a testar |
| Consumidor | Controle sobre orçamento, preferências e autorização | Requisito de experiência |
| Plataforma | Possível melhora na conversão, retenção, satisfação e recompra | Hipótese de negócio |
| Estabelecimento | Possível descoberta por consumidores com intenção compatível | Hipótese indireta; sem promessa de exposição |

O diferencial pretendido é a continuidade entre intenção, contexto autorizado, explicação e proposta de carrinho. “Copiloto” significa assistência com aprovação humana. O produto não promete comprar autonomamente, oferecer o menor preço de todo o mercado ou garantir segurança de pratos.

## 6. Escopo e limites do produto

### 6.1 Escopo aprovado

O MVP atende restaurantes e refeições. Pode recomendar pratos ou estabelecimentos conforme a intenção: uma pessoa que pede “uma pizza para dividir” precisa de uma proposta de refeição; quem pede “um restaurante japonês perto daqui” pode começar por estabelecimentos. A resposta deve manter coerência entre itens, disponibilidade, endereço e estabelecimento.

O Guide recomenda e prepara a proposta de carrinho; checkout e conclusão da compra ocorrem no iFood. Proposta local, carrinho remoto e pedido confirmado são estados diferentes e precisam de rótulos diferentes.

Login é opcional para iniciar a experiência. Visitantes podem usar voz e texto com dados efêmeros de sessão. A consulta a catálogo público depende de acesso permitido; a existência de modo visitante não prova disponibilidade de catálogo sem autorização. Sem fonte permitida, explicar a limitação e oferecer orientação ou demonstração mock sinalizada, sem apresentar dados inventados como reais.

### 6.2 Fora do núcleo inicial

**[FUTURO/ROADMAP]** Guide Market inclui comparar mercados, interpretar lista de compras e montar cesta. Supermercado não integra o MVP de refeições. Integração nativa no app, notificações externas, automação mais ampla e interrupção avançada de fala podem ser avaliadas posteriormente.

**[A VALIDAR]** Tracking de pedidos, transferência de carrinho, múltiplos estabelecimentos, criação/alteração de endereços e qualquer mutação remota dependem de suporte real e autorização. A decisão de desejá-los não cria a capacidade no MCP.

## 7. Jornada do consumidor e diálogo de referência

### 7.1 Jornada narrada

1. **Abrir e entender.** A interface oferece falar ou digitar. Se houver contexto previamente autorizado, pode sugerir uma intenção contextual; caso contrário, faz uma pergunta curta, sem onboarding obrigatório.
2. **Expressar intenção.** A pessoa diz o tipo de refeição, tempo, orçamento ou preferência. O sistema identifica o que é necessário para a próxima decisão e pergunta somente o que falta.
3. **Autorizar quando necessário.** Antes de usar contexto privado ou recursos protegidos, o sistema explica finalidade e solicita o fluxo de autorização aplicável. A recusa mantém as capacidades permitidas de visitante.
4. **Confirmar contexto.** Um endereço disponível é informado para revisão; havendo vários, a pessoa confirma qual utilizar antes de prosseguir. Contexto temporário não vira preferência permanente automaticamente.
5. **Aplicar limites.** Alergias, restrições rígidas e teto duro são tratados antes do ranking. Uma falta de informação crítica é explicitada.
6. **Explorar poucas opções.** Até três recomendações dinâmicas mostram os motivos relevantes, custos conhecidos, estimativas e lacunas. A pessoa pode comparar, rejeitar ou refinar.
7. **Revisar a proposta.** A interface reúne itens, quantidades, complementos verificados, estabelecimento e custos conhecidos. Mudanças materiais exigem nova revisão.
8. **Aprovar a ação.** Somente após aprovação explícita pode ser chamada uma operação real de adicionar itens. A pessoa sabe se está aprovando uma proposta local ou uma mutação remota.
9. **Continuar no iFood.** Usa-se o melhor fallback tecnicamente comprovado. Transferir carrinho não equivale a confirmar pedido. Se a continuidade automática não existir, um resumo manual preserva a escolha.
10. **Aprender sob controle.** Feedback por voz, texto ou botões melhora a sessão e, quando consentido, a memória. Preferências duradouras importantes são confirmadas.

### 7.2 Exemplo ilustrativo de diálogo

**[HIPÓTESE / EXEMPLO]** O diálogo a seguir descreve comportamento desejado. Não registra execução real. Pratos, custos e disponibilidade só podem ser apresentados na aplicação quando vierem de uma fonte permitida e atual.

> **Pessoa:** Quero jantar algo diferente, mas sem gastar muito.
>
> **Guide:** Você tem um teto total que não posso ultrapassar ou um valor que gostaria de buscar?
>
> **Pessoa:** No máximo R$ 45, incluindo entrega e taxas. Não posso comer amendoim.
>
> **Guide:** Vou tratar R$ 45 como teto e amendoim como restrição rígida. Se eu não conseguir confirmar composição e risco de contaminação cruzada, vou sinalizar a incerteza. Quer manter essa restrição apenas nesta sessão?
>
> **Pessoa:** Sim. Pode usar meu endereço cadastrado.
>
> **Guide:** Para consultar seus endereços, preciso da autorização correspondente. Depois de autorizado, confirmarei o endereço usado.
>
> **[A pessoa conclui a autorização; o sistema informa o único endereço retornado ou pede escolha entre vários.]**
>
> **Guide:** Encontrei opções, mas algumas não têm informação suficiente sobre amendoim. Vou separar o que precisa de confirmação com o restaurante. Também não apresentarei um total como dentro do teto se faltarem taxas.
>
> **Pessoa:** Compare as duas opções elegíveis e priorize a mais rápida.
>
> **Guide:** Vou comparar ETA informado, custo conhecido e adequação às suas condições. O prazo é estimado. Veja os dados e as pendências em cada opção.
>
> **Pessoa:** Quero a segunda.
>
> **Guide:** Esta é a proposta com os itens e custos disponíveis. A composição ainda precisa ser confirmada com o restaurante. Se essa condição não estiver resolvida, não vou tratar a opção como segura. Após a revisão, você poderá aprovar a ação de carrinho que estiver disponível.

No cenário sem alergia ou com os esclarecimentos necessários resolvidos, a pessoa revisa e aprova o carrinho. Se não houver transferência comprovada, o sistema informa “vou abrir o link confirmado” ou “aqui está o resumo para montar no iFood”, conforme o fallback disponível. O texto nunca diz “pedido realizado” sem confirmação real de pedido.

## 8. Motor de recomendação e cinco modos

### 8.1 Ordem de processamento

**[DECISÃO APROVADA]** O motor aplica primeiro as restrições rígidas e somente depois calcula a ordenação. Preferências, orçamento, ETA, avaliações, histórico autorizado e intenção participam do ranking adaptativo. “Adaptativo” significa ajustar critérios ao contexto e ao feedback; não exige treinar um modelo.

Fluxo conceitual:

```text
Intenção + contexto permitido + restrições
  → validar origem, atualidade e campos disponíveis
  → separar hard constraints de preferências flexíveis
  → excluir incompatibilidades e tratar dados críticos desconhecidos
  → calcular custos conhecidos e elegibilidade
  → ordenar candidatos elegíveis conforme o modo
  → diversificar sem violar restrições
  → devolver até três opções com explicação rastreável
  → incorporar refinamento e feedback autorizado
```

Uma formulação orientadora é `score = soma(peso_do_contexto × atributo_normalizado) − penalidades_explícitas`. **[A VALIDAR]** Os pesos, escalas, tratamento de ausência de dados e desempates serão definidos e testados na implementação. Não existem pesos aprovados ou qualidade estatística demonstrada neste documento. Cálculos monetários devem ser determinísticos, preferencialmente com valores em unidade monetária mínima.

Não produzir três opções por obrigação quando só existirem uma ou duas elegíveis. Na ausência de opções, explicar o motivo e negociar apenas condições flexíveis. Dados de avaliação e histórico ausentes não podem ser inventados. Explicações devem refletir fatores usados, não justificativas fabricadas depois da escolha.

### 8.2 Cinco modos com motor comum

| Modo aprovado | Intenção | Ajuste conceitual | Limites |
|---|---|---|---|
| **Decida por Mim** | Reduzir esforço de escolha | Equilibrar contexto, preferências e viabilidade; destacar recomendação principal | Não executar compra nem mutação sem aprovação |
| **Econômico** | Buscar menor gasto compatível | Dar maior peso ao custo total conhecido e expor componentes faltantes | Não prometer menor preço absoluto nem ignorar taxas |
| **Surpresa** | Explorar algo diferente | Favorecer novidade compatível com restrições e contexto | Aleatoriedade, se usada, ocorre apenas entre candidatos elegíveis |
| **Anti-repetição** | Variar escolhas recentes | Penalizar repetições conforme histórico autorizado ou contexto da sessão | Não presumir histórico privado de visitante |
| **Rápido** | Priorizar agilidade | Dar maior peso ao ETA informado e ao esforço de decisão | ETA é estimativa; sem garantia de entrega |

Os modos compartilham validação, filtros, cálculo, explicações e autorização. Não são cinco agentes com políticas contraditórias. Se modo e restrição entrarem em conflito, prevalece a restrição rígida; uma preferência flexível pode ser renegociada de maneira transparente.

### 8.3 Orçamento e negociação

Orçamento é opcional. Um teto duro impede recomendar como elegível uma proposta comprovadamente acima do total permitido. Um objetivo flexível permite apresentar uma opção acima do objetivo somente com explicação clara e aceite do consumidor para a flexibilização.

Quando frete, taxas ou total final forem desconhecidos, exibir subtotal conhecido, componentes pendentes e estimativas identificadas. Não afirmar “cabe no teto” sem base suficiente. Alergias nunca podem ser relaxadas pelo ranking ou por um modo. Uma alteração de condição rígida só pode vir de uma instrução explícita e inequívoca da pessoa; o sistema não deve induzir a relativização de risco alimentar.

## 9. Experiência, voz e acessibilidade

**[DECISÃO APROVADA]** Voz é primária, texto permanece sempre disponível. A voz pode comandar navegação, comparação, seleção, orçamento e carrinho. As mesmas confirmações de negócio valem para voz, texto e botões.

### 9.1 Estados e componentes essenciais

- Entrada por voz com estados visíveis: disponível, ouvindo, processando, respondendo e erro.
- Transcrição revisável antes de ações relevantes; correção textual disponível quando o reconhecimento divergir.
- Recomendações com nome, estabelecimento, motivo, custos conhecidos, ETA estimado e limitações relevantes.
- Comparação que mantém o contexto e evita leitura de listas longas por áudio.
- Resumo de carrinho com distinção entre proposta, preparação remota e continuidade no iFood.
- Confirmação explícita com descrição da ação, alvo e mudanças em relação à versão aprovada anteriormente.
- Controles de memória e autorização acessíveis na interface, não escondidos na conversa.
- Indicador inequívoco de modo real, mock ou parcialmente integrado.

### 9.2 Princípios de UX

Usar perguntas progressivas em vez de cadastro ou questionário obrigatório. Preservar o histórico útil da sessão, permitir voltar e corrigir e não repetir informações já confirmadas sem motivo. Proatividade acontece ao abrir o app, com rotina, horário, endereço e preferências disponíveis de forma autorizada; não inclui notificações externas no MVP.

Informar o endereço único em uso; para vários endereços, confirmar a seleção antes de ações dependentes de localização. Um pedido como “hoje estou no trabalho” tem validade contextual, não altera por si só o endereço preferido permanente.

### 9.3 Acessibilidade e tolerância a falhas

**[A VALIDAR — critério de implementação]** Verificar navegação por teclado, foco visível, rótulos de campos e botões, mensagens compreensíveis por leitores de tela, contraste legível e ausência de informação exclusiva por cor ou áudio. Oferecer texto equivalente ao conteúdo falado, controle de reprodução e alternativa quando microfone ou áudio estiverem indisponíveis.

Em ruído, sotaques ou reconhecimento incerto, pedir esclarecimento curto para campos críticos; não presumir quantidade, alergia, preço máximo ou aprovação. Interrupção avançada durante a fala pode ficar para fase posterior; parar reprodução e voltar ao texto deve ter comportamento previsível no recorte implementado.

## 10. Matriz de requisitos funcionais

**[DECISÃO APROVADA]** Os requisitos derivam das decisões; prioridades abaixo são recorte proposto, condicionado à auditoria. Estado de implementação de todos os itens: **a auditar**.

| ID | Requisito e comportamento observável | Decisões | Prioridade proposta |
|---|---|---|---|
| RF-01 | Atender restaurantes/refeições; manter supermercado fora do MVP | 1, 19 | P0 |
| RF-02 | Receber intenção por texto e preservar contexto da sessão | 3, 14, 16 | P0 |
| RF-03 | Oferecer voz e comandos de comparação, seleção, orçamento e carrinho | 3, 24, 31 | P1; pode compor P0 se viável |
| RF-04 | Permitir iniciar como visitante sem dados privados de conta | 13, 14 | P0 |
| RF-05 | Executar autorização antes de recursos protegidos e obter contexto MCP real relevante | 5, 13, 30, 37 | P0 |
| RF-06 | Apresentar até três recomendações iniciais, explicadas e refináveis | 9, 19 | P0 |
| RF-07 | Aplicar filtros rígidos antes de ranking contextual | 10, 11, 17, 26 | P0 |
| RF-08 | Disponibilizar os cinco modos com motor comum | 18 | P1; um modo consistente no P0 |
| RF-09 | Diferenciar teto duro e objetivo flexível e explicitar taxas/estimativas | 17 | P0 no fluxo escolhido |
| RF-10 | Negociar apenas restrições flexíveis de forma explícita | 11 | P0 para conflitos do fluxo |
| RF-11 | Montar proposta revisável de carrinho e exigir aprovação antes de adicionar remotamente | 4, 20 | P0 |
| RF-12 | Preferir um estabelecimento; múltiplos exigem autorização, suporte e aviso de custos | 21 | P0 como limite; expansão P2 |
| RF-13 | Tratar indisponibilidade e mudança material de preço sem substituir silenciosamente | 22 | P0 |
| RF-14 | Aplicar ordem de fallback de checkout e informar continuidade real disponível | 12 | P0 |
| RF-15 | Informar endereço único; confirmar entre vários; criar/alterar se suportado | 25 | P0 para seleção; mutação P1 |
| RF-16 | Coletar feedback por voz, texto e botões, incluindo motivos e favoritos | 28 | P1 |
| RF-17 | Manter memória híbrida consentida com visualização, edição, exclusão e desativação | 5, 15, 34, 35 | P1; sem persistência invisível no P0 |
| RF-18 | Confirmar preferências duradouras importantes e distinguir contexto temporal | 15, 25, 26 | P1; obrigatório se persistir |
| RF-19 | Sugerir contexto ao abrir o app, sem notificações externas | 27 | P1 |
| RF-20 | Consultar pedido por voz/texto somente com suporte MCP comprovado após checkout externo | 23 | P2 condicionado |
| RF-21 | Sinalizar mocks e distinguir integração parcial de fluxo real | 30 | P0 |
| RF-22 | Permitir cold start progressivo sem onboarding obrigatório | 16 | P0 |

## 11. Matriz de requisitos não funcionais

Os compromissos são de comportamento e verificação. Limites quantitativos de desempenho e custo precisam ser medidos e definidos; não foram aprovados números nesta proposta.

| ID | Requisito | Verificação esperada | Prioridade |
|---|---|---|---|
| RNF-01 | Isolar dados e autorizações por usuário | Testes negativos entre duas identidades; políticas RLS e autorização de servidor | P0 para qualquer dado persistido |
| RNF-02 | Não expor segredos em cliente, logs ou repositório | Inspeção de configuração, respostas e logs sanitizados | P0 |
| RNF-03 | Validar contratos e entradas nas fronteiras | Casos válidos, inválidos e respostas MCP incompletas | P0 |
| RNF-04 | Preservar controle humano em mutações | Testar ausência, ambiguidade, expiração e revogação de aprovação | P0 |
| RNF-05 | Falhar com clareza e preservar alternativa textual | Simular timeout, token expirado, falha de voz e indisponibilidade | P0 |
| RNF-06 | Manter cálculos, filtros e autorização determinísticos | Testes unitários e de integração com resultados conhecidos | P0 |
| RNF-07 | Registrar evidência sem dados desnecessários | Logs de operação, duração, ambiente e erro, com redação de dados sensíveis | P0 |
| RNF-08 | Medir latência por etapa e custo por sessão | Instrumentação de STT, LLM, MCP, ranking e TTS quando usados | P1; medição mínima P0 |
| RNF-09 | Prover acessibilidade básica de interação | Checklist de teclado, foco, rótulos e equivalência textual | P0 no fluxo entregue |
| RNF-10 | Reproduzir a execução local e validar ambiente público | Instruções sanitizadas, teste local e teste do deploy real | P0 |
| RNF-11 | Minimizar coleta e controlar retenção | Inventário de dados, finalidade, política de expiração e exclusão verificável | P0 se coletar |
| RNF-12 | Desacoplar provedores e contratos externos | Adaptadores para MCP, LLM, voz e persistência | P1; fronteiras mínimas P0 |

## 12. Arquitetura proposta e fluxo de execução

### 12.1 Decisões e escolhas ainda abertas

**[DECISÃO APROVADA]** Protótipo Next.js; LLM independente de provedor; componentes críticos determinísticos; voz prioritária via ElevenLabs com adaptador e alternativa Web Speech API no Chrome; Supabase/PostgreSQL para persistência; deploy público em Vercel ou equivalente, com execução local testada.

**[A VALIDAR]** A arquitetura efetivamente existente, versões do projeto, bibliotecas, contratos, ambientes, infraestrutura, mecanismos OAuth e viabilidade de provedores devem ser auditados. Os componentes abaixo são desenho lógico proposto, não descrição certificada do repositório.

| Camada lógica | Responsabilidade | Limite |
|---|---|---|
| Interface web | Voz/texto, recomendações, comparação, aprovações e controles | Não contém segredos nem decide autorização |
| API de aplicação | Identidade, sessão, validação, orquestração e respostas | Aplica políticas antes de chamar adaptadores |
| Orquestrador conversacional | Interpretar intenção e pedir esclarecimentos | Não autoriza compra nem inventa ferramentas |
| Domínio determinístico | Filtros, orçamento, ranking, estados e consentimento de ação | Fonte de decisão para guardrails críticos |
| Adaptador MCP | Descobrir/validar contratos e traduzir operações permitidas | Só executa capacidade existente e autorizada |
| Adaptadores LLM/voz | Trocar provedor sem alterar regras centrais | Falhas preservam alternativa textual |
| Persistência | Preferências, sessões, feedback, consentimentos e histórico permitido | Isolamento e retenção por finalidade |
| Observabilidade | Diagnóstico e evidência sanitizada | Sem tokens, segredos ou gravações desnecessárias |

### 12.2 Fluxograma textual

```text
Abrir site
  → visitante ou sessão identificada
  → voz/texto → intenção estruturada validada
  → precisa de dado protegido?
      sim → explicar finalidade → OAuth/autorização → validar escopo
      não → somente fontes permitidas
  → obter contexto e confirmar endereço aplicável
  → consulta permitida ao MCP, conforme contrato verificado
  → normalizar dados → filtros rígidos → ranking → até três opções
  → refinamento ou seleção
  → proposta local de carrinho → revisão explícita
  → há aprovação válida e operação remota suportada?
      sim → executar ação específica → verificar resultado
      não → manter proposta sem alegar carrinho remoto
  → checkout: handoff validado → ou link confirmado → ou resumo manual
  → compra final no iFood
  → tracking somente se verificável
  → feedback → memória somente com base e autorização aplicáveis
```

### 12.3 Estados e prevenção de execução indevida

Estados conceituais: `intenção`, `contexto_pendente`, `opções`, `proposta`, `aguardando_aprovação`, `ação_em_andamento`, `ação_confirmada`, `continuidade_externa`, `erro_recuperável`. São sugestões internas, não estados oficiais do MCP.

Uma aprovação deve se referir a uma versão concreta da proposta: itens, quantidades, estabelecimento, endereço aplicável e custo conhecido. **[A VALIDAR — desenho técnico]** Pode-se usar identificador ou hash da proposta e prazo de validade. Se a proposta mudar materialmente, a aprovação anterior não cobre a nova ação. Repetição de clique, retry ou resposta duplicada não deve causar adições duplicadas; usar idempotência quando suportada e verificar estado antes de repetir operações incertas.

## 13. MCP, OAuth, autorização e checkout

### 13.1 Conhecimento documental disponível

**[A VALIDAR]** Os elementos abaixo foram fornecidos como referências documentais. Não foram testados tecnicamente nesta tarefa e não substituem os schemas e permissões reais do ambiente.

| Referência conhecida | Informação fornecida | O que precisa ser confirmado |
|---|---|---|
| `getUser` | Níveis OAuth `BASIC`, `ADVANCED` e `BEHAVIOR` | Contrato, granularidade, campos retornados e escopos concedidos |
| `profileData.userBehaviorDescription` | Campo associado a `BEHAVIOR` | Presença, significado, atualização e uso permitido |
| `listAddresses` | Pode fornecer `topMerchantTypes`, `topWeekDayShift`, `ordersByMerchantTypeWeekdayAndShift` | Estrutura, disponibilidade por autorização e semântica dos dados |
| `createAddress` | Operação citada para criar endereço | Parâmetros, validações, escopos e necessidade de confirmação |
| Discovery, cart e tracking | Famílias de capacidade mencionadas | Nomes, assinaturas, limites, erros, efeitos e fluxos reais |
| `https://consumer-mcp.ifood.com.br/marketplace` | Endereço citado do MCP do consumidor | Transporte, autenticação e uso correto no repositório/documentação |

O endereço MCP citado não é necessariamente uma página navegável. Não interpretar falha de navegação como prova de indisponibilidade da API. Não deduzir ferramentas de carrinho ou pedidos a partir do nome do endpoint. **Este documento não inventa nomes ou assinaturas para discovery, cart, checkout ou tracking.**

### 13.2 Matriz de autorização

| Ação ou dado | Regra de produto | Dependência técnica |
|---|---|---|
| Conversar como visitante | Permitido com sessão efêmera e sem contexto privado | Fontes de catálogo permitidas precisam ser verificadas |
| Consultar perfil/comportamento | Somente após autorização correspondente e por finalidade informada | Escopos reais e campos disponíveis |
| Consultar endereços | Informar único; confirmar entre vários | Autorização e contrato de consulta |
| Criar ou alterar endereço | Confirmação explícita da ação e dos dados | Suporte real; alteração não é presumida por existir criação |
| Persistir preferências | Controles granulares e base legal apropriada | Identidade da aplicação, armazenamento e política |
| Adicionar item remotamente | Aprovação explícita anterior à chamada | Operação, escopos e resposta de sucesso verificáveis |
| Transferir carrinho | Só oferecer após validação ponta a ponta | Handoff realmente suportado |
| Consultar pedido externo | Somente se o MCP permitir localizar/obter o pedido | Relação entre checkout externo, identidade e consulta |

Login da aplicação, autorização OAuth do iFood e consentimento de memória são eventos distintos. Um não deve ser usado como autorização genérica para todos os demais. Pedir apenas o acesso necessário à função utilizada, respeitando o fluxo efetivamente permitido pela plataforma.

### 13.3 Protocolo de validação por operação

Antes de declarar qualquer integração pronta, registrar: ambiente, versão do contrato, escopos necessários, entrada sanitizada, saída validada, cenário de falha, efeito observado e limite conhecido. Fazer a validação autenticada sem divulgar credenciais. Para operações com efeito, obter autorização humana adequada e confirmar o resultado remoto.

O inventário deve classificar cada operação como: documentada; descoberta no ambiente; executada em teste; validada no fluxo; indisponível/bloqueada. Uma tool descoberta não prova que a conta consegue executá-la, e uma chamada bem-sucedida isolada não prova a jornada completa.

### 13.4 Fallback obrigatório de checkout

**[DECISÃO APROVADA]** A ordem é:

1. **Transferência de carrinho**, somente se suportada pelo MCP e validada no fluxo real. Informar o que será transferido e pedir as confirmações pertinentes.
2. **Link ou redirecionamento confirmado**, se a transferência não existir ou não funcionar. Verificar destino e explicar se o carrinho não acompanha a navegação.
3. **Resumo manual**, se nenhuma continuidade automática estiver comprovada. Exibir estabelecimento, itens, quantidades e custos conhecidos para a pessoa concluir no iFood.

Links não podem ser construídos por suposição sobre rotas ou deep links. Falha no handoff não autoriza fingir pedido ou carrinho concluído. Checkout externo não garante que o Guide receba confirmação de compra ou acesso ao pedido; qualquer tracking permanece condicionado.

### 13.5 Indisponibilidade, preço e múltiplos estabelecimentos

Itens indisponíveis e alterações materiais de preço exigem explicação, alternativas e confirmação antes de substituir. **[A VALIDAR]** Definir como detectar mudança material; na dúvida, renovar a revisão quando custo ou conteúdo da proposta mudarem. Não substituir automaticamente por item que comprometa alergia ou outra restrição.

Privilegiar um estabelecimento para simplificar entrega e custos. Múltiplos só se autorizados pelo consumidor e tecnicamente suportados, com aviso sobre possíveis entregas, fretes e totais separados. Não apresentar um conjunto multiloja como carrinho único sem comprovação.

## 14. IA, modelo e provedores de voz

### 14.1 Papel da IA

**[DECISÃO APROVADA]** A orquestração LLM será independente de provedor. O LLM pode interpretar intenção, extrair preferências candidatas, formular esclarecimentos e redigir respostas com dados verificados. Ranking, cálculos, filtros rígidos, autorização e guardrails críticos ficam em componentes determinísticos.

Saídas estruturadas devem ser validadas antes de qualquer ação. O LLM não pode transformar texto de catálogo, respostas externas ou instruções contidas em dados em permissão para executar ferramentas. Os adaptadores devem limitar as operações ao contrato permitido pela aplicação e pela autorização vigente.

**[DECISÃO APROVADA]** O modelo principal ainda não foi escolhido. A seleção ocorre após benchmarks rápidos de qualidade, tool calling, latência, custo e confiabilidade. Assinaturas de produtos de consumo não equivalem automaticamente a crédito ou acesso pago de API.

### 14.2 Benchmark de seleção

Usar o mesmo conjunto pequeno de casos para candidatos disponíveis: intenção simples, ambiguidade, orçamento com taxas ausentes, alergia, rejeição de recomendação, ferramenta indisponível e tentativa de executar sem aprovação. Registrar versão, parâmetros, latência observada, sucesso na estrutura esperada, erros de chamada e custo estimado a partir do uso efetivo e da tabela vigente consultada na implementação.

**[A VALIDAR]** Orçamento de API, credenciais e provedores disponíveis. Escolher pelo desempenho no fluxo e pelo limite de custo autorizado, sem adotar o modelo mais sofisticado por padrão. Um erro crítico de autorização ou filtro não pode ser compensado por uma boa média de linguagem.

### 14.3 Voz

**[DECISÃO APROVADA]** ElevenLabs é prioritário, com adaptador desacoplado. Verificar quais capacidades necessárias de reconhecimento e síntese estão disponíveis, limites de plano, idioma, latência, tratamento de dados e compatibilidade do navegador. Não presumir que um plano ou credencial habilita todos os recursos.

O fallback é Web Speech API no Chrome, condicionado à compatibilidade observada. Identificar ao usuário quando houver processamento por serviço externo e obter permissões pertinentes. A recusa de microfone ou falha da voz deve preservar texto. Áudio bruto não deve ser armazenado por padrão; eventual retenção exige finalidade e autorização específicas.

## 15. Dados, memória, Supabase e isolamento

### 15.1 Direção aprovada

**[DECISÃO APROVADA]** Supabase/PostgreSQL será a base para preferências, sessões, históricos, feedback e consentimentos. A memória é híbrida: contexto temporário de sessão e preferências persistentes controladas pelo usuário. A implementação e as tabelas reais devem ser auditadas; os esquemas abaixo são conceituais e não constituem migração pronta para produção.

| Entidade conceitual | Campos e finalidade sugeridos | Retenção e cuidado |
|---|---|---|
| `profiles` | Identidade interna, preferências de idioma e vínculo mínimo necessário | Evitar duplicar perfil completo do iFood |
| `sessions` | Dono, início, expiração, modo e contexto temporário mínimo | Expiração definida; visitante sem histórico persistente identificável |
| `preferences` | Dono, chave, valor, origem, escopo temporal, confirmação, atualização | Distinguir declarada, inferida e confirmada |
| `feedback` | Dono/sessão, alvo, gostei/não gostei/favorito, motivo opcional | Não inferir consentimento de persistência apenas do clique |
| `consents` | Dono, finalidade, versão do aviso, concessão/revogação e data | Registro auditável de mudanças de autorização |
| `interaction_history` | Resumo mínimo de intenção e resultado necessário à finalidade | Evitar transcrição integral por padrão |
| `cart_proposals` | Versão, itens/referências, valores conhecidos, pendências e estado | Não confundir com carrinho remoto ou pedido |
| `action_approvals` | Dono, proposta, ação específica, data e validade | Invalidar após mudança relevante |
| `integration_events` | Operação, ambiente, resultado, duração e erro sanitizado | Sem tokens, segredos ou payloads privados completos |

Esses nomes são sugestões da aplicação, não contratos de banco existentes. Endereços completos, descrições comportamentais e detalhes de pedidos só devem ser armazenados quando necessários e permitidos; preferir referências e resumos mínimos, respeitando termos aplicáveis.

### 15.2 Regras de memória

O feedback pode atualizar automaticamente a memória apenas dentro de uma autorização previamente compreendida e concedida. Preferências duradouras importantes — sobretudo restrições alimentares e mudanças relevantes de perfil — devem ser confirmadas antes de persistir. “Não gostei desse prato hoje” não implica “nunca recomendar essa culinária”.

A pessoa deve conseguir visualizar, editar, excluir e desabilitar a memória. Desativar memória não deve bloquear a conversa básica. Diferenciar revogar um consentimento de memória, apagar uma preferência e revogar acesso OAuth: são controles com efeitos distintos.

Contexto visitante permanece efêmero, com limpeza/expiração coerente no cliente e no servidor. A implementação não deve promover silenciosamente uma sessão visitante para histórico persistente após login. **[A VALIDAR]** Definir tratamento de importação opcional de contexto e a duração exata de cada retenção antes de coletar dados reais.

### 15.3 RLS e autorização

**[DECISÃO APROVADA]** Isolar usuários e aplicar RLS nas tabelas expostas por acesso de usuário. **[A VALIDAR — desenho]** Em tabelas com `user_id`, a leitura e mutação devem exigir correspondência com a identidade autenticada; inserções precisam impedir que o cliente escolha outro dono. Relações entre proposta, sessão e feedback também precisam validar o mesmo proprietário.

Requisições administrativas de servidor não podem usar privilégio elevado para contornar a identidade da pessoa sem verificação. Credenciais de serviço ficam fora do cliente. Identidade do usuário Supabase não é, por si só, prova de autorização da conta iFood.

Testes mínimos: usuário A não lê nem altera dados de B; visitante não acessa tabelas privadas; referência a proposta de outro usuário falha; exclusão e desativação produzem os efeitos anunciados; revogação impede novos usos da memória. Estratégias de backup e exclusão devem ser explicadas sem prometer eliminação instantânea de cópias cuja política não foi verificada.

## 16. Privacidade, segurança alimentar e ética

### 16.1 Privacidade por padrão

**[DECISÃO APROVADA]** A implementação deve observar LGPD, base legal apropriada, controles granulares, consentimento quando necessário, minimização, retenção definida, isolamento de usuário e acesso, edição e exclusão. Esta proposta é diretriz de produto; não certifica conformidade jurídica.

Antes de usar dados reais, registrar categorias, finalidade, fonte, base aplicável, destinatários, retenção e mecanismos de exercício de direitos. Não usar consentimento genérico como justificativa para toda operação. **[A VALIDAR]** Responsabilidades pelo tratamento, termos do MCP, uso de provedores, transferências e condições específicas de dados sensíveis devem ser analisados no contexto real.

Não registrar tokens OAuth, chaves de API ou segredos em logs, mensagens, exemplos ou commits. Sanitizar erros e telas de demonstração. Documentar renovação e revogação de credenciais conforme o contrato efetivo. Permissões devem ser verificadas em cada ambiente, sem reaproveitar implicitamente autorização de desenvolvimento em produção.

### 16.2 Segurança alimentar

**[DECISÃO APROVADA]** Detectar alergias e restrições declaradas, tratá-las como filtros rígidos e pedir consentimento apropriado para persistir. Falta de menção a ingrediente não prova ausência. Composição incompleta e risco de contaminação cruzada desconhecido devem ser explicitados, com orientação para confirmar com o restaurante.

Não classificar como seguro um prato cuja compatibilidade não pode ser verificada. Se não houver opções com informação suficiente, declarar a limitação; não reduzir o filtro para produzir uma recomendação. O Guide não oferece diagnóstico, aconselhamento clínico ou garantia alimentar. Uma opção “vegetariana”, por exemplo, não prova compatibilidade com toda alergia.

### 16.3 Ética de recomendação

Explicar os fatores que orientam a escolha e preservar a possibilidade de discordar. Não usar pressão, urgência falsa ou suposta aprovação do iFood para induzir compra. Não apresentar anúncios como recomendações neutras; qualquer eventual influência comercial futura precisaria ser identificada e avaliada separadamente.

Histórico e comportamento autorizado não devem gerar inferências desnecessárias sobre saúde, renda ou atributos sensíveis. Preços, avaliações e disponibilidade devem manter a origem e as limitações. Dados externos são entradas não confiáveis e não têm autoridade para modificar políticas do agente.

## 17. Modelo de negócio, operação e hipóteses

### 17.1 Modelo proposto

**[DECISÃO APROVADA]** O Guide é gratuito ao consumidor. O valor econômico esperado é indireto para o iFood, potencialmente em conversão, retenção, satisfação e recompra. Não foi aprovada cobrança por assinatura, comissão própria ou venda de dados pessoais.

**[HIPÓTESE]** Uma experiência com menos indecisão e recomendações mais relevantes pode gerar mais sessões bem-sucedidas e recorrência. Não há neste documento estimativa comprovada de receita, ganho percentual, tamanho de mercado ou retorno financeiro.

| Elemento | Proposta | Condição de validação |
|---|---|---|
| Beneficiário direto | Consumidor que decide e prepara uma compra | Testes de utilidade e clareza |
| Beneficiário econômico potencial | Plataforma iFood | Medição autorizada de resultados e interesse institucional |
| Distribuição no hackathon | Protótipo web acessível publicamente, quando pronto | Deploy, autorização e regras do evento |
| Distribuição futura | Possível integração nativa | Interesse, acordo e validação independentes |
| Receita direta | Não definida; consumidor gratuito | Eventual evolução exige nova decisão |
| Custos | LLM, voz, hospedagem, banco, observabilidade e suporte | Medir consumo e preços efetivos na implementação |

### 17.2 Operação

Para demonstrar: preparar ambiente e conta autorizada, verificar conexão, limpar dados desnecessários, testar o fluxo escolhido, identificar quais etapas são reais e manter alternativa textual e resumo manual. Definir quem conduz a demonstração e quem acompanha falhas somente depois do alinhamento com a equipe.

Para operação além do hackathon: seriam necessários monitoramento, gestão de incidentes, suporte, revisão de acessos, contratos de provedores, políticas de retenção e acompanhamento de qualidade. **[FUTURO/ROADMAP]** Essas rotinas não são declaradas existentes.

### 17.3 Sustentabilidade econômica

Medir custo variável por sessão concluída e por tentativa, incluindo sessões com falha. Calcular chamadas de modelo, minutos de voz, operações e infraestrutura conforme consumo e limites reais. Comparar custo com valor incremental apenas quando houver evidência de impacto atribuível. Não transformar preço de assinatura pessoal em custo zero de API.

## 18. Alternativas e posicionamento competitivo

Esta é uma comparação conceitual de caminhos disponíveis ao consumidor, não um levantamento atualizado de funcionalidades de concorrentes.

| Alternativa | O que pode atender | Hipótese de espaço para o Guide |
|---|---|---|
| Navegação tradicional no iFood | Busca, exploração e conclusão da compra no ambiente conhecido | Reduzir esforço de formular filtros e comparar opções por conversa |
| Escolher um favorito conhecido | Rapidez e previsibilidade | Apoiar variação contextual quando a pessoa deseja mudar |
| Perguntar a outras pessoas | Referência social e sugestões | Organizar contexto e disponibilidade permitida na própria sessão |
| Assistente conversacional genérico | Ideias e esclarecimento em linguagem natural | Conectar recomendações a contexto autorizado e contratos reais |
| Filtros ou listas mantidos manualmente | Controle e critérios explícitos | Reduzir reconstrução de preferências com memória consentida |

**[HIPÓTESE]** A combinação proposta pode ser útil; sua superioridade deve ser testada. Não afirmar que concorrentes não possuem voz, personalização, carrinho ou recursos específicos sem pesquisa contemporânea. O Guide é uma proposta de assistência ao ecossistema iFood, não substituto declarado de sua operação de pagamento e entrega.

## 19. Prioridades P0, P1 e P2

### 19.1 P0 — uma jornada íntegra

**[DECISÃO APROVADA]** Priorizar uma jornada por voz **ou** texto que demonstre autorização, contexto MCP real relevante, recomendação e proposta de carrinho. A integração real deve influenciar o fluxo de forma visível; não basta exibir um selo de conexão ou uma resposta isolada sem uso no produto.

Recorte proposto: entrada textual confiável; autorização e obtenção de contexto permitido; endereço quando necessário; uma intenção/mode de referência; até três opções explicadas com origem clara; restrições e orçamento do cenário; proposta de carrinho revisável; bloqueio de adição sem aprovação; fallback de continuidade; ambiente local testado e deploy público verificado.

Se parte do catálogo ou da proposta usar mock, sinalizar essa parte explicitamente e separar a evidência real. **Mocks não substituem a exigência de integração real relevante.** Se ela estiver bloqueada, registrar P0 incompleto e demonstrar apenas o que foi obtido, sem declarar atendimento integral.

### 19.2 P1 — ampliar utilidade após o núcleo

Voz prioritária, cinco modos completos, refinamento mais rico, feedback híbrido, favoritos, memória persistente consentida, controles de memória e proatividade contextual. Qualquer recurso implementado herda os requisitos de segurança, consentimento e testes, mesmo sendo P1.

### 19.3 P2 e roadmap

Tracking condicionado ao MCP, múltiplos estabelecimentos autorizados e suportados, interrupção avançada de voz, expansão de contextos e experimentos prolongados. Guide Market e integração nativa oficial permanecem roadmap sujeito a validação própria.

Prioridades não são atribuições pessoais. Após auditoria, o recorte pode ser ajustado à disponibilidade real sem apagar requisitos aprovados do documento.

## 20. Critérios de aceite e definição de pronto

| ID | Cenário verificável | Resultado esperado | Evidência mínima |
|---|---|---|---|
| AC-01 | Iniciar sem login | Conversar sem acessar dados privados; limites informados | Teste visitante e inspeção das chamadas |
| AC-02 | Solicitar contexto protegido | Autorização ocorre antes do acesso e corresponde à finalidade | Registro sanitizado do fluxo e resposta real |
| AC-03 | Executar jornada P0 | Contexto MCP real influencia recomendação/proposta | Demonstração reproduzível e operação identificada |
| AC-04 | Receber candidatos | Até três opções iniciais com explicações baseadas nos dados | Tela e fixtures/casos de verificação |
| AC-05 | Informar teto rígido | Não declarar elegível total acima do teto ou desconhecido como confirmado | Casos com taxas conhecidas e ausentes |
| AC-06 | Informar alergia | Filtro rígido e incerteza explícita; sem garantia falsa | Casos com composição incompleta e conflito |
| AC-07 | Pedir alternativa | Refinar condições flexíveis sem violar limites rígidos | Teste de diálogo e domínio |
| AC-08 | Selecionar carrinho sem aprovar | Nenhuma operação real de adição é chamada | Teste negativo e observação de chamadas |
| AC-09 | Aprovar proposta e mudar preço/item | Renovar revisão antes de substituição/mutação material | Teste de alteração após aprovação |
| AC-10 | Continuar compra | Usar handoff validado, ou link confirmado, ou resumo manual nessa ordem | Verificação do caminho efetivamente disponível |
| AC-11 | Usar endereços | Um é informado; vários exigem confirmação | Casos com zero, um e vários endereços |
| AC-12 | Falhar voz/provedor | Texto continua disponível, sem perder controle da ação | Teste com microfone negado e falha do serviço |
| AC-13 | Persistir memória, se habilitada | Consentimento e controles funcionam; isolamento entre usuários | Testes de RLS, edição, desativação e exclusão |
| AC-14 | Executar em ambiente público | OAuth/MCP e variáveis são válidos nesse ambiente | Teste específico do deploy, sem inferir do local |
| AC-15 | Apresentar solução | Real, mock, planejado e bloqueado aparecem corretamente | Checklist da demonstração e documentação |

Definição de pronto do P0: critérios aplicáveis ao recorte aprovados com evidências, limitações registradas, instruções reproduzíveis, segredos ausentes e dependências externas verificadas. Um teste que não foi executado deve constar como “não executado”, nunca como aprovado. Prontidão do protótipo não equivale a prontidão de produção.

## 21. Validação, experimentos e indicadores

### 21.1 Três frentes aprovadas

**[DECISÃO APROVADA]** Combinar validação técnica, testes com usuários e comparação com navegação tradicional. Medir tempo, interações, qualidade/relevância, satisfação e confiabilidade. Relatar apenas resultados efetivamente coletados.

1. **Técnica:** contratos, autorização, ranking, orçamento, alergias, estados, RLS quando aplicável, falhas de provedores e execução local/pública.
2. **Usabilidade:** observar pessoas realizando uma tarefa, sem ensinar cada clique; registrar entendimento, dificuldades e pontos de confiança ou desconforto.
3. **Comparação:** realizar tarefa equivalente no Guide e na navegação tradicional, com condições comparáveis e ordem alternada quando possível.

### 21.2 Plano experimental proposto

**[A VALIDAR]** Recrutamento, número de participantes, duração e instrumentos serão definidos conforme disponibilidade e regras do evento. Uma amostra pequena do hackathon produz indícios exploratórios, não prova representatividade da base do iFood.

Usar tarefas como escolher almoço com objetivo flexível, jantar com teto rígido, variar sem repetir e lidar com ingrediente não esclarecido. Não é necessário efetuar compra real para medir decisão e proposta; registrar o ponto de término de cada tarefa. Para comparação, manter intenção, endereço e orçamento equivalentes e reconhecer variações de catálogo/horário.

Registrar previamente a hipótese e o critério de sucesso de cada teste. Evitar selecionar apenas casos favoráveis. Anotar falhas, abandonos, ajuda recebida e indisponibilidades do ambiente. Obter autorização pertinente dos participantes e minimizar dados pessoais coletados.

### 21.3 Dicionário de métricas

| Indicador | Definição operacional proposta | Limite de interpretação |
|---|---|---|
| Tempo de decisão | Do início da tarefa à escolha confirmada | Não equivale ao tempo até entrega |
| Tempo até proposta | Do início à proposta revisável de carrinho | Separar espera de autorização e serviços |
| Interações | Turnos, cliques e correções com regra de contagem definida | Voz e texto exigem comparação cuidadosa |
| Relevância | Avaliação do participante sobre adequação à intenção | Relatar escala e pergunta usadas |
| Satisfação | Resposta pós-tarefa em escala definida antes do teste | Não extrapolar uma amostra pequena |
| Sucesso da jornada | Sessões que atingem o término definido / sessões iniciadas | Informar denominador e exclusões |
| Confiabilidade MCP | Operações válidas bem-sucedidas / tentativas válidas | Separar falha de autorização, contrato e serviço |
| Latência | Duração ponta a ponta e por etapa | Informar ambiente, amostra e dispersão |
| Respeito a restrições | Casos com comportamento correto / casos avaliados | Uma violação crítica exige correção, não só média |
| Custo por sessão | Custo observado de provedores e infraestrutura alocável | Distinguir estimativa de cobrança efetiva |
| Conversão | Compra confirmada / sessões elegíveis, se observável e permitido | Redirecionamento não comprova compra |
| Retenção/recompra | Retorno ou nova compra em janela definida | Exige estudo longitudinal e acesso autorizado |

Não há valores preenchidos porque esta proposta não executou os experimentos. Resultados futuros devem incluir data, versão, ambiente, método, quantidade de observações e limitações. Aumento de conversão ou retenção exige desenho de medição compatível; não pode ser inferido somente de opiniões positivas.

## 22. Riscos e mitigação

As classificações são qualitativas de planejamento, não probabilidades calculadas.

| Risco | Impacto | Mitigação e contingência | Validação pendente |
|---|---|---|---|
| OAuth ou MCP indisponível | Bloqueia parte essencial do P0 | Validar cedo; registrar erro sanitizado e limite; não substituir evidência real por mock | Conta, escopos e ambiente |
| Contrato de carrinho/handoff diferente do esperado | Impede continuidade automática | Aplicar ordem de fallback e separar proposta de mutação | Discovery e teste por operação |
| Restrição alimentar mal interpretada | Pode induzir escolha inadequada | Confirmação, filtro rígido e incerteza explícita | Casos críticos de domínio e conversa |
| Total incompleto ou preço alterado | Quebra confiança e orçamento | Componentes de custo claros e nova aprovação | Campos disponíveis e atualização |
| Ação duplicada ou sem consentimento | Efeito remoto indevido | Estado de aprovação, validação de versão e retries seguros | Suporte de idempotência/consulta |
| Vazamento entre usuários | Exposição de dados privados | RLS, autorização no servidor e testes negativos | Identidade e políticas reais |
| Voz incompatível ou lenta | Prejudica demonstração | Adaptador, teste no dispositivo e texto disponível | Plano, idioma e navegador |
| LLM inventa dados ou ferramentas | Recomendações e ações incorretas | Saída validada, domínio determinístico e dados com origem | Benchmark e testes adversariais |
| Prazo excedido por escopo | Jornada incompleta | Priorizar um fluxo, congelar escopo e registrar P1/P2 | Auditoria e estimativas do time |
| Deploy funciona sem OAuth/MCP | Demo pública falha | Testar callbacks e permissões no ambiente exato | Configuração pública |
| Métricas exageradas no pitch | Perda de credibilidade | Separar hipótese, resultado e roadmap | Revisão de cada afirmação |
| Atribuição prematura de tarefas | Duplicação e conflito | Auditar GitHub/Trello antes e confirmar disponibilidade | Decisão 39 |

## 23. Roadmap e cronograma do hackathon

### 23.1 Roadmap por evidência

| Etapa | Objetivo | Saída esperada | Condição de avanço |
|---|---|---|---|
| Auditoria inicial | Entender o que existe e o que falta | Matriz requisito × código × teste × card × evidência | Estado atual registrado |
| P0 | Demonstrar uma jornada íntegra | Fluxo real relevante com proposta e fallback | Critérios aplicáveis aprovados |
| P1 | Aumentar utilidade e qualidade | Voz, modos, feedback e memória conforme capacidade | Núcleo estável e controles funcionando |
| P2 | Expandir capacidades condicionais | Tracking, multiloja e interação avançada | Contratos e autorização comprovados |
| Market | Explorar supermercado | Pesquisa sobre lista, comparação e cesta | Nova validação de problema e integração |
| Integração nativa | Avaliar incorporação ao app oficial | Discussão institucional e desenho próprio | Interesse e aprovação formal, se houver |

### 23.2 Cronograma operacional proposto

**[A VALIDAR]** A janela abaixo é proposta de organização a partir de 17/10, não relato de atividades realizadas. Replanejar conforme horário real de início, disponibilidade e regras do evento, preservando o prazo de 18/10 às 12h30 BRT. Não criar tarefas com responsáveis antes da auditoria.

| Janela BRT | Foco | Marco verificável |
|---|---|---|
| 17/10, início da retomada | Auditar GitHub/Trello e validar dependência MCP | Inventário e bloqueios; recorte P0 aceito pelo time |
| 17/10, bloco seguinte | Implementar/integrar a jornada escolhida | Entrada → contexto autorizado → recomendação → proposta |
| 17/10, encerramento do bloco de desenvolvimento | Revisar integração e testar local | Evidência do fluxo e lista P1/P2 atualizada |
| 18/10, até 08h30 | Estabilizar ambiente público e fallback | Teste específico de OAuth/MCP no deploy |
| 18/10, 08h30–10h00 | Testes críticos e sessões de usuário viáveis | Achados e resultados reais documentados |
| 18/10, 10h00–11h00 | Congelar escopo e corrigir defeitos críticos | Versão candidata e limitações explícitas |
| 18/10, 11h00–12h00 | Ensaiar pitch e demonstração | Execução em cinco minutos e plano de contingência |
| 18/10, 12h00–12h30 | Conferir materiais e concluir envio | Entrega verificada antes do limite |

As horas intermediárias são metas de trabalho propostas. Se a retomada ocorrer mais tarde, reduzir funcionalidades adicionais, não remover autorização ou simular sucesso. O horário oficial e o mecanismo de submissão precisam ser confirmados com a organização.

## 24. Equipe, governança e auditoria anterior às tarefas

### 24.1 Equipe

**[DECISÃO APROVADA]** A equipe é formada por **Kenzo, Terossi, Malveste e Hyago**. Este documento não atribui especialidades, funções, liderança técnica, frontend, backend, IA, apresentação ou responsabilidade por entregas a qualquer integrante.

| Integrante | Participação confirmada | Frente, disponibilidade e responsabilidade |
|---|---|---|
| Kenzo | Membro da equipe | A confirmar após auditoria e alinhamento |
| Terossi | Membro da equipe | A confirmar após auditoria e alinhamento |
| Malveste | Membro da equipe | A confirmar após auditoria e alinhamento |
| Hyago | Membro da equipe | A confirmar após auditoria e alinhamento |

Registros históricos de coordenação ou revisão não substituem a definição de papéis desta etapa. Regras vigentes do repositório devem ser lidas na auditoria e qualquer conflito com o planejamento precisa ser explicitado antes de atribuições.

### 24.2 Auditoria obrigatória — decisão 39

O próximo trabalho no repositório deve:

1. Ler o `AGENTS.md` aplicável, README, documentação de produto, decisões, estado atual e guia MCP existentes.
2. Confirmar branch, HEAD, alterações locais, PRs abertos/mesclados e a referência histórica do commit/PR #4.
3. Inspecionar código e dependências para separar implementação real, mock, stub, documentação e intenção.
4. Executar verificações proporcionais disponíveis: instalação conforme lockfile, tipos, testes e build, sem presumir sucesso.
5. Inventariar OAuth, MCP, voz, LLM, memória, banco, guardrails e deploy por evidência reproduzível.
6. Ler quadro, listas e cards atuais do Trello; identificar duplicações, responsáveis já existentes, bloqueios e relação com PRs.
7. Cruzar as decisões 1–38 com arquivos, testes e cards: atendido, parcial, ausente, divergente, bloqueado ou não verificável.
8. Confirmar com a equipe disponibilidade e preferência para as frentes reais restantes.
9. Só então distribuir tarefas delimitadas com responsável aceito, dependências, aceite, evidência esperada e revisão.

Este documento **não executa essa auditoria nem altera GitHub ou Trello**. Seu papel é torná-la objetiva e impedir que atribuições partam de pressupostos.

### 24.3 Frentes candidatas, sem responsáveis atribuídos

Após auditoria, podem surgir frentes de integração/autorização MCP, experiência voz/texto, domínio/recomendação/carrinho, dados/consentimento, testes/deploy e demonstração/pitch. A divisão deve refletir o trabalho restante e a disponibilidade declarada, sem converter automaticamente quatro pessoas em quatro áreas técnicas fixas.

Cada card deve conter objetivo, escopo, exclusões, arquivos ou interfaces afetadas, dependências, critérios de aceite e evidência de conclusão. Evitar edição concorrente da mesma fronteira sem coordenação. Mudanças de contrato compartilhado devem ser alinhadas antes da integração.

### 24.4 Governança documental

Manter este arquivo como referência de produto. Registrar alterações aprovadas com data, decisão afetada, motivo e impacto. Separar o estado implementado em inventário/evidências atualizados; não apagar requisitos apenas porque ainda não foram desenvolvidos. PRs e cards devem referenciar os IDs RF/RNF/AC e decisões relevantes.

## 25. Demonstração, pitch e perguntas

### 25.1 Critérios da demonstração

- Mostrar uma necessidade concreta e o início por voz ou texto.
- Explicar qual autorização é solicitada e demonstrar contexto MCP real relevante.
- Exibir até três opções explicadas e pelo menos um refinamento contextual.
- Mostrar limites do cenário: orçamento, disponibilidade e restrições quando aplicáveis.
- Revisar a proposta e evidenciar aprovação antes de qualquer adição remota.
- Continuar pelo fallback efetivamente validado, sem alegar compra concluída por redirecionamento.
- Identificar mocks e capacidades pendentes no momento em que aparecem.
- Encerrar com evidências reais, limites e próximos passos.

Preparar cenário e dispositivo testados, conta autorizada e dados não sensíveis. Uma gravação de uma execução real anterior pode ser contingência, se permitida pelo evento e rotulada com data/versão; não deve ser apresentada como execução ao vivo. Um mock pode explicar a visão, mas não comprova integração.

### 25.2 Roteiro de pitch de cinco minutos

| Tempo | Conteúdo | Mensagem |
|---|---|---|
| 0:00–0:40 | Problema e situação de uso | Indecisão, fricção e contexto reconstruído |
| 0:40–1:10 | Proposta de valor | Conversar, comparar poucas opções e aprovar uma proposta |
| 1:10–3:10 | Demonstração central | Autorização/contexto real, recomendações, refinamento e carrinho |
| 3:10–3:50 | Como funciona e limites | MCP verificado, guardrails determinísticos, checkout no iFood |
| 3:50–4:30 | Negócio e validação | Gratuito ao consumidor; hipóteses e resultados realmente coletados |
| 4:30–5:00 | Fechamento | O que foi demonstrado, pendências e evolução possível |

Se a voz estiver pronta, usá-la sem comprometer o tempo; manter texto como alternativa. Não gastar a maior parte do pitch com arquitetura. A prova central é o comportamento útil e controlável.

### 25.3 Preparação para três minutos de perguntas

| Pergunta provável | Resposta a preparar com evidência |
|---|---|
| O que é real e o que é mock? | Lista por operação, ambiente e etapa da jornada |
| Vocês fazem a compra? | Compra final no iFood; explicar o fallback validado |
| Como lidam com alergias? | Filtro rígido, incerteza explícita e confirmação com restaurante |
| Como personalizam sem invadir privacidade? | Escopos, minimização e memória controlável |
| Qual modelo e por quê? | Resultado do benchmark; se não decidido, declarar pendência |
| Como monetiza? | Uso gratuito; valor indireto para plataforma como hipótese |
| Qual o ganho comprovado? | Somente métricas coletadas, com método e limites |
| Vai entrar no app oficial? | Visão futura condicionada a interesse e aprovação |
| Quem implementou cada parte? | Responder conforme atribuição e evidência posteriores à auditoria |

## 26. Bloqueios e próximos passos

### 26.1 Pontos sem confirmação nesta proposta

| Pendência | O que desbloqueia | Evidência necessária |
|---|---|---|
| Estado atual de GitHub/Trello | Planejamento e atribuições | Auditoria com revisão, data e cards atuais |
| Acesso MCP por operação | Jornada real P0 | OAuth, escopos e respostas verificadas |
| Discovery/catálogo | Recomendações reais de opções disponíveis | Contrato e consulta permitida |
| Carrinho/handoff | Preparação remota e continuidade automática | Operações e efeitos comprovados |
| Tracking externo | Acompanhamento após compra no iFood | Localização e consulta autorizada do pedido |
| Modelo LLM | Orquestração de produção do protótipo | Benchmark e limite de custo |
| Voz | Canal prioritário demonstrável | Plano, compatibilidade e testes |
| Supabase e políticas | Memória persistente | Schema, identidade, RLS, retenção e testes |
| Deploy e callbacks | Demonstração pública | Teste do ambiente público específico |
| Regras finais do evento | Submissão e apresentação | Regulamento vigente e instruções da organização |

### 26.2 Ordem recomendada

1. Entregar este documento ao Codex que trabalhará no repositório, preservando o conteúdo aprovado.
2. Auditar GitHub e Trello sem atribuir novas tarefas antecipadamente.
3. Validar as operações MCP necessárias ao menor fluxo real relevante.
4. Definir recorte P0 e responsáveis com a equipe a partir do trabalho restante.
5. Integrar, testar e registrar evidências do fluxo, com fallbacks honestos.
6. Executar experimentos viáveis e preencher apenas resultados reais.
7. Ensaiar demonstração/pitch, conferir submissão e entregar até o prazo informado.

## 27. Glossário

| Termo | Significado neste documento |
|---|---|
| MCP | Model Context Protocol; meio de integração cuja disponibilidade e contratos precisam ser verificados |
| OAuth | Fluxo de autorização para acesso delegado; não equivale a consentimento irrestrito |
| Escopo | Permissão específica de acesso/ação concedida no fluxo aplicável |
| LLM | Modelo de linguagem usado para interpretação e orquestração, sujeito a validação |
| STT / TTS | Conversão de fala em texto / texto em fala |
| Hard constraint | Restrição rígida aplicada antes do ranking |
| Preferência flexível | Objetivo negociável mediante transparência e instrução da pessoa |
| Cold start | Início sem histórico suficiente; atendido com perguntas progressivas |
| Ranking | Ordenação de candidatos elegíveis por critérios explícitos |
| Proposta de carrinho | Resumo local revisável; não prova existência de carrinho remoto |
| Handoff | Continuidade/transferência para outro ambiente, somente quando suportada e validada |
| Checkout | Etapa final de compra, realizada no iFood nesta proposta |
| ETA | Estimativa de tempo; não garantia de entrega |
| Mock | Dado ou comportamento simulado, que deve ser identificado |
| RLS | Row Level Security; controle de acesso por linha no banco |
| P0 / P1 / P2 | Núcleo prioritário / ampliação seguinte / evolução condicionada |
| JTBD | Job to be Done; necessidade contextual que motiva o uso |
| KPI | Indicador definido para acompanhar uma hipótese ou resultado |

## 28. Apêndice A — rastreabilidade das decisões 1–39

**Todas as decisões 1–38 abaixo são requisitos aprovados, não alegações de implementação.** A decisão 39 é processual e também deve ser cumprida. A redação consolida as decisões fornecidas para esta proposta; o estado técnico de cada uma depende da auditoria.

| Nº | Requisito aprovado | Referência e implicação |
|---|---|---|
| **1** | MVP de restaurantes/refeições. Supermercado e Guide Market ficam no roadmap, com comparação de mercados, lista e cesta. | §§6, 19, 23; RF-01. Não ampliar o MVP implicitamente. |
| **2** | Público-alvo consumidor iFood amplo. | §4. Personas são recortes hipotéticos, não restrições de público. |
| **3** | Voz primária e texto disponível. | §§7, 9, 14; RF-02/03. P0 pode usar um canal conforme D37. |
| **4** | Recomendar e preparar carrinho no Guide; compra final no iFood. | §§6, 7, 13; RF-11. Separar proposta, carrinho remoto e pedido. |
| **5** | Personalizar com dados autorizados via MCP, memória consentida, feedback e aprendizado de preferências; treinamento de modelo não é obrigatório. | §§8, 13, 15; RF-05/16/17. |
| **6** | Site protótipo Next.js; integração nativa iFood como visão futura. | §§2, 12, 23. Não alegar parceria ou aprovação. |
| **7** | Gratuito ao usuário; benefícios indiretos à plataforma como hipóteses. | §17. Não afirmar receita ou impacto comprovado. |
| **8** | Resolver indecisão, fricção e personalização insuficiente. | §§4–5. Validar frequência e intensidade dos problemas. |
| **9** | Até três recomendações iniciais dinâmicas, com explicações e refinamento contextual. | §§7–8; RF-06; AC-04. Não forçar quantidade sem candidatos elegíveis. |
| **10** | Ranking adaptativo com preferências, orçamento, ETA, avaliações, histórico e intenção; filtros rígidos prévios. | §8; RF-07. Dados ausentes não podem ser fabricados. |
| **11** | Negociar restrições flexíveis transparentemente; não flexibilizar hard constraints ou alergias sem autorização. | §§8, 16; RF-10. Alteração exige instrução explícita; não induzir risco. |
| **12** | Checkout: transferência somente se MCP suportar e validada; senão link/redirecionamento confirmado; senão resumo manual. | §13.4; RF-14; AC-10. |
| **13** | Login opcional; recursos protegidos apenas sob autorização. | §§6, 13; RF-04/05. Login, OAuth e memória são distintos. |
| **14** | Visitante usa voz/texto, dados efêmeros e nenhum dado privado sem login; catálogo público somente se autorizado. | §§6, 13, 15; RF-04. Não presumir catálogo anônimo. |
| **15** | Memória híbrida; feedback automático consentido; confirmar preferências duradouras importantes; visualizar, editar, excluir e desabilitar. | §15; RF-17/18; AC-13. |
| **16** | Cold start progressivo sem onboarding obrigatório. | §§7, 9; RF-22. Perguntar apenas o necessário à próxima etapa. |
| **17** | Orçamento opcional; teto duro versus objetivo flexível; transparência de taxas, frete e estimativas. | §8.3; RF-09; AC-05. |
| **18** | Cinco modos: Decida por Mim, Econômico, Surpresa, Anti-repetição e Rápido; motor comum. | §8.2; RF-08. Mesmos guardrails para todos. |
| **19** | Recomendar pratos e estabelecimentos segundo intenção. | §§6, 8; RF-01/06. |
| **20** | Sugerir carrinho e exigir aprovação explícita antes de operação real de adicionar. | §§7, 12–13; RF-11; AC-08/09. |
| **21** | Privilegiar um estabelecimento; múltiplos somente autorizados e tecnicamente suportados, com aviso de custos. | §13.5; RF-12. |
| **22** | Indisponibilidade e mudanças materiais de preço exigem explicação, alternativas e confirmação antes de substituir. | §13.5; RF-13; AC-09. |
| **23** | Tracking por voz/texto somente se o MCP permitir obter pedido mesmo após checkout externo. | §§6, 13; RF-20. Capacidade não confirmada. |
| **24** | Voz comanda UI, comparação/seleção, orçamento e carrinho; interrupção avançada pode ser posterior. | §9; RF-03. |
| **25** | Endereços contextuais e temporais; informar único, confirmar entre vários antes de proceder; alterar/criar se suportado. | §§7, 9, 13; RF-15; AC-11. |
| **26** | Detectar alergias/restrições, consentir persistência, aplicar filtros rígidos e não garantir composição/contaminação desconhecida; orientar confirmar com restaurante. | §16.2; RF-07/18; AC-06. |
| **27** | Proatividade contextual ao abrir o app com rotina, horário, endereço e preferências; sem notificações externas no MVP. | §9; RF-19. Só usar contexto permitido. |
| **28** | Feedback híbrido por voz/texto/botões gostei/não gostei/favoritos; interpretar motivos e aprender sob autorização. | §15; RF-16/17. |
| **29** | Validação técnica, testes com usuários e comparação com navegação tradicional; medir tempo, interações, qualidade/relevância, satisfação e confiabilidade; somente resultados reais. | §21. Nenhum resultado foi inventado nesta proposta. |
| **30** | Priorizar MCP real, validar por operação, sinalizar mocks e demonstrar ao menos integração real relevante sem fingir funcionamento. | §§13, 19–20; RF-21; AC-03/15. |
| **31** | ElevenLabs prioritário, adaptador desacoplado, fallback Web Speech API no Chrome e texto sempre disponível; verificar plano e compatibilidade. | §14.3; RF-03; AC-12. |
| **32** | Orquestração LLM independente de provedor; recomendações, cálculos e guardrails críticos determinísticos. | §§8, 12, 14; RNF-06/12. |
| **33** | Modelo principal ainda não escolhido; benchmark rápido de qualidade, tool calling, latência, custo e confiabilidade; separar assinatura de consumo de acesso pago à API. | §14.2. Não fixar modelo sem evidência. |
| **34** | Supabase/PostgreSQL para preferências, sessões, históricos, feedback e consentimentos. | §15. Schema conceitual não é implementação confirmada. |
| **35** | Privacidade por padrão, LGPD/base adequada, controles granulares, consentimento quando necessário, minimização, retenção, RLS/isolamento, acesso/edição/exclusão, registros de autorização e nenhum segredo em logs. | §§11, 15–16; RNF-01/02/07/11. |
| **36** | Deploy público Vercel ou equivalente, execução local testada e verificação OAuth/MCP em cada ambiente. | §§11–12, 20, 23; RNF-10; AC-14. |
| **37** | P0 de uma jornada demonstrável por voz OU texto, autorização/contexto MCP real, recomendação e proposta de carrinho; demais recursos em P1/P2 conforme disponibilidade. | §§19–20. Não exigir ambos os canais para validar o núcleo. |
| **38** | Equipe Kenzo, Terossi, Malveste e Hyago, sem papéis definidos. | §24.1. Não presumir competências ou atribuições. |
| **39** | Encerrar perguntas e preparar auditoria de código/GitHub e Trello antes de atribuir tarefas, usando as 38 decisões aprovadas. | §§24.2, 26. Processo obrigatório anterior à distribuição. |

## 29. Apêndice B — fontes, evidências e manutenção

### 29.1 Fontes usadas nesta consolidação

1. **Pedido de consolidação de 17/10/2026:** forneceu integralmente as decisões 1–39, escopo, dados do evento, histórico técnico e limites de afirmação. É a autoridade principal desta versão.
2. **Conversa de origem:** [Brainstorm Hackathon iFood](chatgpt-conversation://6ad3b565-063c-83e9-a1bb-b2655a178499), ID `6ad3b565-063c-83e9-a1bb-b2655a178499`. A leitura disponível confirmou mensagens de encerramento e referências, mas o conteúdo integral das respostas anteriores não foi recuperado; não é tratado como documentação técnica completa.
3. **Contexto persistente do projeto:** MOC “Hackathon iFood SEMCOMP” do Second Brain de Kenzo, consultado como histórico. Registros anteriores de repositório, Trello e MCP não foram reexecutados ou certificados nesta tarefa.
4. **Referências para futura auditoria:** [repositório privado](https://github.com/KenzoOsako/hackathon-ifood-semcomp), [PR #4](https://github.com/KenzoOsako/hackathon-ifood-semcomp/pull/4) e commit `6c1b414411fcbc8ffaa0832d2617fd3f03fa79bd`. São localizadores, não prova de estado atual.
5. **Referências MCP fornecidas:** `getUser`, níveis `BASIC`/`ADVANCED`/`BEHAVIOR`, `profileData.userBehaviorDescription`, `listAddresses`, campos comportamentais citados, `createAddress` e endpoint do consumidor. Contratos reais devem ser verificados no guia/repositório e ambiente autorizado.

### 29.2 Registro de evidências futuras

Para atualizar o estado, usar uma tabela separada com: requisito/decisão, revisão do código, ambiente, teste executado, resultado observado, link do PR/card/evidência, limite e data BRT. Não preencher resultados por inferência a partir de nomes de arquivos ou documentação aspiracional.

### 29.3 Histórico documental

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | 17/10/2026 | Proposta final completa e rastreável, baseada nas decisões encerradas, com hipóteses e pendências técnicas explícitas. Arquivo preparado para commit posterior; nenhuma mudança no repositório ou Trello nesta entrega. |

---

**Orientação de uso:** incorporar este arquivo posteriormente em `docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md`, após leitura das instruções aplicáveis do repositório. A primeira ação de execução continua sendo auditar GitHub e Trello, antes de atribuir tarefas. Este documento não autoriza compras, uso de dados sem permissão, publicação em produção ou alterações remotas por si só.
