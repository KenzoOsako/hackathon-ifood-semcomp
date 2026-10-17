# FoodPilot — Hackathon iFood SEMCOMP 29

Copiloto de compras por **voz** que resolve uma **ocasião**, e não só uma refeição. Exemplo: *"Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme"* → pizza (restaurante), pipoca (mercado) e presente (shopping), cada um com até três opções e o motivo de cada escolha, em uma proposta única. A compra final ocorre no iFood.

> **Status da direção:** a **Direção V2** (ocasião, contexto por voz, dados para o iFood) está **proposta e aguarda o aceite do integrador** (D-011 e D-012 em [`contexto/decisoes.md`](contexto/decisoes.md)). Onde houver conflito, valem a [proposta canônica](docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md) e o [plano anterior](docs/PLANO_EXECUCAO_EQUIPE_FOODPILOT.md) até esse aceite. Mapa completo dos documentos: [`docs/INDEX.md`](docs/INDEX.md).

## Leitura inicial (nesta ordem)
1. [Roadmap operacional até a submissão](docs/ROADMAP.md)
2. [Direção V2: ocasião, contexto por voz e dados para o iFood](docs/DIRECAO_V2_OCASIAO.md)
3. [Plano V2: papéis, interfaces e cronograma](docs/PLANO_V2_PAPEIS_E_CRONOGRAMA.md)
4. [Proposta canônica (decisões 1–39)](docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md) e [auditoria](docs/AUDITORIA-ALINHAMENTO-2026-10-17.md)
5. [Contexto do evento e do time](contexto/contexto.md), [estado atual](contexto/estado-atual.md) e [instruções para agentes](AGENTS.md)
6. [Guia técnico do MCP do iFood](docs/mcp-ifood-referencia.md)

## Equipe e funções (proposta V2)

| Pessoa | Função | Pastas principais |
|---|---|---|
| **Felipe** | Conversação e Voz | `src/voice/` |
| **Hyago** | System Prompt e Fluxo de Agentes | `src/agent/`, `src/prompts/`, `src/evals/` |
| **Kenzo** | Request e Dados (integrador) | `src/mcp/`, `src/reco/`, `src/domain/`, `src/data/`, `src/contracts/` |
| **Malveste** | Interface e Front-End | `src/app/` (exceto `api/`), `src/ui/` |

Detalhes, interfaces entre as funções e cronograma: [`docs/PLANO_V2_PAPEIS_E_CRONOGRAMA.md`](docs/PLANO_V2_PAPEIS_E_CRONOGRAMA.md).

## Estrutura do repositório

```
contexto/            memória do time (regras, decisões, estado, feedback do MCP)
docs/                direção, plano, proposta, guia do MCP e entregáveis (índice em docs/INDEX.md)
docs/entregaveis/    os 6 entregáveis obrigatórios, um arquivo cada
fixtures/            dados simulados rotulados (formato do MCP)
src/
  app/               páginas e rotas (UI: Malveste; rotas de API: dono do módulo que as usa)
  agent/             orquestrador e fluxos do agente (Hyago)
  prompts/           system prompt e prompts por etapa (Hyago)
  evals/             cenários de teste do agente (Hyago)
  voice/             entrada e saída de voz, interrupção, falhas (Felipe)
  mcp/               cliente do MCP do iFood, OAuth, adaptadores e mocks (Kenzo)
  reco/              filtros, ranking e motivos (Kenzo)
  domain/            ocasião, necessidades e plano versionado (Kenzo)
  data/              eventos de feedback, consentimento e armazenamento (Kenzo)
  contracts/         tipos compartilhados (só o Kenzo altera)
  memory/            memória do usuário (hoje em RAM)
  ui/                componentes da interface (Malveste)
```

Cada pasta nova tem um `README.md` com dono, entradas e saídas e regras.

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
Branch própria → PR → revisão e merge pelo integrador, conforme [AGENTS.md](AGENTS.md). Um card do Trello por PR (quadro **HACKATHON IFOOD**). A proposta aprovada define requisitos; a auditoria define o que existe; os documentos V2 definem o que está em aprovação.

Credenciais somente em ambiente local/cofre; `.env.example` contém campos vazios. Valores com formato de credenciais foram removidos do template: se eram válidos, precisam de revogação/rotação nos provedores, pois permanecem no histórico Git.
