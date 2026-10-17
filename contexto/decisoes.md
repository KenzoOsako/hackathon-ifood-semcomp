# Decisões (só acrescentar no fim)

## D-001 — Metodologia do time (17/10/2026)
- **Contexto:** 4 pessoas, 18h, evitar conflito de merge e alucinação dos agentes.
- **Decisão:** 3 construtores + 1 integrador (único que faz merge); PRs pequenos e mensuráveis; `AGENTS.md` na raiz (`CLAUDE.md` aponta para ele); pasta `contexto/` como memória.
- **Consequência:** o integrador devolve PR que quebra o projeto; regras de negócio só mudam por humanos.

## D-002 — Stack
- _Em aberto. Definir após o tema (14:00) e registrar aqui._

## D-003 — Trello: um card por PR (17/10/2026)
- **Contexto:** 4 pessoas em paralelo, integrador único.
- **Decisão:** listas A Desenvolver → Desenvolvendo → Em Revisão → Pronto; checklist por card; 1 card em andamento por pessoa; integrador move para Pronto.
- **Consequência:** padrão completo no `AGENTS.md`.

## D-004 — Conexão ao MCP do iFood (17/10/2026)
- **Decisão (proposta):** URL `https://consumer-mcp.ifood.com.br/marketplace`; redirect `http://localhost:8765/callback` igual para os 4 (localhost é local a cada máquina). Confirmar quando o agente for aprovado.

## D-005 — Direção do produto (PROPOSTA, 17/10/2026, aguardando aprovação do grupo)
- **Proposta:** copiloto de voz com personalização e recomendação explicada (nome provisório FoodPilot). Núcleo = voz, intenção, recomendação explicada, memória e contexto, ação segura via MCP, interface multimodal. Mercado e extras só se sobrar tempo.
- **Regra de proveniência proposta:** todo motivo falado pelo agente vem de um campo real do MCP.
- **Detalhes e cruzamento com o MCP:** `docs/produto-v1.md`.

## D-006 — Proposta final aprovada substitui o rascunho (17/10/2026)
- Fonte: documento fornecido pelo usuário, preservado integralmente em docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md.
- Decisões 1–38 são requisitos aprovados; D39 exige auditoria GitHub/Trello antes de atribuir tarefas.
- Supera o status aguardando aprovação de D-005 e o produto-v1 como orientação de produto. Não alega implementação nem altera o arquivo humano de regras.

## D-007 — Stack definida e limites do esqueleto (17/10/2026)
- D-002 foi resolvida pelo código integrado no PR #4: Next.js 16, React e TypeScript.
- Supabase/PostgreSQL e ElevenLabs são direções aprovadas ainda não implementadas; modelo LLM não escolhido. Não derivar direito de API de assinatura de produto.
- D-004 continua proposta de configuração: redirect, escopos e homologação exigem validação por ambiente.

## D-008 — Separar carrinho proposto, operação remota e compra (17/10/2026)
- Compra final no iFood; aprovação explícita antes de adicionar remotamente, vinculada à versão e invalidada por mudança material.
- Fallback: transferência validada, link confirmado ou resumo manual. submitOrder documentado no guia não é requisito para o FoodPilot.
- Fluxo atual de createCart/submitOrder é simulado e divergente. Não promovê-lo a integração real sem corrigir guardrails e contratos.

## D-009 — Reconciliação documental e segurança do template (17/10/2026)
- Auditoria versionada separa requisitos, código, testes e Trello; nenhuma nova responsabilidade atribuída.
- Removidos valores com formato de credenciais de .env.example. Se válidos, revogar/rotacionar; remoção do arquivo atual não remove exposição no histórico.
- Preparações não commitadas no checkout antigo preservadas; não fazem parte desta atualização.

## D-010 — Política provisória da proposta local/mock (17/10/2026)
- Contexto: FP-06 precisa retirar compra interna e identidade confiada ao cliente antes de ligar integração real.
- Implementação local: cookie opaco HttpOnly/SameSite Strict por 30 minutos absolutos, 1000 sessões máximas no processo; proposta de chat válida por cinco minutos. Mudanças são limitadas à demo mock; login/OAuth e escrita real continuam bloqueados.
- São parâmetros técnicos provisórios revisáveis, não nova regra humana de negócio. Alternativa de confiar em sessionId/explicit do body foi rejeitada por não vincular aprovação ao servidor. Sem custo completo, não aprovar; resumo local explicita pendências.
- Publicação exige resolver limite de visitantes anônimos, armazenamento entre instâncias e autorização real. Interface de Malveste só recebeu a correção pontual autorizada do efeito de rolagem. Integração descrita em docs/INTEGRACAO_PROPOSTA_LOCAL.md.

## D-011 — Direção V2: ocasião, contexto por voz e dados para o iFood (PROPOSTA, 17/10/2026 ~19h30, aguardando aceite do Kenzo)
- **Proposta:** manter o FoodPilot, mas passar de "escolher uma refeição" para "resolver uma ocasião" em várias verticais (restaurante e mercado no P0; shopping se o catálogo sustentar). Novo diferencial: (1) personalização por contexto rico gerado pela fala; (2) feedback estruturado e agregado útil ao iFood. Conversa com profundidade adaptativa (L0/L1/L2, no máximo 3 perguntas).
- **Substitui parcialmente:** decisões 1 e 19 da proposta canônica (restaurante apenas; supermercado fora do MVP) e o diferencial anterior (acessibilidade e facilidade).
- **Mantém:** não finalizar pedido, aprovação da versão da proposta, filtros rígidos, proveniência dos motivos, ownership de pastas.
- **Gate:** só entram as verticais que o MCP real sustentar no endereço da demo.
- **Detalhes:** `docs/DIRECAO_V2_OCASIAO.md`.

## D-012 — Papéis da V2 (PROPOSTA, 17/10/2026 ~19h45, aguardando aceite do time)
- **Funções:** Felipe = Conversação e Voz · Hyago = System Prompt e Fluxo de Agentes · Kenzo = Request e Dados · Malveste = Interface e Front-End.
- **Lacunas redistribuídas:** pitch e Entregável 01 (Felipe), Entregável 02 (Hyago), Entregáveis 05 e 06 (Kenzo), Entregáveis 03 e 04 (Malveste), integração/QA/deploy (Kenzo, com testes de cada dono).
- **Substitui, se aceita,** a distribuição de donos do plano anterior. Detalhes: `docs/PLANO_V2_PAPEIS_E_CRONOGRAMA.md`.

## D-013 — LangChain.js no adaptador de LLM (PROPOSTA, 17/10/2026 ~21h, Hyago)
- **Contexto:** a frente de agente (D-012) precisa de saída estruturada validada e de trocar de modelo rápido para o comparativo de provedores.
- **Decisão:** usar `@langchain/core` (1.x, compatível com Zod 4) + um pacote de provedor, com `withStructuredOutput`. Isolado em `src/agent/llm/` atrás de `LlmPort`; orquestrador não importa LangChain. **Sem LangGraph:** o grafo do turno é código próprio.
- **Alternativa rejeitada:** `fetch` direto na API (menos dependência, mas troca de provedor e parsing estruturado manuais).
- **Consequência:** dependência nova no `package.json`; validar `npm run build` no Next 16 ao instalar. Detalhes: `docs/BRIEFING_AGENTE.md` e `docs/PLANO_AGENTE.md`.
