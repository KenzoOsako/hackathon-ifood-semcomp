# Índice dos documentos

Atualizado em 17/10/2026, ~20h. Status: **canônico** (aprovado), **V2** (proposto, aguarda aceite do integrador), **referência** (apoio técnico), **histórico** (superado, não orienta implementação).

| Documento | Status | Para quê |
|---|---|---|
| [K3_PLANO_COMPOSTO.md](K3_PLANO_COMPOSTO.md) | referência técnica | Contrato oficial aditivo e aprovação local atômica do plano; limites e integração pendente com agente/voz/UI |
| [DIRECAO_V2_OCASIAO.md](DIRECAO_V2_OCASIAO.md) | **V2** | O que muda: ocasião multi-vertical, diferencial (contexto por voz + dados para o iFood), conversa adaptativa, dados e eventos |
| [PLANO_V2_PAPEIS_E_CRONOGRAMA.md](PLANO_V2_PAPEIS_E_CRONOGRAMA.md) | **V2** | Quem faz o quê, interfaces entre as funções, cronograma, gates e riscos |
| [REVISAO_PR7_E_BACKLOG_V2.md](REVISAO_PR7_E_BACKLOG_V2.md) | **V2** | Revisão do PR #7 (achados), auditoria das 34 tasks e backlog enxuto de 22 |
| [AGENTE_CONVERSA_E_FLUXO.md](AGENTE_CONVERSA_E_FLUXO.md) | **V2** | Contrato entre voz (Felipe), fluxo (Hyago) e domínio (Kenzo): estados da conversa, ferramentas, guia de estilo e casos de teste |
| [frentes.md](frentes.md) | **V2** | Mapa pastas × dono × entradas e saídas |
| [PROPOSTA_DE_NEGOCIO_FOODPILOT.md](PROPOSTA_DE_NEGOCIO_FOODPILOT.md) | canônico | Decisões 1–39. A V2 propõe alterar o escopo (decisões 1 e 19) e o diferencial |
| [PLANO_EXECUCAO_EQUIPE_FOODPILOT.md](PLANO_EXECUCAO_EQUIPE_FOODPILOT.md) | canônico (donos podem mudar pela V2) | Tarefas FP-01 a FP-24, aceites AC-01 a AC-15, fluxo de PR |
| [AUDITORIA-ALINHAMENTO-2026-10-17.md](AUDITORIA-ALINHAMENTO-2026-10-17.md) | canônico | O que existe de fato no código e as lacunas |
| [PLANO_BLINDAGEM.md](PLANO_BLINDAGEM.md) | **V2** | Medidas corretivas do agente, fluxo e segurança: causas raiz, medidas P0/P1/P2, matriz de cenários, critérios de aceite e ordem de execução |
| [EXEMPLOS_TESTE_FALADO.md](EXEMPLOS_TESTE_FALADO.md) | referência | Conversas reais faladas com Gemini + MCP real: o que o agente fez, padrões a corrigir e cenários propostos |
| [TESTE_INTEGRADO.md](TESTE_INTEGRADO.md) | referência | Roteiro do teste falado voz + agente (Gemini) + MCP: preparar, subir, o que falar, o que coletar |
| [VOZ_INTEGRACAO_BACKEND.md](VOZ_INTEGRACAO_BACKEND.md) | **V2** | Passagem da voz para o backend: como ouvir o agente falando, contrato de eventos, regras do texto falado |
| [VOZ_PLANO_DE_QUALIDADE.md](VOZ_PLANO_DE_QUALIDADE.md) | **V2** | Matriz de qualidade da voz, checklist do painel ElevenLabs e roteiro de teste humano |
| [mcp-ifood-referencia.md](mcp-ifood-referencia.md) | referência | 24 ferramentas, OAuth, escopos, erros (documentação, não `tools/list` real) |
| [entregaveis/](entregaveis/) | entregáveis | 01 a 06, um arquivo cada |
| [produto-v1.md](produto-v1.md) | histórico | Rascunho anterior (copiloto só de refeições) |
| [historico/](historico/) | histórico | Contexto anterior preservado |

Memória do time em [`../contexto/`](../contexto/): contexto, estado atual, decisões (D-001 a D-012), erros aprendidos, feedback do MCP. `regras-de-negocio.md` só humanos editam.

## Como ler em caso de conflito
1. `contexto/regras-de-negocio.md` (humanos) e decisões aprovadas vencem.
2. Documentos **V2** só valem depois do aceite do integrador (D-011/D-012).
3. Auditoria vence sobre qualquer afirmação de "já está pronto".
4. Histórico nunca orienta implementação.
