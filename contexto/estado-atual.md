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
