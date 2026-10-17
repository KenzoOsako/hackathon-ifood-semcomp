# Plano de implementação — Agente Guide (backend)

> Frente **System Prompt e Fluxo de Agentes** (dono: Hyago). Base: [briefing](BRIEFING_AGENTE.md), comportamento em [AGENTE_CONVERSA_E_FLUXO.md](AGENTE_CONVERSA_E_FLUXO.md), gates do [Plano V2](PLANO_V2_PAPEIS_E_CRONOGRAMA.md). Divisão entre **A = Hyago** e **B = parceiro [DECIDIR quem]**. Janela: sáb 17/10 ~20h30 → dom 12h30. Cada marco termina com algo rodando e uma prova. PR pequeno, um card por PR, merge pelo Kenzo.

## Core do agente: definição de pronto

Por texto, contra domínio fake, passando nos casos C1, C2, C6, C8 e C11 do doc de fluxo:
- *"aniversário de um amigo, pizza em casa e filme"* → no máximo 3 perguntas → plano com 2+ necessidades e motivos;
- "pizza mais barata" → nova versão, fala só a diferença;
- "tanto faz, só faz isso logo" → avança para S5 sem repetir;
- "aprovo o plano" → evento de aprovação com `planoId` + `versao`;
- *"pizza calabresa grande, pede logo"* → plano no 1º turno.

Evals rodando com LLM real e tempo de cada etapa medido.

## Decisões de simplificação

1. **LLM devolve o estado completo** de ocasião/necessidades a cada turno, não um delta.
2. **Fala pelo LLM** (`responder`) só em S3/S4, recebendo apenas o snapshot do plano; perguntas saem já no `interpretar` (1 chamada).
3. **Regras em código:** teto de perguntas, anti-repetição, S5 uma vez, feedback uma vez. O prompt orienta, o código garante.
4. **Estado em `Map<subjectRef, AgentSession>`** em `src/agent/orchestrator/`; não altera arquivos do Kenzo.
5. **LangChain.js** (D-013) só em `src/agent/llm/`, atrás do `LlmPort`. Sem LangGraph.
6. **Sem chave de LLM:** tudo segue com `LlmFake` roteirizado; a troca é só no adaptador.

## Divisão dentro da frente

| | A — Hyago | B — Parceiro |
|---|---|---|
| Foco | **Cérebro**: máquina de estados S0–S7, prompts, L0/L1/L2, consentimento, incerteza | **Infra do agente**: adaptador LLM, domínio fake, `/api/converse`, evals, medição |
| Arquivos | `src/agent/orchestrator/**`, `src/prompts/**` | `src/agent/llm/**`, `src/agent/domain-fake/**`, `src/app/api/converse/**`, `src/evals/**` |
| Cards | TER-04+OCS-03, ENT-02 | TER-05, H-1, evals |

Ponto de contato: tipos do M0. Não tocar em `src/domain`, `src/mcp`, `src/contracts`, `proposals.ts`, `http.ts`, `visitor-session.ts` (Kenzo) nem em `src/voice/**` (Felipe).

## Marcos

### M0 — Contratos do agente e LLM · juntos · até 21h30 (G2)
- [ ] `src/agent/types.ts`: `AgentSession`, `TurnoInterpretado` (Zod), `LlmPort { interpretar, responder }`, `DomainPort` (ferramentas da seção 4.2 do doc de fluxo), entrada do `/api/converse` reaproveitando `VoiceSignalsSchema` de `src/voice/signals.ts` + `hipoteses?`.
- [ ] B: instalar `@langchain/core` + pacote(s) do provedor com chave disponível, escolhido por variável de ambiente (sem fixar modelo); `withStructuredOutput` devolvendo JSON de teste; `npm run build` passando.
- [ ] A: dividir `src/voice/agent-prompt.md` em `src/prompts/interpretar.ts` e `responder.ts` (briefing seção 5).
- [ ] Juntos: formato do cenário de eval (turnos do usuário + estado/nível esperado + máx. perguntas + checagens da fala) e `LlmFake` roteirizado; cenários = C1–C12 + os 15 de `src/evals/README.md` (sem duplicar).
- **Pronto quando:** tipos commitados; LLM real devolve JSON válido; cenários escritos em `src/evals/`.

### M1 — Turno completo com domínio fake · em paralelo · 21h30–00h30 (G3)

**A — Orquestrador**
- [ ] Máquina de estados S0–S7 como função pura + transições especiais (fora de escopo, erro de ferramenta, anti-repetição).
- [ ] Teto de 3 perguntas (confirmação de reconhecimento não conta), L0 sem perguntas, nível só rebaixa, padrões assumidos ditos.
- [ ] `consentir` → S5 uma vez; `aprovar_frase` → evento para o domínio; nunca "pedido feito".
- [ ] Incerteza: `hipoteses` + opções faladas → confirmação sim/não.
- [ ] Testes com `LlmFake`: C1, C2, C4, C6, C8, C11, C12.

**B — Infra**
- [ ] Domínio fake **primeiro** (até ~22h30; A depende): fixtures dos dados de exemplo do prompt, `buscarNecessidade` com `reasons[]` e rótulo, `montarPlano`/`ajustarPlano` com versão, quantidade a partir de `pessoas`, tudo rotulado simulado.
- [ ] `LlmPort` real (LangChain + Zod na borda); modelo por variável de ambiente; timeout/erro → frase curta.
- [ ] `POST /api/converse` com cookie de sessão e guardas de `http.ts`.
- [ ] Medição por etapa (interpretar, domínio, responder) no log de cada turno.
- [ ] Runner de evals (LLM fake; real quando houver chave).
- **Pronto quando (G3):** via `curl`, a jornada do aniversário e o caso rápido funcionam; tempos por etapa aparecem no log.

### M2 — Domínio real, eventos e qualidade · juntos · 00h30–03h (G4)
- [ ] Trocar o fake pelas ferramentas do Kenzo (K-3/K-5), se existirem; senão seguir no fake.
- [ ] `registrarEvento` nos pontos do doc (opções exibidas, reação, seleção, não atendida, fricção).
- [ ] Eval que reprova número ou motivo fora do snapshot.
- **Pronto quando:** jornada do aniversário por texto com domínio real (ou fake rotulado); evals ≥ 12 de todos os cenários; tempos medidos registrados. Endpoint pronto para a voz se conectar.

### M3 — Ajustes e latência · revezamento · 03h–09h
- [ ] Atacar a etapa mais lenta medida (modelo menor, prompt menor, paralelismo).
- [ ] Ajustar prompts pelos evals que falharam; ENT-02 (desenho da solução com o fluxo real).
- [ ] Apoiar a conexão da voz no `/api/converse` quando o Felipe estiver pronto.
- **Pronto quando:** evals quase todos passando; ENT-02 em PR.

### M4 — Congelamento · 09h (G5) → 12h
- [ ] Sem funcionalidade nova. Roteiro 10 vezes (aceite D-8: ≥ 9 sem falha).
- [ ] Atualizar `contexto/estado-atual.md` e insumos do doc técnico (05).

## Regras
- Antes do PR: `npm run typecheck && npm run lint && npm test && npm run build`.
- Nenhum PR dá ao LLM acesso a aprovação, carrinho ou `submitOrder`.
- Travou mais de 45 min: avisar e cortar escopo.

## Caminho crítico
`M0 → domínio fake (B) → M1-A → G3`. Externas: **K-3/K-5** (Kenzo) para domínio real, **K-1 + M-1** para a aprovação aparecer na tela. A voz conecta depois, sem bloquear o agente. Se atrasarem, o agente segue por texto no domínio fake, rotulado como simulado.
