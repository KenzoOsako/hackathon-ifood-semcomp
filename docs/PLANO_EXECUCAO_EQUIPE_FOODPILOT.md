# Guide — Plano de execução da equipe

> Plano operacional para **quatro desenvolvedores: Kenzo, Terossi, Malveste e Hyago**. Preparado em 17/10/2026, para entrega até **18/10/2026 às 12h30, America/Sao_Paulo (UTC−03:00)**. Destino sugerido: `docs/PLANO_EXECUCAO_EQUIPE_FOODPILOT.md`.
>
> Este arquivo distribui o trabalho restante. Não comprova implementação, homologação, merge, deploy ou conclusão de cards. Foi produzido como arquivo independente, sem editar o repositório ou o Trello. As atribuições abaixo são as combinadas no pedido atual; sua publicação e atualização nas ferramentas permanecem pendentes.

## 1. Objetivo, autoridade e ponto de partida

Entregar um protótipo Next.js que transforme uma intenção de refeição em até três recomendações explicadas e uma proposta de carrinho revisável, usando contexto real autorizado do MCP iFood. A compra é finalizada no iFood. **Não existe compra automatizada no Guide.**

Fontes de trabalho, nesta ordem de finalidade:

1. Pedido atual: define os quatro responsáveis, exclusividade de revisão/merge de Kenzo e recorte operacional deste plano.
2. [Proposta canônica de produto e negócio](PROPOSTA_DE_NEGOCIO_FOODPILOT.md): contém as **39 decisões encerradas**, RF, RNF e AC. Não reabrir as 39 perguntas. Adiar uma funcionalidade não revoga a decisão de produto.
3. [Auditoria de alinhamento de 17/10/2026](AUDITORIA-ALINHAMENTO-2026-10-17.md): fonte de status técnico no recorte auditado; base `main` em `0867abc`. [Versão consultada no GitHub](https://github.com/KenzoOsako/hackathon-ifood-semcomp/blob/feat/kenzo-contexto-proposta-final/docs/AUDITORIA-ALINHAMENTO-2026-10-17.md), blob `f71424547fc27ca11c244935370a3dbc36bff66d`.
4. `AGENTS.md`, regras humanas do repositório e `contexto/`: procedimentos e decisões aplicáveis. Divergências devem ser registradas e reconciliadas em PR; agentes não alteram regras de negócio humanas por conta própria.
5. [Guia MCP](mcp-ifood-referencia.md), schemas efetivamente descobertos e respostas autorizadas: contrato de integração a validar por operação e ambiente. Interface interna não equivale a API oficial.
6. [Quadro Trello](https://trello.com/b/ZcLDfKqU/hackathon-ifood): acompanhamento. A leitura de 17/10/2026 retornou 13 cards, oito em A Desenvolver, dois Desenvolvendo, nenhum Em Revisão e três Pronto; sem responsáveis/checklists estruturados nos cards retornados. Isso não atribui pessoas nem comprova entrega de produto.

A conversa de origem é [Brainstorm Hackathon iFood](https://chatgpt.com/c/6ad3b565-063c-83e9-a1bb-b2655a178499). O leitor do app retornou apenas mensagens finais e referências de conteúdo; as decisões foram recuperadas do Markdown canônico integral, não reconstruídas dessas referências.

### 1.1 O que a auditoria permite afirmar

| Área | Evidência no recorte auditado | Trabalho restante |
|---|---|---|
| Interface | Texto e cartões simulados | Fluxo integrado, confirmação, erros, acessibilidade e proveniência |
| Agente | Keywords, endereço fixo, sessões em Map | LLM desacoplado, contexto autorizado e estados seguros |
| MCP | Mock padrão; modo real lança erro | OAuth, operações reais, adaptação e prova de influência no ranking |
| Carrinho | Seleção chama `createCart`; `explicit=true` chama `submitOrder`, ambos simulados | Impedir conexão desse caminho a escrita real; proposta local, aprovação versionada e checkout externo |
| Ranking | Determinístico, fixtures, até três lojas | Restrições rígidas, total, incerteza e justificativas fiéis |
| Memória | RAM e consentimento local | Supabase/RLS e controles, quando habilitados |
| Voz e LLM | Ausentes no esqueleto auditado | Implementação por Terossi; texto continua funcional |
| Qualidade | Typecheck, lint, quatro testes e build reportados como aprovados na auditoria | Reexecutar na revisão integrada; esses resultados não validam OAuth, browser ou P0 |
| Entrega pública | Não comprovada | Deploy autorizado e testes específicos do ambiente |

Não foi executada nova auditoria de runtime, OAuth ou deploy nesta preparação. HEAD, PRs e disponibilidade externa devem ser conferidos no kickoff. Não tratar branches documentais como já mescladas.

## 2. Responsabilidades e poder de decisão

| Pessoa | Responsabilidade principal | Entrega e limite de autoridade |
|---|---|---|
| **Kenzo — Tech Lead e integrador, também desenvolvedor** | Integração final; contratos; regras críticas; segurança de carrinho; filtros e ranking determinísticos; QA integrado; revisão de todos os PRs | **Exclusivo na decisão de aprovação/rejeição e no merge de todos os PRs.** Não é proprietário do MCP. Coordena `src/agent/agent.ts` e fronteiras compartilhadas |
| **Terossi — voz e agente conversacional** | ElevenLabs, fallback Web Speech API, camada de voz, interpretação/diálogo LLM e adaptador independente de provedor | Voz é prioridade explícita da sua frente, desenvolvida em paralelo ao P0 textual. Não implementa autoridade transacional no prompt nem contorna os guardrails de Kenzo |
| **Malveste — Next.js UI/UX** | Interface, interações, exibição de recomendações, comparação/refinamento, confirmação visual, estados e acessibilidade | Dono da experiência e apresentação das recomendações; algoritmo de ranking e regras críticas pertencem a Kenzo. Não chama MCP diretamente pelo browser |
| **Hyago — integração e dados** | **MCP iFood real/OAuth**, backend de integração, adaptação de dados, Supabase PostgreSQL, identidade e RLS | Dono do MCP ponta a ponta, inclusive erros, schemas e callbacks por ambiente. Kenzo revisa contratos e segurança, mas não assume essa implementação |

**PR do próprio Kenzo:** exigir revisão independente por outro integrante que compreenda a área; Hyago para OAuth/dados/integração, Terossi para agente/voz, Malveste para UI/UX. Se o PR envolver guardrail crítico, o revisor precisa conferir o teste negativo e o efeito real. O autor não conta como revisor independente. A revisão independente é pré-condição; Kenzo mantém a decisão final e executa o merge. Se nenhum integrante puder revisar adequadamente, o PR aguarda ou é reduzido; urgência não autoriza autoaprovação.

Os demais podem revisar e recomendar ajustes, mas não substituir a decisão final de Kenzo. Quando a plataforma não permitir aprovação formal do próprio autor, usar a aprovação formal do revisor independente e registrar a decisão final de integração de Kenzo no PR, sem alegar autoaprovação formal. CODEOWNERS é roteamento de revisão, não prova de proteção de branch. Se o plano GitHub não impuser bloqueio, cumprir manualmente a mesma regra.

Cada dono responde pelo código, testes proporcionais, documentação de uso e evidências da sua frente. Todos os quatro desenvolvem; Kenzo não é apenas coordenador. Ajuda cruzada é permitida com tarefa delimitada e acordo prévio de arquivos.

## 3. Escopo executável e definição do núcleo

### 3.1 P0 — jornada textual real e segura

1. Visitante inicia por texto, sem onboarding obrigatório, sem acesso a dados privados e com sessão efêmera.
2. Quando a jornada precisar de contexto protegido, obter autorização apropriada antes da leitura. Login da aplicação, OAuth iFood, consentimento de memória e aprovação de carrinho são controles diferentes.
3. Buscar pelo menos um contexto MCP real relevante e permitido; mostrar **como ele altera efetivamente** seleção, ordenação ou explicação. Exemplo conceitual: preferência autorizada muda o peso do ranking, mantendo filtros rígidos. Um selo “conectado” ou resposta isolada não satisfaz P0.
4. Apresentar até três candidatos elegíveis, sem preencher vagas com itens inválidos. Informar origem real/mock por dado, preço conhecido ou estimado, frete/taxas desconhecidos, ETA quando disponível e razão verificável da recomendação.
5. Interpretar orçamento opcional, distinguir teto rígido de objetivo flexível, respeitar alergias e permitir refinamento mínimo por texto.
6. Produzir **proposta local de carrinho**, com itens, quantidades, estabelecimento, endereço aplicável, totais/estimativas, restrições, versão e pendências. Selecionar uma opção não cria carrinho remoto.
7. Exigir aprovação explícita da versão antes de qualquer adição real. Alterações materiais invalidam a aprovação. É válido concluir a demo com proposta local e resumo manual: a escrita remota não é necessária para comprovar o núcleo.
8. Continuar a compra no iFood: transferência apenas quando suportada e validada; senão link confirmado; senão resumo copiável. Não inventar deep link ou alegar carrinho transferido ao apenas abrir o app.
9. Demonstrar execução local testada e buscar deploy público validado, com contingência identificada. Falha de deploy deve constar como limitação, não como AC-14 aprovado.

**Não realizar operação real antes do controle aplicável:** acesso protegido exige autorização de acesso; persistência exige base/consentimento pertinente; adição remota exige também aprovação específica da proposta. OAuth não autoriza automaticamente adicionar itens. Permissão de microfone não autoriza compra. Nenhum caminho Guide deve submeter pedido, pagar ou finalizar compra, mesmo após aprovação do carrinho.

### 3.2 P1 — prioridade paralela de voz e ampliação

- **Terossi começa ElevenLabs no kickoff**, sem esperar o término do backend. Meta: entrada/saída por voz, transcrição visível e comandos que acionem os mesmos eventos da UI; fallback Web Speech API no Chrome quando suportado; texto sempre disponível. Falha de voz não bloqueia o aceite textual do P0 e deve ser declarada se a voz não estiver demonstrável.
- Cinco modos no mesmo motor: Decida por Mim, Econômico, Surpresa, Anti-repetição e Rápido. Começar pelo modo do cenário P0 e expandir sem duplicar guardrails.
- Feedback por texto/voz/botões, favoritos declarados, memória híbrida consentida, controles de visualizar/editar/excluir/desabilitar e confirmação de preferência duradoura.
- Supabase/PostgreSQL é a direção aprovada. Hyago prepara a frente desde o início; só habilitar persistência de dados pessoais com identidade, RLS e controles verificados. Se não ficar pronta, manter sessão efêmera e declarar persistência pendente.
- Refinamento contextual mais rico, abertura contextual do app sem notificações externas e experimentos exploratórios com consumidores.

P1 não significa dispensável nem cancelado: voz e banco têm donos e trabalho imediato, mas não podem bloquear o caminho textual seguro. Qualquer funcionalidade habilitada herda todos os requisitos de segurança aplicáveis.

### 3.3 P2 e fora do hackathon

Tracking após checkout externo somente com operação e vínculo de pedido comprovados; múltiplos estabelecimentos apenas se autorizados e suportados, com custos claros; interrupção avançada de fala; experimentos prolongados. Guide Market e integração nativa oficial são roadmap. Não prometer parceria, catálogo público anônimo ou capacidade transacional sem evidência.

## 4. Ownership de arquivos e prevenção de conflitos

Os caminhos já citados pela auditoria são existentes naquele recorte. Diretórios novos abaixo são **propostas de organização**, não afirmação de que já existem. Reutilizar a estrutura atual quando adequada; não refatorar tudo para cumprir esta tabela.

| Fronteira | Dono editor principal | Coordenação necessária |
|---|---|---|
| `src/mcp/**`, adaptador real, mocks e mapeamento | Hyago | Contrato interno revisado por Kenzo; schemas externos validados por Hyago |
| Rotas backend de OAuth/integração em `src/app/api/**` | Hyago | Separar arquivos das rotas de conversa; definir mapa exato no kickoff |
| `src/memory/**`, futuro `src/lib/supabase/**`, `supabase/**` | Hyago | Kenzo revisa identidade, RLS, retenção e acesso; Malveste consome controles |
| Futuro `src/voice/**`, `src/agent/llm/**`, prompts e interpretação | Terossi | Sem edição paralela do orquestrador central; tokens somente no servidor |
| `src/agent/agent.ts` | **Coordenação e edição integradora de Kenzo** | Terossi entrega interpretação/LLM em módulo separado; Hyago entrega portas MCP; patch direto só em janela combinada com Kenzo |
| `src/reco/**` e futuros módulos de domínio/carrinho | Kenzo | Malveste especifica necessidades de apresentação; Hyago fornece dados normalizados |
| `src/app/page.tsx`, layouts, estilos e componentes de UI | Malveste | Sem alterar rotas backend por abrangência do diretório `app` |
| Futuro `src/contracts/**` ou contratos compartilhados existentes | Kenzo | Cada fornecedor/consumidor revisa; mudança de campo entra antes dos consumidores |
| `package.json`, lockfile, config e `.env.example` | Kenzo coordena um editor por vez | Cada dono propõe suas dependências/variáveis sem valores; evitar lockfiles concorrentes |
| `docs/entregaveis/01-*`, `02-*`, `05-*`, plano e registro integrado | Kenzo | Recebe contribuições em arquivos próprios ou patches serializados |
| `docs/entregaveis/03-*`, evidências de `04-*` | Malveste | Terossi fornece decisões de voz |
| `contexto/feedback-mcp.md` e apêndices de integração | Hyago consolida | Todos contribuem; serializar edições para preservar registros |
| Pitch e evidências finais | Kenzo consolida | Malveste opera demo; Terossi voz; Hyago integração |

Testes ficam com o dono do módulo. Testes de fluxo integrado e scripts comuns ficam sob Kenzo. Nunca editar ao mesmo tempo `agent.ts`, lockfile ou o mesmo documento. Antes de tocar arquivo de outro dono: informar arquivo, motivo e janela, obter acordo e devolver o controle no PR. Isso coordena o time; não muda o requisito de revisão final.

## 5. Contratos entre componentes

### 5.1 Responsabilidades por fronteira

| Fronteira | Fornecedor → consumidor | Contrato mínimo / erro esperado |
|---|---|---|
| Entrada | Malveste/Terossi → agente Kenzo | Texto ou evento semântico, ID de interação, canal; transcrição nunca executa mutação diretamente |
| Interpretação | Terossi → domínio Kenzo | Intenção estruturada e incertezas; saída inválida pede esclarecimento; sem autoridade para afrouxar limite |
| Contexto | Hyago → ranking/agente | Dados normalizados, autorização, origem, atualização e campos ausentes; 401/expiração não viram mock silencioso |
| Ranking | Kenzo → UI/diálogo | Até três opções elegíveis, justificativas com evidência, custos/ETA conhecidos ou ausentes |
| Proposta | Kenzo → Malveste/Terossi | Snapshot versionado, pendências, total e ação permitida; selecionar e aprovar são eventos distintos |
| Aprovação | UI/voz → backend Kenzo | Proposta/versão, intenção inequívoca e identidade ligada à sessão; backend revalida tudo |
| Escrita opcional | Guardrail Kenzo → adaptador Hyago | Apenas operação permitida após validação; negar pedido/pagamento; falha ambígua exige reconciliação |
| Memória | Hyago → agente/UI | Efêmera ou persistente explícita; consentimento, identidade, leitura/edição/exclusão/desativação |
| Voz | Terossi → UI Malveste | Estados ouvindo/processando/falando/erro, transcrição e cancelamento; fallback preserva conversa |

**Os tipos abaixo são pseudocódigo interno de alinhamento. Não são APIs reais do iFood, ElevenLabs ou Supabase; nomes de tools, endpoints, scopes e campos externos serão obtidos dos contratos efetivos. Não copiar como integração pronta.**

```ts
type Origin = { mode: 'real' | 'mock'; source: string; observedAt: string };
type Money = { currency: 'BRL'; cents: number }; // inteiro; validar limites
type Cost = {
  items: Money;
  delivery?: Money;
  fees?: Money;
  total?: Money; // ausente se componentes necessários forem desconhecidos
  status: 'confirmed' | 'estimated' | 'unknown';
};
type Constraints = {
  budget?: { limit: Money; kind: 'hard' | 'flexible' };
  allergies: string[];
  missingCompositionPolicy: 'exclude-from-safe-claims';
};
type AuthorizedContext = {
  subjectRef: string; // referência opaca; nunca token
  authorizedPurposes: string[]; // conceito interno, não scopes oficiais
  origins: Origin[];
  preferences: Array<{ value: string; basis: 'declared' | 'observed' }>;
  addresses: Array<{ ref: string; label: string }>;
};
type Recommendation = {
  ref: string;
  merchantRef: string;
  cost: Cost;
  reasons: Array<{ text: string; evidenceRef: string }>;
  origins: Origin[];
  uncertainties: string[];
};
type CartProposal = {
  id: string;
  version: number;
  subjectRef: string;
  merchantRef: string;
  addressRef?: string;
  items: Array<{ ref: string; quantity: number; unitPrice: Money }>;
  cost: Cost;
  unresolved: string[];
  expiresAt: string; // validade definida na implementação, não inventada aqui
};
type ApprovalRequest = {
  proposalId: string;
  version: number;
  interactionId: string;
  channel: 'text' | 'voice' | 'button';
}; // subject e autorização são derivados no servidor, não confiados ao cliente
type PortFailure = {
  code: 'AUTH_REQUIRED' | 'EXPIRED' | 'UNAVAILABLE' | 'INVALID_DATA'
      | 'STALE_PROPOSAL' | 'NOT_SUPPORTED' | 'AMBIGUOUS_RESULT';
  retryable: boolean;
  correlationId: string;
};
```

Não mandar `AuthorizedContext` integral ao browser/LLM: expor apenas campos mínimos para a finalidade. Normalizar erros externos sem vazar conteúdo sensível. Validar payloads na borda, inclusive saída do LLM. Campos ausentes permanecem ausentes, não zero ou promessa de disponibilidade. Cada contrato precisa de um exemplo válido, um inválido, um erro e testes de fornecedor/consumidor.

### 5.2 Máquina de estados e guardrails

```text
conversa → contexto autorizado → recomendações → proposta local vN
                                              ↓ revisar/editar
                                        proposta local vN+1
                                              ↓ aprovação explícita
                                      revalidação no servidor
                                  ↙ falha/mudança     ↘ válida
                         nova revisão exigida       handoff externo
                                         ou adição remota opcional validada
                                               → checkout no iFood
```

- Leitura protegida ocorre somente após autorização; a sequência não impede visitante de conversar sem ela.
- Preço, frete/taxas, item, quantidade, estabelecimento, endereço, restrições ou disponibilidade materialmente alterados invalidam aprovação anterior. Proposta expirada também exige revisão.
- Backend liga aprovação a usuário/sessão, proposta e versão; ignora `explicit=true` como prova isolada. Um “sim” sem contexto inequívoco pede confirmação, especialmente por voz.
- Revalidar próximo da ação; serializar ações por proposta e evitar dupla execução por duplo clique/replay. Em timeout de escrita, não repetir às cegas: Hyago verifica se há leitura de reconciliação suportada; se não houver, informar resultado desconhecido e bloquear repetição automática.
- No P0, privilegiar um estabelecimento. Sem suporte confirmado, negar multiloja.
- Teto rígido usa total com encargos conhecidos. Total desconhecido não recebe selo “dentro do teto”; obter informação, excluir ou explicar impossibilidade antes de ação. Não negociar alergia como preferência flexível.
- Composição desconhecida não é “segura para alérgicos”. Não recomendar como compatível nem substituir ingrediente por inferência; explicar incerteza e orientar confirmação com restaurante.
- Histórico recente não prova “nunca pediu”; frequência não prova favorito declarado. Explicações devem usar o grau de evidência correto.
- Nunca fixar `addr-1`. Zero endereços: pedir caminho suportado; um: informar o usado; vários: pedir confirmação; alteração/criação somente se suportada, autorizada e aprovada.
- Proibir envio de pedido/pagamento pelo Guide em todas as rotas, ferramentas expostas ao LLM e testes. Código legado de `submitOrder` não pode ficar alcançável no fluxo real.

## 6. Matriz de tarefas executáveis

Criticidade: **B0** bloqueia segurança/liberação; **P0** integra o núcleo; **P1** amplia o protótipo; **E** é entrega documental/apresentação obrigatória no plano. Todos começam pendentes neste plano; evidências históricas não concluem estas tarefas. IDs `FP-*` são locais ao plano, não novos cards já criados.

| ID | Tarefa | Dono | Criticidade | Saída verificável | Dependências |
|---|---|---|---|---|---|
| FP-01 | Conferir base, PRs, contexto e mapa de arquivos | Kenzo | B0 | Registro de HEAD, árvore local, PR documental, fronteiras e fila | Kickoff |
| FP-02 | Congelar contratos mínimos e estados | Kenzo | B0 | Tipos internos, exemplos e testes de contrato revisados pelos três consumidores | FP-01 |
| FP-03 | OAuth e leitura MCP real | Hyago | P0 | Fluxo autorizado, tool/schema real e resposta sanitizada por ambiente | FP-02; cadastro/permissão externa |
| FP-04 | Normalizar contexto e capacidades reais | Hyago | P0 | Adaptador com origem, ausências, erros e matriz por operação | FP-03 |
| FP-05 | Filtros, total, ranking e razões | Kenzo | B0/P0 | Casos determinísticos, até três opções e mudança demonstrável por dado real | FP-02; fixtures; FP-04 para real |
| FP-06 | Proposta versionada e bloqueios transacionais | Kenzo | B0 | Testes de nenhuma escrita antes de aprovação, expiração e mudança; compra interna bloqueada | FP-02 |
| FP-07 | Conversa textual, cartões e confirmação visual | Malveste | P0 | Navegação integrada, editar/cancelar/aprovar separados, erros e rótulos real/mock | FP-02; FP-05/06 para integração |
| FP-08 | Adaptador LLM e diálogo | Terossi | P0 para agente planejado | Intenção validada, esclarecimento, erros controlados, sem tool transacional irrestrita | FP-02; acesso/cota de provedor |
| FP-09 | Benchmark curto de modelo | Terossi | P0 de decisão técnica | Comparativo qualidade/tool calling/latência/custo e recomendação revisada por Kenzo | Acesso aos candidatos viáveis |
| FP-10 | ElevenLabs, voz e fallback | Terossi | P1 prioritária paralela | Demonstração voz, transcrição e testes de falha Web Speech/texto | FP-02; permissões/cota; FP-07 para integrar |
| FP-11 | Continuidade externa sem compra interna | Hyago | P0 | Evidência do caminho suportado; link validado ou resumo manual | FP-03/04/06; Malveste liga UI |
| FP-12 | Supabase, identidade, RLS e memória | Hyago | P1; B0 se habilitar | Schema e políticas propostas; testes dois usuários, consentimento e exclusão | FP-02; ambiente aprovado |
| FP-13 | Controles de memória e feedback na UI | Malveste | P1; B0 se persistir | Visualizar/editar/excluir/desabilitar e confirmação duradoura | FP-12; contratos |
| FP-14 | Revisar segredos históricos e branch de uso | Kenzo | B0 | Parecer sem valores sensíveis; decisões de bloqueio e PR separado se autorizado | FP-01; Hyago apoia credenciais |
| FP-15 | Costurar `agent.ts` e jornada real | Kenzo | P0 | Caminho texto → contexto real → ranking → proposta → continuidade | FP-04/05/06/07/08/11 |
| FP-16 | QA integrado, falhas e evidências | Kenzo | B0/P0 | Matriz AC-01–15 com revisão, ambiente e resultados; testes de cada dono | FP-15; FP-10/12 quando ativos |
| FP-17 | Preparar e validar deploy | Kenzo | P0 de entrega | Config sem segredos, publicação após aprovação e teste OAuth/MCP público | FP-16; callbacks Hyago; autorização |
| FP-18 | Entregável 01 e alinhamento de negócio | Kenzo | E | Resumo de uma página coerente com canônico, revisado pelo time | FP-01; proposta canônica |
| FP-19 | Entregável 02: desenho da solução | Kenzo | E | Diagrama e texto correspondem ao fluxo realmente demonstrado | FP-02/15; insumos Hyago/Terossi |
| FP-20 | Entregáveis 03 e 04: UX e interface | Malveste | E | Racional e interface navegável com limitações identificadas | FP-07; decisões de voz FP-10 |
| FP-21 | Entregável 05: documento técnico | Kenzo | E | Arquitetura, operações reais, segurança e instrução reproduzível | FP-04/15/16; insumos de todos |
| FP-22 | Entregável 06: feedback MCP | Hyago | E | Registros reais, sanitizados, com expectativa/observação/impacto/sugestão | FP-03 em diante; todos contribuem |
| FP-23 | Testes exploratórios e comparação | Malveste | P1/E de evidência | Método, participantes reais autorizados, métricas e limitações | FP-15/16; disponibilidade |
| FP-24 | Pitch, contingência e submissão | Kenzo | E | Roteiro 5+3, dois ensaios e comprovante de envio humano | FP-18–22; FP-16; regras do evento |

FP-08 tem entrega planejada, mas falha do provedor deve degradar para diálogo textual limitado e declarado. Isso não permite afirmar que o agente LLM está pronto. Não atrasar guardrails para obter conversa mais natural. FP-17 sem publicação autorizada fica preparado e pendente; não apresentar URL não testada como entrega.

### 6.1 Primeira fatia independente de cada desenvolvedor

- **Kenzo:** FP-01/02/06; criar testes negativos antes de ligar MCP real. Em seguida FP-05 e integração FP-15.
- **Hyago:** FP-03/04, leitura mínima relevante; registrar capacidades e erros. Preparar FP-12 em paralelo sem habilitar persistência desprotegida.
- **Terossi:** FP-09/08 e protótipo ElevenLabs FP-10 desde o início, consumindo eventos de contrato; entregar módulo que Kenzo conecta ao orquestrador.
- **Malveste:** FP-07 com fixtures explicitamente rotuladas, estados de confirmação e erro; depois trocar a fonte pelo contrato real, sem recalcular regras na UI.

## 7. Cards Trello existentes e entregáveis

**Nenhum card foi alterado por este documento.** Links abaixo foram conferidos por leitura. Os donos indicados são o planejamento atual, não membros já atribuídos no Trello. Só atualizar descrições, membros, checklists, prazos e listas mediante aprovação de Kenzo/usuário; preservar histórico e não criar duplicatas silenciosamente.

| Card existente | Dono planejado | Trabalho e aceite operacional |
|---|---|---|
| [Infra MCP](https://trello.com/c/ymJqCQH3) | **Hyago** | FP-03/04/11. Substituir, após aprovação, critério antigo de “pedido de teste” por autorização, descoberta/leitura real relevante e influência no fluxo. Validar callbacks por ambiente; não presumir que o callback local citado serve ao deploy nem compartilhar secrets entre os quatro |
| [Entregável 01 — Proposta de Negócio](https://trello.com/c/ZdqcpGU8) | Kenzo | FP-18; `docs/entregaveis/01-proposta-de-negocio.md`, resumo de uma página; apontar ao canônico, sem duplicar 39 decisões |
| [Entregável 02 — Desenho de Solução](https://trello.com/c/TMOStZv1) | Kenzo | FP-19; `docs/entregaveis/02-desenho-de-solucao.md`, diagrama e fluxo, fronteiras e dados reais/mock |
| [Entregável 03 — Racional da Experiência](https://trello.com/c/6Qs17TQK) | Malveste | FP-20; `docs/entregaveis/03-racional-da-experiencia.md`, escolhas e motivos, voz/texto, acessibilidade e confirmação |
| [Entregável 04 — Interface Visual](https://trello.com/c/rqNuY7BG) | Malveste | FP-20; interface/protótipo navegável na demo; índice proposto `docs/entregaveis/04-interface-visual.md` com URL/revisão/capturas e limites. O card não exige esse nome de arquivo |
| [Entregável 05 — Documento Técnico](https://trello.com/c/qL6bpF7Q) | Kenzo | FP-21; `docs/entregaveis/05-documento-tecnico.md`; Hyago fornece MCP/dados/RLS, Terossi voz/LLM e Malveste interface |
| [Entregável 06 — Feedback sobre MCPs](https://trello.com/c/veh1QYkY) | Hyago consolida; todos contribuem | FP-22; `contexto/feedback-mcp.md`. Card pede ao menos dez observações concretas; coletar ocorrências reais, inclusive falhas. Isso não significa dez usuários nem resultados existentes. Se houver menos, registrar o número real e pendência |
| [Pitch — 5 min + 3 de perguntas](https://trello.com/c/HwUYmeZe) | Kenzo | FP-24; roteiro, demo ensaiada duas vezes e plano B. Malveste opera UI, Terossi verifica voz, Hyago verifica MCP; confirmar quem fala no kickoff |

O card [Dividir as tasks](https://trello.com/c/Z5QN9jIm) pode receber este plano como referência após aprovação. O título [retirar .env e gitignore](https://trello.com/c/xaPZMJ5e) é ambíguo e não autoriza remover `.gitignore`: manter proteção de segredos.

Fluxo a aplicar quando autorizado: **A Desenvolver → Desenvolvendo → Em Revisão → Pronto**. Mover para Em Revisão com PR e evidências; Pronto somente após aceite de Kenzo e integração quando aplicável. Documento final não implica recurso implementado; rascunho marcado Pronto não implica P0 pronto.

Modelo de observação MCP: ID, data/hora São Paulo, revisão, ambiente, operação/schema, expectativa, resultado observado sanitizado, impacto no usuário, contorno, sugestão e referência de evidência. Não colocar tokens, endereços completos ou respostas privadas brutas.

## 8. Percurso de integração e branches

1. Kenzo confirma a base e lê o PR documental de reconciliação antes de considerar suas mudanças disponíveis. A auditoria consultada está na branch `feat/kenzo-contexto-proposta-final`; não presumir merge do PR #5.
2. Integrar contrato mínimo e correção de guardrails primeiro, com testes e revisão independente nos PRs de Kenzo.
3. Hyago entrega leitura real isolada e adaptação; Kenzo integra ranking com proveniência. Malveste e Terossi podem trabalhar sobre fixtures do mesmo contrato até então.
4. Integrar o caminho textual completo, proposta e continuidade externa. Provar a influência do dado real antes de chamar P0 de real.
5. Integrar voz de Terossi usando os mesmos eventos e aprovações. Não criar fluxo transacional exclusivo da voz.
6. Integrar persistência apenas depois de identidade/RLS/controles. Se bloqueada, manter modo efêmero explícito.
7. Reexecutar QA na revisão candidata, preparar deploy, obter aprovação para publicação e testar o ambiente público. Só depois congelar demo e evidências finais.

Branches propostas, criadas a partir da base confirmada, uma entrega coesa por PR:

```text
feat/kenzo-contratos-guardrails
feat/kenzo-ranking-integracao
feat/hyago-mcp-oauth
feat/hyago-supabase-rls
feat/terossi-agente-llm
feat/terossi-voz-elevenlabs
feat/malveste-ui-fluxo
docs/<nome>-<entregavel>
fix/<nome>-<defeito>
```

Não fazer push direto na `main`, não mesclar o próprio PR sem revisão independente e não misturar endpoint de uso, dependências e voz num PR monolítico. Abrir PR pequeno assim que a fatia for revisável; dependências de outro PR devem estar explícitas. A sincronização ocorre após merges, sem sobrescrever mudanças locais; Kenzo resolve conflitos de contratos e registra a decisão. Não fazer force push em branch alheia ou reescrever histórico sem aprovação.

Kenzo organiza fila de revisão por: B0 → leitura MCP → fluxo textual → voz → persistência/ampliação → documentos finais. Reservar janelas regulares de revisão para não virar gargalo; enquanto aguarda, cada dono avança em teste/documentação independente.

## 9. Critérios de aceite e QA

Os IDs AC abaixo são os da proposta canônica. Evidência mínima por execução: revisão/commit, ambiente, data/hora, cenário, resultado, responsável, referência sanitizada e limitações. Estados permitidos: aprovado, falhou, bloqueado, não executado e não aplicável com justificativa. Marcar checkbox é resultado de teste, não intenção.

| AC | Teste de aceite | Responsável por evidência | Condição de liberação |
|---|---|---|---|
| AC-01 | Visitante conversa sem ler dados privados | Malveste + Hyago | Sessão isolada e limites visíveis |
| AC-02 | Contexto protegido exige OAuth/autorização; negar/revogar/expirar | Hyago | Sem dados privados ou escrita em falha |
| AC-03 | Dado MCP real muda recomendação | Hyago + Kenzo | Operação identificada; comparar mesmo cenário com/sem contexto autorizado |
| AC-04 | Até três opções e razões rastreáveis | Kenzo + Malveste | Não inventar avaliações, favoritos, histórico, estoque ou preço |
| AC-05 | Teto com frete/taxas conhecidos e desconhecidos | Kenzo | Não declarar total desconhecido dentro de teto rígido |
| AC-06 | Alergia, ingrediente incompatível e composição ausente | Kenzo | Filtro rígido, incerteza, sem garantia falsa |
| AC-07 | Refinar restrição flexível | Terossi + Kenzo | Não relaxar automaticamente limite rígido/alergia |
| AC-08 | Selecionar, editar e cancelar sem aprovar | Kenzo + Hyago | Contador/spy de mutações reais permanece zero |
| AC-09 | Aprovação antiga, expirada, replay e mudança material | Kenzo | Bloqueio no servidor; nova revisão/consentimento; sem dupla escrita |
| AC-10 | Continuidade externa | Hyago + Malveste | Caminho comprovado ou resumo manual; nenhuma finalização Guide |
| AC-11 | Zero, um, vários e mudança de endereço | Hyago + Malveste | Sem endereço fixo ou seleção silenciosa ambígua |
| AC-12 | Microfone negado, voz indisponível e falha de provedor | Terossi + Malveste | Texto e controle da proposta preservados; Chrome testado para Web Speech |
| AC-13 | Memória habilitada: dois usuários, consentimento e CRUD | Hyago + Malveste | RLS impede acesso cruzado; excluir/desabilitar funciona; se não ativa, registrar pendência |
| AC-14 | OAuth/MCP no deploy e execução local | Kenzo + Hyago | Evidências separadas por ambiente; local não prova público |
| AC-15 | Demo distingue real/mock/planejado/bloqueado | Todos; Kenzo aceita | Rótulos coerentes em tela, roteiro e documentos |

### 9.1 Checklist de cada PR

- [ ] Escopo, dono, FP, decisões e RF/RNF/AC relacionados identificados.
- [ ] Contrato alinhado; nenhum arquivo compartilhado alterado sem coordenação.
- [ ] Typecheck, lint, testes relevantes e build executados conforme scripts reais do repositório; falhas e não executados informados.
- [ ] Testes negativos proporcionais para autorização, carrinho, ranking, RLS ou falhas externas afetadas.
- [ ] Nenhum segredo em código, template, log, captura, fixture ou descrição do PR.
- [ ] Real/mock e capacidades ausentes explícitos; sem promessa de API não validada.
- [ ] Sem compra interna e sem escrita anterior à aprovação da versão.
- [ ] Documentação/evidências atualizadas; contingência e rollback definidos.
- [ ] Kenzo revisou a revisão exata; PR de Kenzo recebeu revisão independente.

### 9.2 Checklist de interface e voz

- [ ] Teclado, foco, labels, contraste e estados de carregamento/erro funcionam no dispositivo da demo.
- [ ] Recomendação, seleção e aprovação têm rótulos distintos; cancelar/editar acessíveis.
- [ ] Total estimado e campos desconhecidos aparecem também no resumo; origem de cada trecho é clara.
- [ ] Texto funciona antes de ativar microfone e após falha, sem duplicar envio ou perder proposta.
- [ ] Transcrição é visível; ambiguidade pede esclarecimento; voz não confirma sem contexto inequívoco.
- [ ] Comando por voz e clique passam pelo mesmo backend; resposta tardia de áudio não dispara ação antiga.
- [ ] Erro do LLM não fabrica recomendação/carrinho; entrada inválida não executa tools.

### 9.3 Checklist de MCP, dados e segurança

- [ ] Schemas reais confrontados com adaptador, campos opcionais e envelope de erro de cada operação.
- [ ] OAuth/callback, vínculo de usuário, expiração/revogação e erros testados no ambiente correto; segredo no servidor.
- [ ] `sessionId` fornecido pelo cliente não é tratado como autorização; visitante não herda conta de demo.
- [ ] Chamadas e logs são mínimos/sanitizados; nenhuma credencial ou endereço privado enviado ao LLM desnecessariamente.
- [ ] Persistência, se ativa, tem RLS e testes positivos/negativos de dois usuários em todas as tabelas expostas.
- [ ] Chave privilegiada de banco não vai ao cliente e não é usada para contornar isolamento sem verificação de identidade.
- [ ] Consentimento de memória, retenção e exclusão definidos; áudio não é persistido por padrão.
- [ ] Timeout, indisponibilidade, limite de provedor e resposta inválida causam erro controlado; sem mock silencioso.
- [ ] Escrita opcional só após guardrails; nenhuma tool de pedido/pagamento fica acessível ao agente.

### 9.4 Testes com pessoas e definição de pronto

Malveste conduz sessões curtas autorizadas, com cenário equivalente no Guide e na navegação tradicional quando viável. Registrar tempo até decisão/proposta, interações, relevância percebida, satisfação, erros/ajuda e método. Separar latência do provedor da interação. Alternar ordem quando possível e registrar amostra pequena/limitações. Não efetuar compra para medir decisão, inventar participantes ou transformar dez observações MCP em dez testes de usuário.

P0 só recebe “pronto” com fluxo textual íntegro, influência MCP real demonstrada, guardrails aprovados, continuidade honesta e evidências dos AC aplicáveis. Persistência e voz pendentes são declaradas separadamente. Falta de AC-03 significa **P0 real incompleto**, mesmo com demo mock convincente. Falta de AC-14 significa entrega pública pendente. Produto de hackathon não equivale a produção.

## 10. Template de PR para copiar

Este bloco é conteúdo sugerido; não altera `.github/` nesta entrega.

```markdown
## Problema e resultado
O que o usuário consegue fazer após esta mudança e qual limitação foi corrigida?

## Rastreabilidade
- Dono / branch / base e revisão:
- Card Trello e tarefas FP:
- Decisões / RF / RNF / AC:
- Dependências e PRs anteriores:

## Escopo e contratos
- Arquivos e fronteiras alterados:
- Contratos e consumidores afetados:
- Operações reais / mocks / partes ainda bloqueadas:
- Efeitos externos possíveis e controles de autorização:

## Validação
| Cenário ou verificação | Ambiente/revisão | Resultado | Evidência sanitizada |
|---|---|---|---|
| Preencher testes executados | | | |

- Não executado / bloqueado e motivo:
- Guardrail de nenhuma escrita antes de aprovação:
- Confirmação de ausência de compra interna:
- Falhas externas e fallback testados:

## Riscos e recuperação
- Limitações conhecidas:
- Como desabilitar/reverter sem apagar dados:
- Variáveis novas (somente nomes, nunca valores):
- Publicação, custo ou alteração externa que ainda exige aprovação:

## Revisão
- [ ] PR pronto para revisão de Kenzo; sem merge por outro integrante.
- [ ] Se autor Kenzo: revisão independente concluída por ___ na revisão ___.
- [ ] Evidências e documentos correspondem ao código desta revisão.
```

## 11. Segurança e branch paralela: ações condicionadas

### 11.1 Valores históricos em `.env.example`

A auditoria encontrou valores com formato de credenciais e relata remoção na revisão documental. **Validade não foi testada; exposição histórica continua sendo risco.** Limpar o arquivo atual não revoga um token nem remove o histórico. Não afirmar que a correção já está na `main` sem verificar o merge.

Kenzo conduz FP-14 com apoio de Hyago: identificar provedores afetados sem reproduzir valores; confirmar com os titulares se eram reais; propor revogação/rotação se necessário; manter apenas nomes e placeholders seguros no template. Guardar segredos no mecanismo restrito do ambiente. Não publicar `.env`, remover `.gitignore`, colar credenciais no Trello ou distribuí-las ao time sem autorização adequada. Revogação/rotação e eventual reescrita de histórico precisam da aprovação aplicável; esta entrega não as executa.

### 11.2 `feat/esqueleto-andante` e `/api/usage`

A auditoria registra branch não integrada em `c64eff2`, incluindo `60424be`, com medidor local de tokens/TTS/STT e endpoint `/api/usage` sem autenticação no código inspecionado. Isso é **estado da branch auditada**, não falha já comprovada na `main` ou em produção. Nenhuma chamada real de provedor foi demonstrada.

Antes de incorporar/publicar essa frente, em PR separado e aprovado por Kenzo:

1. Revalidar HEAD/diff e se o endpoint ainda existe; definir se é necessário para a demo.
2. Propor desabilitar a exposição pública ou exigir autenticação e autorização para os dados corretos, com teste negativo. Não confundir `sessionId` com controle de acesso.
3. Revisar armazenamento `.usage/`, sanitização e retenção; não expor consumo/dados de outra pessoa.
4. Instrumentar cada chamada se o medidor for usado; deixar claro que medição local não é fatura oficial nem limite atômico de requisições concorrentes.
5. Reconciliar colisão histórica de `D-006` e documentos de frentes, preservando decisões anteriores.
6. Registrar resultados, obter revisão e só então considerar merge/publicação. **Não importar automaticamente essa branch.**

A auditoria também relata cinco entradas high na cadeia de desenvolvimento ESLint. Kenzo registra triagem de compatibilidade/exposição; não aplicar troca automática de versão principal sem revisão e testes. Esta preparação não corrige nem revalida dependências.

## 12. Cronograma até 18/10/2026 12h30

Todos os horários são **America/Sao_Paulo**. Metas intermediárias são planejamento, não fatos concluídos. Documento preparado a partir de aproximadamente 17h50 de 17/10. Se começar depois, comprimir P1/P2 e documentação paralela, mantendo gates de segurança e honestidade. Confirmar no kickoff canal de submissão e instruções finais do evento; o limite de desenvolvimento de 12h30 foi informado e consta no card de pitch.

| Janela | Kenzo | Hyago | Terossi | Malveste | Gate / decisão |
|---|---|---|---|---|---|
| 17/10 18h00–18h30 | Kickoff, HEAD, contratos, fila | Acesso/escopos e operação mínima | Acesso LLM/ElevenLabs e adapter | Estados UI e cenário | G0: donos, base e fronteiras claros |
| 18h30–20h00 | Guardrails/proposta + ranking | OAuth/leitura e mapa de dados | Benchmark curto, diálogo e voz isolada | Fluxo textual com fixtures rotuladas | G1: contrato testável e nenhuma escrita insegura |
| 20h00–22h00 | Integrar primeira fatia real | Contexto normalizado + handoff viável | Agente integrado, ElevenLabs/fallback | UI ligada ao domínio, confirmação | G2: dado real influencia recomendação |
| 22h00–23h30 | QA P0 e fila de PRs | Erros OAuth, endereços e preparar RLS | Voz end-to-end e falhas | Acessibilidade e cenários negativos | G3: candidato textual seguro; voz com status explícito |
| 23h30–18/10 00h00 | Registrar checkpoint, docs e próximos | Evidências MCP e bloqueios | Estado voz/LLM e limites | Estado UI e roteiro de teste | Handoff escrito; combinar descanso/cobertura sem presumir plantão |
| 18/10 07h30–09h00 | Retomar revisão, preparar deploy | Callbacks públicos; banco só se seguro | Acabamento voz e contingência texto | Testes curtos e melhorias essenciais | G4: local e público avaliados separadamente |
| 09h00–10h00 | Integrar correções e documentos 01/02/05 | Consolidar feedback 06 | Evidências voz/LLM e custos observados | UX/04 e resultados reais | G5: funcionalidade e entregáveis coerentes |
| 10h00–11h00 | Congelar escopo; corrigir B0 | Apoiar somente defeitos do núcleo | Idem; parar features novas | Idem; consolidar demo | G6: release candidata, limites e plano B |
| 11h00–12h00 | Dois ensaios 5+3; checklist final | Saúde MCP e respostas técnicas | Voz e fallback ensaiados | Operar demo e tempo | G7: pitch cabe em 5 min, contingência testada |
| 12h00–12h20 | Conferir pacote, links e submissão | Apoiar verificação de dados | Apoiar material final | Conferir interface/capturas | Enviar antes do limite; guardar comprovante |
| 12h20–12h30 | Reserva para envio/checagem | Disponíveis para bloqueios | Disponíveis para bloqueios | Disponíveis para bloqueios | 12h30: encerramento, sem expansão de escopo |

Checkpoints: a cada 60–90 minutos durante trabalho ativo, mensagem curta de cada dono com **feito verificável / próximo / bloqueio / arquivos ocupados / PR**. Bloqueio crítico é comunicado assim que surgir, sem aguardar checkpoint. Kenzo registra mudança de plano e critério afetado.

## 13. Dependências, gatilhos de risco e contingência

| Dependência ou gatilho | Dono | Ação imediata / limite |
|---|---|---|
| Acesso MCP/cadastro não funciona em 30 min de investigação focada | Hyago | Registrar erro sanitizado, validar pré-requisitos e buscar suporte autorizado; UI/contratos continuam com mock explícito |
| Sem leitura real relevante até G2 | Hyago + Kenzo | Priorizar uma operação mínima autorizada; cortar P1/P2. Se persistir bloqueio, declarar P0 real incompleto; não substituir prova por fixtures |
| Dados reais não alteram resultado | Kenzo | Criar caso controlado comparável; revisar adaptação/pesos/explicação. Exibir conexão não fecha AC-03 |
| Catálogo incompleto ou não autorizado | Hyago | Não inventar endpoints/catálogo anônimo; rotular parcelas mock e contribuição real. Se não houver candidato verificável, explicar limite |
| Chamada de escrita aparece antes da aprovação | Kenzo | Bloquear integração/liberação imediatamente; teste negativo e correção antes de reconectar adaptador |
| Token suspeito em código/log ou isolamento falha | Kenzo + Hyago | Interromper exposição da frente, sanitizar evidências e propor contenção/rotação ao titular; não seguir com dado privado exposto |
| Total, endereço ou disponibilidade incertos | Kenzo + Hyago | Não aprovar com falsa certeza; pedir dado, mostrar pendência e usar proposta/resumo seguro |
| ElevenLabs sem acesso, cota, latência útil ou falha de microfone | Terossi | Web Speech quando compatível; depois texto. Registrar qual camada de entrada/saída falhou e manter a sessão |
| LLM instável ou custo/cota inviáveis | Terossi | Reduzir contexto/chamadas, validar resposta e usar diálogo textual limitado declarado; não trocar provedor sem avaliar acesso/custo |
| Persistência/RLS incompleta até G4 | Hyago | Não habilitar dados pessoais persistentes; manter memória efêmera explícita e declarar AC-13 pendente |
| OAuth local funciona e público falha | Hyago + Kenzo | Revalidar callback/ambiente; testar local como contingência; não afirmar AC-14 aprovado |
| Fila de PRs bloqueia equipe por um checkpoint | Kenzo | Revisar B0/P0 primeiro, reduzir tamanho dos PRs e suspender expansão; revisão independente permanece |
| Às 10h de 18/10 há recurso novo incompleto | Kenzo | Congelar feature, manter caminho estável e rótulo de pendência; não cortar guardrail |
| Feedback real menor que meta do card | Hyago | Relatar número real e limitação; não completar com experiências inventadas |
| MCP falha durante pitch | Hyago + Malveste | Informar indisponibilidade; usar execução real gravada identificada, se permitida, ou mock identificado; nunca chamar contingência de integração ao vivo |

### 13.1 Escada de fallback honesto

1. **Real ao vivo:** operações autorizadas validadas; registrar revisão/ambiente e proveniência.
2. **Parcial real:** identificar exatamente dados reais e simulados; explicar qual dado real influencia a recomendação. Não alegar disponibilidade/preço real de fixture.
3. **Replay/gravação real:** mostrar data, revisão e que não é execução ao vivo; usar somente se permitido e sem dados privados expostos.
4. **Mock demonstrativo:** rótulo persistente em UI/roteiro; sem escrita real e sem alegar P0 real concluído.

Fallback de compra é independente: transferência comprovada → link comprovado → resumo manual. A última alternativa continua útil e não depende de chamar tool de pedido. Nunca fazer fallback silencioso de real para mock após um erro OAuth.

## 14. Pitch de cinco minutos e perguntas de três minutos

| Tempo | Conteúdo | Condução proposta |
|---|---|---|
| 0:00–0:40 | Problema: indecisão, fricção e contexto perdido | Kenzo |
| 0:40–1:10 | Guide, público amplo, gratuito e valor esperado | Kenzo; benefícios como hipótese |
| 1:10–3:10 | Demo: texto/voz, contexto real, até três opções, refinamento, proposta e confirmação | Malveste opera; Kenzo narra; Terossi/Hyago apoiam |
| 3:10–3:50 | MCP e guardrails; compra final no iFood | Kenzo; Hyago disponível |
| 3:50–4:30 | O que foi validado e limites reais; negócio | Kenzo, somente métricas coletadas |
| 4:30–5:00 | Resultado demonstrado, pendências e próximo passo | Kenzo |

Confirmar no kickoff o porta-voz; esta distribuição é operacional proposta, sem presumir habilidade individual. Nos três minutos de perguntas: Kenzo responde arquitetura/segurança/integração; Hyago MCP/OAuth/dados; Terossi voz/LLM/benchmark; Malveste experiência/testes. Responder de forma curta, apoiada em evidências, sem transformar Q&A em outra apresentação.

Preparar respostas: o que é real/mock; como dado real muda a recomendação; por que não há compra automatizada; alergias e composição desconhecida; controle de memória; modelo escolhido e evidência; custo medido versus fatura; fallback e limites do deploy. Se a voz falhar, mudar imediatamente para texto e declarar. Não desperdiçar a demo inteira tentando recuperar um provedor.

Dois ensaios obrigatórios no plano: primeiro fluxo normal; segundo com falha MCP ou voz e plano B. Cronometrar cinco minutos completos e reservar três para perguntas. Preparar aba, conta autorizada, dispositivo, tela limpa, versão candidata e material sem segredos. Submissão deve seguir a regra do evento; este documento não envia nada.

## 15. Kickoff: começar sem reabrir decisões

**Duração proposta: 30 minutos.** O encontro resolve execução e disponibilidade, não refaz as 39 perguntas de produto.

1. **0–5 min — Kenzo:** apresentar objetivo P0, limite de 12h30, papéis, exclusividade de merge e revisão independente em PR próprio; ler os bloqueios da auditoria.
2. **5–10 min — todos:** confirmar disponibilidade, HEAD/base/PRs e arquivos já em edição; preservar trabalho local. Conferir instruções do repositório e eventual Graphify existente somente quando necessário para impacto estrutural; código continua fonte de verdade.
3. **10–15 min — Hyago:** informar acesso real disponível, operação mínima, ambiente/callback e bloqueios. Não expor secrets; combinar evidência sanitizada e matriz de capacidades.
4. **15–20 min — Kenzo com os três:** fixar contrato mínimo e cenário da primeira fatia; definir arquivos exatos de rotas e editor de `agent.ts`/lockfile. Não bloquear todo o time esperando refinamento completo do contrato.
5. **20–25 min — Terossi/Malveste:** alinhar eventos UI/voz, confirmação e fallback; iniciar voz prioritária e UI textual em paralelo. Escolher candidatos de LLM apenas entre APIs efetivamente acessíveis, com benchmark curto e custo autorizado.
6. **25–30 min — Kenzo:** confirmar primeira tarefa de cada dono, checkpoint e revisão; registrar quem revisará seu primeiro PR, porta-voz e submissão. Atualizações em Trello/repositório só após aprovação, sem presumir que publicar este arquivo autoriza toda ação externa.

Após o kickoff, cada pessoa consegue iniciar pela §6.1 com arquivos, contrato, aceite e evidência definidos. Se algo externo estiver bloqueado, desenvolver contrato/teste/fixture explicitamente mock e registrar a dependência; não fingir progresso real.

## 16. Rastreabilidade das 39 decisões sem novo questionário

Esta tabela é um índice operacional. A redação integral e os requisitos aprovados permanecem na proposta canônica. P1/P2 é sequenciamento, não revogação. D38 tinha papéis pendentes; a atribuição explícita atual os define após a auditoria D39.

| Decisão | Aplicação neste plano | Dono principal / tarefas |
|---|---|---|
| D01 | Restaurantes/refeições; Market no roadmap | Kenzo / FP-18 |
| D02 | Público amplo; persona não restringe acesso | Malveste / FP-20 |
| D03 | Voz primária na visão; texto sempre; núcleo textual | Terossi / FP-10; Malveste FP-07 |
| D04 | Proposta no Guide, compra no iFood | Kenzo / FP-06; Hyago FP-11 |
| D05 | Personalização autorizada, memória e feedback | Hyago / FP-04/12; Kenzo FP-05 |
| D06 | Next.js; nativo futuro | Malveste / FP-07; Kenzo FP-17 |
| D07 | Gratuito; benefício comercial hipotético | Kenzo / FP-18/24 |
| D08 | Indecisão, fricção e personalização a validar | Malveste / FP-23 |
| D09 | Até três opções explicadas/refináveis | Kenzo / FP-05; Malveste FP-07 |
| D10 | Ranking adaptativo e filtros rígidos prévios | Kenzo / FP-05 |
| D11 | Negociação flexível transparente | Terossi / FP-08; Kenzo FP-05 |
| D12 | Handoff condicionado; link ou resumo | Hyago / FP-11 |
| D13 | Login opcional, acesso protegido autorizado | Hyago / FP-03; Malveste FP-07 |
| D14 | Visitante efêmero sem dado privado | Hyago / FP-04; Malveste FP-07 |
| D15 | Memória híbrida e controles | Hyago / FP-12; Malveste FP-13 |
| D16 | Cold start progressivo | Terossi / FP-08; Malveste FP-07 |
| D17 | Orçamento opcional, total e estimativas | Kenzo / FP-05/06 |
| D18 | Cinco modos, mesmo motor | Kenzo / FP-05, expansão P1 |
| D19 | Pratos e estabelecimentos conforme intenção | Kenzo / FP-05; Malveste FP-07 |
| D20 | Aprovação antes de adição real | Kenzo / FP-06; Hyago FP-11 |
| D21 | Um estabelecimento; multiloja condicional | Kenzo / FP-06, P2 |
| D22 | Mudança material exige nova confirmação | Kenzo / FP-06; Hyago FP-04 |
| D23 | Tracking só se MCP permitir | Hyago / capacidade P2 |
| D24 | Voz opera os mesmos controles da UI | Terossi / FP-10 |
| D25 | Endereços contextuais e confirmação | Hyago / FP-04; Malveste FP-07 |
| D26 | Alergia rígida e incerteza explícita | Kenzo / FP-05; Hyago FP-04 |
| D27 | Proatividade ao abrir, sem notificação externa | Terossi + Malveste / P1 |
| D28 | Feedback híbrido e aprendizado autorizado | Malveste / FP-13; Hyago FP-12 |
| D29 | Teste técnico/usuários/comparação, só resultados reais | Kenzo FP-16; Malveste FP-23 |
| D30 | MCP real relevante e mocks transparentes | Hyago FP-03/04; Kenzo FP-15 |
| D31 | ElevenLabs, Web Speech, texto | Terossi / FP-10 |
| D32 | LLM desacoplado; domínio determinístico | Terossi FP-08; Kenzo FP-05/06 |
| D33 | Modelo via benchmark e acesso/custo de API | Terossi / FP-09 |
| D34 | Supabase/PostgreSQL | Hyago / FP-12 |
| D35 | Privacidade, isolamento, retenção e controles | Hyago FP-12; Kenzo FP-14/16 |
| D36 | Público e local; OAuth/MCP por ambiente | Kenzo FP-17; Hyago FP-03 |
| D37 | P0 real por texto ou voz; aqui texto confiável | Kenzo / FP-15/16 |
| D38 | Quatro membros, agora com ownership explícito | Todos / §§2, 4 e 6 |
| D39 | Auditoria antes da atribuição, perguntas encerradas | Auditoria consultada; kickoff revalida estado, sem novo questionário |

## 17. Registro de conclusão e próximos passos

Antes de marcar marco concluído, preencher:

| Campo | Conteúdo a registrar |
|---|---|
| Revisão e ambiente | Commit, branch, local/público; data/hora São Paulo |
| Aceite | AC executados, resultado e evidência |
| Real / mock | Operações e dados efetivamente usados |
| PR e card | Links exatos e revisão aprovada por Kenzo |
| Revisão independente | Obrigatória se autor Kenzo; pessoa e revisão |
| Limites e bloqueios | O que não foi executado ou não funciona |
| Recuperação | Como voltar à versão estável/desabilitar a frente |
| Próximo dono e ação | Trabalho delimitado e dependência |

Estado de saída deste documento: **plano preparado para revisão e commit posterior; produto não revalidado nesta tarefa; repositório e Trello sem alterações**. Primeiro passo é realizar o kickoff, confirmar a base e começar as quatro fatias independentes. Qualquer atualização de regras, cards, credenciais, merge, publicação ou ação externa condicionada deve seguir a aprovação aplicável; este arquivo não é uma autorização genérica para executá-las.
