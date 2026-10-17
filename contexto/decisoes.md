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
