# Revisão do PR #7 e poda do backlog (V2)

> 17/10/2026, ~20h40. Análise do PR #7 do Kenzo (`feat/kenzo-contratos-minimos`, mesclado em `8c5572e`) e auditoria das tasks do Trello e dos planos. **Proposta para o time decidir: nenhum card foi alterado no Trello.** Complementa `PLANO_V2_PAPEIS_E_CRONOGRAMA.md` e `DIRECAO_V2_OCASIAO.md`.

## 1. Resumo
- O PR #7 entregou o **núcleo seguro** que a V2 precisava: contratos de custo e proposta, aprovação por versão, proibição de compra interna e sessão isolada. **Isso tira trabalho do caminho crítico** do Kenzo e da V2.
- Mas deixou **dois bloqueios para a demo**: a aprovação é **inalcançável** (toda proposta nasce com "taxas e total não confirmados") e **não existe botão de aprovação na interface**.
- Das 34 tasks no quadro, **3 já estão feitas, 11 são desnecessárias ou duplicadas** e **6 tasks necessárias não existiam**. O backlog enxuto fica com **22 tasks**.

## 2. O que o PR #7 entrega (verificado)
`typecheck`, `lint`, **49 testes (8 arquivos)** e `build` passam na `main` após o merge.

| Entrega | Onde |
|---|---|
| Dinheiro em centavos, `Cost` com frete e taxas separados (ausência ≠ zero), `Constraints` (teto rígido e alergias) | `src/contracts/proposal.ts` |
| `CartProposal` (versão, validade, estado), `ApprovalRequest` (proposta, versão, interação, canal), `PortFailure` | `src/contracts/proposal.ts` |
| Transições de estado (rascunho → revisão → aprovada, invalidada, cancelada, expirada) | `src/contracts/proposal-state.ts` |
| Intenção, contexto autorizado, razões ligadas a evidência, resposta pública com até 3 recomendações | `src/contracts/recommendation.ts` |
| `ProposalStore`: versão, expiração, replay e dupla aprovação negados, atômico no processo | `src/agent/proposals.ts` |
| Sessão de visitante por cookie, Origin same-origin, JSON limitado, erros sanitizados | `src/agent/visitor-session.ts`, `src/agent/http.ts` |
| **Compra interna eliminada**: o agente não chama `createCart`, `submitOrder` nem `trackOrder`; `GET /api/order` responde 410 | `src/agent/agent.ts`, rotas |
| Guia de integração para UI e MCP | `docs/INTEGRACAO_PROPOSTA_LOCAL.md`, `src/contracts/README.md` |

## 3. Achados da revisão

| # | Gravidade | Achado | Efeito na V2 |
|---|---|---|---|
| 1 | **Alta** | `src/agent/agent.ts` fixa `status: "unknown"` e `unresolved: ["Taxas e total não confirmados"]` em **toda** proposta. Com isso, a aprovação nunca pode ocorrer no chat. Os candidatos do mock também não têm `fees` | **A demo não consegue aprovar nada.** Quebra o aceite D-3 da V2 |
| 2 | **Alta** | `src/app/page.tsx` ainda tem o botão antigo (`/api/confirm` com `{ explicit: true }`), que depende de `cart` e agora é inválido. **Não há botão de aprovação** nem exibição da proposta | A tela do plano de ocasião (UX-01) começa sem base para aprovação |
| 3 | Média | `CartProposal` tem **um** `merchantRef`. A V2 precisa de um **plano com várias necessidades e lojas** | Basta **compor** várias propostas num plano; não refazer contratos |
| 4 | Média | `agent.ts` mistura **orquestração** (conversa) com **domínio** (criar proposta, aprovar). A V2 dá a orquestração ao Hyago e o domínio ao Kenzo | Extrair as funções de domínio para `src/domain/` antes de o Hyago mexer no arquivo |
| 5 | Média | O MCP real continua não implementado (`MCP_MODE=real` lança erro); `OrderState` mantém `PEDIDO_CONFIRMADO` e `AGUARDANDO_CONFIRMACAO` legados | Rótulos legados podem sugerir compra interna; limpar |
| 6 | Baixa | `page.tsx` ainda envia `sessionId` (ignorado pelo servidor) | Remover para não confundir |
| 7 | Info | O `PLANO_IMPLEMENTACAO_KENZO.md` assume os donos antigos (Kenzo no orquestrador, Hyago no MCP, Terossi na voz e LLM) | Conflita com D-012 se for aceita; reconciliar |

O isolamento, a validação de entrada e a política de erros **estão sólidos e não devem ser refeitos**.

## 4. Auditoria das tasks (34 cards no quadro)

### 4.1 Já concluídas pelo PR #7
| Card | Situação |
|---|---|
| KEN-01 Contratos entre módulos | Entregue em parte (contratos de proposta e recomendação). **Falta** o contrato de ocasião e plano (task nova K-3) e a revisão dos consumidores. Manter em *Em Revisão* |
| KEN-02 Corrigir o fluxo de aprovação do carrinho | **Concluída**: aprovação versionada, sem carrinho remoto |
| KEN-03 Eliminar finalização automática de pedidos | **Concluída**: nenhuma rota chama `submitOrder`; `/api/order` → 410 |

### 4.2 Desnecessárias, duplicadas ou para rebaixar
| Card | Ação | Motivo |
|---|---|---|
| GOV-01 Validar divisão de tarefas e governança | **Cortar** | É a decisão D-012; vira o aceite do PR, não uma task |
| DOC-01 Validar aceite independente do plano integrado | **Cortar** | Revisão de documento sobre documento; o PR já é a revisão |
| KEN-06 Revisar e aprovar Pull Requests | **Cortar** | É um processo contínuo (D-003), não uma entrega |
| KEN-08 Coordenar o fechamento técnico | **Fundir em KEN-07** | Sobrepõe QA, deploy e pitch |
| SEC-01 Revisar exposição histórica e preservar `.gitignore` | **Rebaixar para P2 (pós-evento)** | O template já foi limpo; o que resta é revogar chaves (a organização revoga as do iFood na segunda) |
| TER-01 Adaptador de voz independente de fornecedor | **Fundir em TER-02** | Abstração demais para 15 horas; ElevenLabs direto + Web Speech como reserva |
| TER-07 Tratamento de falhas de voz | **Fundir em TER-06** | Mesma frente, mesmo teste |
| OCS-02 Sondar MCP por vertical | **Fundir em HYA-01** | A conexão real e a sondagem são a mesma operação; sai uma tabela por vertical |
| OCS-03 Diálogo adaptativo | **Fundir em TER-04** | É o orquestrador; um card só |
| OCS-04 Ranking por necessidade | **Fundir em KEN-04** | Mesmo módulo e mesmas regras |
| DEMO-01 Roteiro da demo "aniversário" | **Fundir em PITCH-01** | O roteiro é parte do pitch |

### 4.3 Mantidas
ENT-01 a ENT-06, PITCH-01, KEN-04, KEN-05, KEN-07, HYA-01, TER-02, TER-03, TER-04, TER-05, TER-06, OCS-01 (reduzida), INS-01, INS-02 (P1), UX-01.

### 4.4 Faltavam (necessárias e sem card)
| Nova | Dono (V2) | Por quê |
|---|---|---|
| **K-1 Custo confirmado no mock e lógica de pendências** | Kenzo | Destrava a aprovação (achado 1) |
| **K-2 Normalizar dados do MCP real para `Candidate` e `Cost`** (frete e taxas explícitos) | Kenzo | Sem isso o dado real não entra no ranking |
| **K-3 Plano de ocasião: compor `CartProposal` por necessidade, com aprovação do plano** | Kenzo | Achado 3; substitui o OCS-01 "contratos novos" |
| **K-4 Continuidade no iFood** (link validado ou resumo copiável) | Kenzo | FP-11 do plano, sem card |
| **K-5 Extrair funções de domínio de `agent.ts` para `src/domain/`** | Kenzo | Achado 4; destrava o Hyago |
| **M-1 UI: proposta, pendências, botão de aprovação e cancelar** | Malveste | Achado 2; o Malveste só tinha ENT-03 e ENT-04 |
| **H-1 Rota `/api/converse` usando os guardas de `http.ts` e o cookie de sessão** | Hyago (com Felipe) | A voz não pode abrir um caminho paralelo sem os limites do PR #7 |

## 5. Backlog enxuto (22 tasks)

| Pessoa | Tasks | Ordem |
|---|---|---|
| **Kenzo** (Request e Dados) | HYA-01+OCS-02 (conexão e sondagem) · **K-1** · **K-5** · **K-3** · KEN-04+OCS-04 (ranking) · **K-2** · INS-01 · **K-4** · KEN-05+KEN-07 (integração e QA) · ENT-05 · ENT-06 | K-1 e K-5 primeiro (destravam todos) |
| **Hyago** (Prompt e Agentes) | TER-04+OCS-03 (orquestrador e diálogo) · TER-05 (provedor de LLM) · **H-1** · evals (15 cenários) · ENT-02 | Depende de K-5 |
| **Felipe** (Voz) | TER-02+TER-01 (ElevenLabs) · TER-03 (Web Speech) · TER-06+TER-07 (comandos e falhas) · PITCH-01+DEMO-01 · ENT-01 | Voz pode andar já, com respostas fixas |
| **Malveste** (Interface) | **M-1** · UX-01 (plano de ocasião) · INS-02 (P1) · ENT-03 · ENT-04 | M-1 primeiro |

**Resultado:** 34 → 22 tasks. A carga do Kenzo cai bastante: contratos, proposta e guardrails já estão feitos, e ele deixa de ser o dono do orquestrador (se D-012 for aceita).

## 6. Efeito no cronograma
- **G2 (21h30):** vira "K-1, K-5 e o contrato do plano (K-3) publicados". O PR #7 já cumpriu o resto do contrato.
- **G3 (00h30):** o fluxo "texto → plano → **aprovação**" depende de **K-1** (achado 1). Sem K-1, o fluxo não fecha nem simulado.
- O restante do plano V2 não muda.

## 7. Decisões para o time
1. **Aceitam o corte** das 11 tasks e as 6 novas? (Cada card cortado era de um dono: GOV-01, DOC-01 e KEN-06 são do Kenzo.)
2. **Quem faz K-1 e K-5 agora** (sugestão: Kenzo, 1 a 2 horas)?
3. **Ownership dentro de `src/agent/`:** `proposals.ts`, `http.ts` e `visitor-session.ts` ficam com o Kenzo; `agent.ts` passa ao Hyago depois de K-5.

## 8. Como aplicar no Trello (não aplicado)
Arquivar os cards cortados e fundidos com um comentário apontando o card que absorve o conteúdo; mover KEN-02 e KEN-03 para *Pronto*; criar K-1 a K-5, M-1 e H-1; renomear os donos conforme D-012 após o aceite.
