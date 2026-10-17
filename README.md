# FoodPilot — Hackathon iFood SEMCOMP 29

Copiloto conversacional para escolher refeições, comparar até três opções relevantes e preparar uma proposta de carrinho. A compra final ocorre no iFood.

## Leitura inicial
1. [Proposta final aprovada: decisões 1–39](docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md).
2. [Auditoria e lacunas verificadas](docs/AUDITORIA-ALINHAMENTO-2026-10-17.md).
3. [Estado da implementação](contexto/estado-atual.md), [contexto do time](contexto/contexto.md) e [instruções para agentes](AGENTS.md).
4. [Guia técnico MCP](docs/mcp-ifood-referencia.md) e [frentes candidatas](docs/frentes.md).
5. [Resumo de negócio — entregável 01](docs/entregaveis/01-proposta-de-negocio.md).

Plano operacional e tarefas por responsável: [Plano de execução da equipe](docs/PLANO_EXECUCAO_EQUIPE_FOODPILOT.md).

Sequência, dependências e critérios das tarefas de Kenzo: [Plano de implementação de Kenzo](docs/PLANO_IMPLEMENTACAO_KENZO.md).

## Execução local
Requer Node.js e npm compatíveis com o lockfile. No PowerShell:
```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```
Abra http://localhost:3000 no Chrome. O padrão é **MCP simulado**. Não há OAuth, LLM, voz ou persistência real implementados. O fluxo textual cria apenas proposta local: não cria carrinho remoto, não envia pedido e não consulta tracking. Taxas ausentes no contrato legado deixam o total pendente e impedem aprovação. Compra final no iFood; integração real permanece bloqueada.

Sessão de visitante emitida pelo servidor em cookie HttpOnly (30 minutos absolutos); proposta local válida por cinco minutos. Reinício do processo exige nova conversa. Detalhes e payloads para integrar UI/MCP em [Integração da proposta local](docs/INTEGRACAO_PROPOSTA_LOCAL.md).

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## Colaboração
Branch própria → PR → revisão e merge pelo integrador, conforme AGENTS.md. A proposta aprovada define requisitos; a auditoria define o que existe. A atribuição de novas frentes depende do alinhamento da equipe após a auditoria. O rascunho produto-v1 é histórico.

Credenciais somente em ambiente local/cofre; .env.example contém campos vazios. Valores com formato de credenciais foram removidos do template nesta atualização: se eram válidos, precisam de revogação/rotação nos provedores, pois permanecem no histórico Git.
