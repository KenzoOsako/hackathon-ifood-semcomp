# Estado atual — 17/10/2026

Base auditada: main 0867abc; esqueleto no PR #4 / 6c1b414. Esta atualização reconcilia documentação e limpa o template; não implementa a proposta inteira.

## Decisões e fontes
[Proposta final](../docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md): decisões 1–39 aprovadas, sem resultados experimentais inventados.
[Auditoria](../docs/AUDITORIA-ALINHAMENTO-2026-10-17.md): matriz completa de 39 decisões, 22 RF, 12 RNF e 15 AC, evidências e lacunas.
Stack definida: Next.js 16, React e TypeScript. Kenzo integra/revisa; Terossi, Malveste e Hyago compõem o time. Novas frentes ainda sem atribuição.

## Existe na main
Texto, parser de palavras-chave, ranking determinístico, fixtures, carrinho/pedido/status simulados e memória RAM. Guia técnico documenta 24 ferramentas; isso não prova autenticação nem disponibilidade real.
MCP_MODE=real lança erro. Voz, LLM, OAuth, Supabase/RLS, feedback completo e deploy público não comprovados/implementados.

## Divergências prioritárias
Compra aprovada termina no iFood, mas mock usa submitOrder. createCart acontece antes de aprovação. Faltam vínculo de versão/revalidação, total com taxas, filtros rígidos de alergia e seleção de endereço real.
Não conectar escritas reais antes de corrigir contratos e guardrails. Próximo P0 precisa de contexto MCP real relevante; mock sozinho não satisfaz D37.

## GitHub/Trello e limites
Trello lido: 13 cards (8 A Desenvolver, 2 Desenvolvendo, 0 Em Revisão, 3 Pronto). Nenhum card alterado ou nova tarefa atribuída.
Branch remota feat/esqueleto-andante em c64eff2 possui medidor de consumo ainda fora da main; não incorporado automaticamente. Preparações locais antigas não commitadas foram preservadas.
Arquivo humano regras-de-negocio.md intacto e ainda incompleto; formalização humana pendente.
Valores com formato de credenciais removidos de .env.example. Se eram válidos, exigem revogação/rotação; histórico Git não foi reescrito.
Sem nova compra, autenticação MCP, deploy, teste de usuários ou alteração de produção nesta auditoria.

## Próximo
Equipe revisa auditoria, valida operações MCP e define recorte P0/responsáveis antes da distribuição. Revisão/merge deste PR pelo integrador. Testes e limitações registrados na seção de validação da auditoria.

## Verificações desta revisão
Proposta byte a byte preservada; 39 decisões/22 RF/12 RNF/15 AC e links conferidos. Lint e quatro testes passaram. Typecheck recebeu geração prévia dos tipos do Next após falha em checkout limpo; resultado final e build na auditoria. npm audit aponta 5 entradas high na cadeia ESLint, pendentes de revisão de compatibilidade.
- Resultado final: typecheck, lint, quatro testes e build passaram. Nenhuma validação externa MCP/checkout decorre desses resultados.

## Plano operacional publicado — 17/10/2026
- PR #5 integrado na main em 88e72d1. Novo documento fornecido pelo usuário: docs/PLANO_EXECUCAO_EQUIPE_FOODPILOT.md, preservado integralmente.
- O plano define 24 tarefas: Kenzo integração/contratos/guardrails/ranking/revisão e merge; Terossi voz/LLM; Malveste UI/UX; Hyago MCP/OAuth/dados. Supera o status histórico de atribuições pendentes; tarefas não estão executadas por sua publicação.
- Esta atualização somente publica o Markdown e seu link de entrada. Não altera Trello, runtime ou regras humanas; não executa as tarefas do plano.

## Direção V2 e reorganização do repositório — 17/10/2026, ~20h
- **Proposta, aguardando aceite do integrador:** `docs/DIRECAO_V2_OCASIAO.md` (D-011) e `docs/PLANO_V2_PAPEIS_E_CRONOGRAMA.md` (D-012). Índice dos documentos em `docs/INDEX.md`.
- **Funções propostas:** Felipe (Conversação e Voz), Hyago (System Prompt e Fluxo de Agentes), Kenzo (Request e Dados), Malveste (Interface e Front-End).
- **Trello:** 8 cards novos (OCS-01 a 04, INS-01/02, UX-01, DEMO-01) e comentários em 5 cards antigos. Donos nos títulos ainda seguem o plano anterior; renomear só após o aceite.
- **Repositório:** README, AGENTS.md, `docs/frentes.md`, contexto e pastas novas com README (`src/voice`, `src/prompts`, `src/evals`, `src/domain`, `src/data`, `src/ui`) e esqueletos dos entregáveis 02 a 06. **Nenhum código de runtime foi alterado.**
- **Pendente:** gate das verticais (21h), contratos de Ocasião, Necessidade e Plano (21h30), provedor de LLM e dono da chave, endereço da demo, regra de revisão de PR (CODEOWNERS), medidor de consumo (ainda na branch `feat/esqueleto-andante`).
- **Segurança:** valores com formato de credencial permanecem no histórico Git; revogar/rotacionar antes de tornar o repositório público.

## Plano de implementação de Kenzo — 17/10/2026
- Base remota consultada: origin/main e85cd2b, merge do PR #6. Plano local em docs/PLANO_IMPLEMENTACAO_KENZO.md organiza as 12 tarefas de Kenzo, com contratos e guardrails antes da integração real.
- FP-01 segue parcial: base e código conferidos; fila de PRs/cards, coordenação com colegas e baseline ainda pendentes. Nenhuma FP de implementação concluída nesta documentação.
- Próximo: concluir FP-01, preparar FP-02 e revisão independente. Sem alteração de runtime, Trello, deploy ou regras humanas.

## FP-02 — contratos mínimos, fatia 1 (17/10/2026)
- Branch feat/kenzo-contratos-minimos, base e85cd2b; plano local anterior preservado. Consulta gh pr list retornou zero PRs abertos nesta execução; Trello/coordenação e aceite dos consumidores ainda pendentes, FP-01 parcial.
- Contratos aditivos em src/contracts/proposal.ts: centavos seguros, custo com ausências explícitas, restrições, snapshot versionado, pedido de aprovação sem identidade do cliente e erros normalizados. Exemplos/testes e limites em src/contracts/README.md.
- Validação final: typecheck, lint, 18 testes e build passaram; git diff --check sem erros. Nenhuma rota foi conectada ao novo contrato; guardrails de servidor continuam pendentes na FP-06. FP-02 parcial, aguardando demais fronteiras e revisão.
- Recuperados HEAD e referência da branch com bytes nulos após interrupção: base exata confirmada no reflog, cópias preservadas fora do repo em work/evidence/git-recovery-contracts. git status voltou a funcionar, alterações locais preservadas.

## FP-02 — intenção, contexto e resposta pública (17/10/2026)
- Contratos aditivos em src/contracts/recommendation.ts e proposal-state.ts: intenção sem execução transacional, propósitos autorizados internos, origem real/mock, razões ligadas a evidências, projeção pública mínima e grafo de estados. Formato validado não prova autorização, atualidade nem veracidade; domínio e adaptadores precisam validar essas condições.
- Trello lido: KEN-01 (https://trello.com/c/WJYltPQt) em Desenvolvendo. Nenhum card alterado nesta implementação. FP-01 ainda depende de coordenação/aceite humano das fronteiras.
- Revisor independente temporário encontrou duas inconsistências de aprovação no schema público; corrigidas com validação cruzada de estado/snapshot e invariantes de subtotal/pendências, cobertas por testes negativos diretos.
- Validação final: typecheck, lint, 25 testes e build passaram após correções; git diff --check sem erros. FP-02 aguarda revisão dos consumidores e migração; rotas legadas não alteradas. Próximo: alinhar os contratos com Hyago/Terossi/Malveste e implementar guardrails de servidor na FP-06.

## FP-06 — domínio de proposta local (17/10/2026)
- src/agent/proposals.ts implementa criação, revisão, edição com nova versão, cancelamento e aprovação vinculada a sujeito/versão/interação, com validade e cópias defensivas. Não recebe cliente MCP nem executa operação remota. Identidade deve vir de sessão de servidor validada na integração futura.
- Armazenamento efêmero com capacidade configurada; libera registros cancelados/vencidos ao atingir limite. Aprovação atômica só na instância local; múltiplas instâncias e execução remota continuam bloqueadas até coordenação transacional apropriada.
- Revisão independente de segurança apontou retenção de capacidade e sobrescrita de estado terminal; corrigidas. Testes cobrem sessão alheia, versão, replay, expiração exata, cancelamento, remoção de endereço e capacidade.
- FP-06 parcial: rotas/identidade real, remoção do alcance legado de submitOrder e revalidação externa ainda pendentes. Nenhuma escrita real habilitada. Validação final: typecheck, lint, 35 testes, build e git diff --check passaram. Revisor confirmou as correções por leitura. Alterações locais sem publicação.

## FP-06 — rotas e jornada mock integradas (17/10/2026)
- Supera as pendências locais de rotas/alcance legado acima: chat/confirm usam sessão opaca emitida pelo servidor, aprovação por sujeito/versão e operações serializadas por visitante. sessionId legado é ignorado para identidade; explicit=true não aprova. JSON limitado, origem validada e erros sanitizados sem cache.
- O agente não chama createCart, submitOrder ou trackOrder; order responde 410. Busca/refinamento cancela proposta antes de I/O; troca de endereço descarta opções anteriores. Sem OAuth/MCP real; o modo real falha fechado. Seleção exibe proposta local; taxas ausentes deixam total desconhecido e bloqueiam aprovação.
- Políticas locais e integração para Malveste/Hyago em docs/INTEGRACAO_PROPOSTA_LOCAL.md. Única edição em page.tsx: efeito de rolagem sem retorno, expressamente autorizado pelo usuário após erro de cleanup React no navegador; layout intacto.
- Validação final: typecheck, lint, 49 testes em oito arquivos, build e diff passaram. Smoke HTTP servido passou em localhost e 127.0.0.1; navegador confirmou busca → seleção → proposta pendente → cancelamento. Aprovação positiva testada apenas com fixture completa no servidor, sem operação remota. Captura fora do checkout: work/evidence/fp06-proposta-local.png.
- Revisor security não confirmou bypass nos limites revisados; risco de esgotamento de sessões anônimas é pendência antes de deploy público. Persistência entre instâncias, identidade/OAuth, dados completos/revalidação MCP e aceite humano continuam pendentes; FP-06/P0 real não concluídos. Contraste do tema escuro observado na captura segue para UI. Nenhum commit, PR, Trello, compra ou deploy nesta fatia.

## Preparação de PR — FP-02/FP-06 (17/10/2026)
- Usuário solicitou publicação do PR para realizar o merge pessoalmente. Reconfirmada origin/main em e85cd2b e nenhuma outra PR aberta na consulta; branch feat/kenzo-contratos-minimos.
- Entrega coesa: contratos e proposta local necessários para retirar compra interna do fluxo textual mock. Card: https://trello.com/c/WJYltPQt (KEN-01). A proposta não fecha FP-05 nem P0 real; aceite humano/consumidores e merge seguem pendentes.
- Validações e limites na seção anterior e em docs/INTEGRACAO_PROPOSTA_LOCAL.md. Preparação em commits separados para contratos, domínio, rotas e documentação; nenhuma alteração em src/mcp, src/reco ou regras humanas.

## PR de implementação aberto — 17/10/2026
- PR #7: https://github.com/KenzoOsako/hackathon-ifood-semcomp/pull/7, branch feat/kenzo-contratos-minimos → main e85cd2b. Aberto para revisão/merge do usuário, sem conflitos na consulta; nenhum merge executado por este chat.
- Revisão independente de e85cd2b..0a2e1f38205450860ddba4fea34befc2132ec99e não encontrou regressão acionável adicional; revisão por leitura, distinta do aceite humano. Typecheck/lint/49 testes/build passaram no código publicado. Commit posterior acrescenta apenas este registro documental.
- Card KEN-01 vinculado ao PR; revisão dos consumidores e limites pré-deploy permanecem pendentes. Nenhum check de CI foi retornado pelo GitHub; resultados acima são locais, não CI aprovado.

## Revisão do PR #7 e poda do backlog — 17/10/2026, ~20h40
- PR #7 (contratos mínimos, proposta local, compra interna eliminada) está na `main`; `typecheck`, `lint`, 49 testes e `build` passam.
- **Bloqueios para a demo:** aprovação inalcançável (toda proposta nasce com taxas e total não confirmados) e UI sem botão de aprovação. Detalhes e backlog enxuto (34 → 22 tasks) em `docs/REVISAO_PR7_E_BACKLOG_V2.md`.
- **IDs de decisão:** as decisões da V2 foram renumeradas para **D-011 e D-012** (D-007 a D-010 são do Kenzo).
- Nenhum card do Trello foi alterado; a poda é proposta.

## Plano do agente (frente Hyago) — 17/10/2026, ~21h
- `docs/BRIEFING_AGENTE.md`: arquitetura do agente na V2 (orquestrador guiado por código, saída estruturada, estado da sessão, funções de domínio, `/api/converse`, L0/L1/L2).
- `docs/PLANO_AGENTE.md`: marcos M0–M4 alinhados aos gates G2–G5, divisão em dupla (Hyago + parceiro a definir), definição de pronto do core.
- D-013 (proposta): LangChain.js isolado em `src/agent/llm/`, sem LangGraph. Nenhum código de runtime alterado; dependências ainda não instaladas.
- Pendente: aceite de D-011/D-012/D-013, parceiro da dupla, provedor/chave de LLM; depende de K-1, K-3, K-5 (Kenzo) e M-1 (Malveste).
