# Frentes candidatas após auditoria

Fonte: [proposta final](PROPOSTA_DE_NEGOCIO_FOODPILOT.md). Estado: [auditoria](AUDITORIA-ALINHAMENTO-2026-10-17.md).
Mapa de dependências, sem atribuições novas. A equipe define recorte e responsáveis após a auditoria (D39). Kenzo mantém revisão/merge segundo governança atual.

1. Validar leitura MCP real, autorização e contexto relevante ao P0.
2. Corrigir proposta local, aprovação antes de escrita e compra final no iFood. Não conectar submitOrder do esqueleto a operações reais.
3. Aplicar filtros rígidos, orçamento total e explicações demonstráveis.
4. Demonstrar jornada por texto OU voz com MCP real relevante e mocks identificados.
5. Evoluir voz, memória, feedback e cinco modos conforme P1.

| Área candidata | Pastas atuais / futuras | Dependência |
|---|---|---|
| Agente/MCP/API | src/agent, src/mcp, src/app/api | tools/list, leitura autorizada, tokens isolados e contratos reais; McpClient atual é interface interna. |
| UI/voz | src/app/page.tsx, src/ui, src/voice | Proposta revisável e aprovação versionada; ElevenLabs por adaptador, fallback Web Speech API Chrome e texto. Verificar plano/capacidade. |
| Recomendação/memória | src/reco, src/memory, fixtures | Filtros antes do ranking, consentimento e controles; Supabase/PostgreSQL e isolamento antes de dados pessoais. |
| Contratos | src/contracts | Mudanças coordenadas pelo integrador antes de frentes paralelas. |

Não gerar pedidos para fabricar histórico. Respostas reais em fixtures exigem autorização, minimização e anonimização.
Modelo LLM ainda não escolhido; medir latência/custo sem inventar meta aprovada. Deploy público é objetivo; tracking pós-checkout depende de suporte validado. Mercado, multiloja e interrupção avançada não bloqueiam P0.
Executar conforme README: npm ci, template vazio em .env, npm run dev. Apenas MCP_MODE=mock implementado.
Antes de PR: npm run typecheck, npm run lint, npm test, npm run build.
