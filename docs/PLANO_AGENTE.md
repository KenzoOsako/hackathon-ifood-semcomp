# Plano de implementação — Agente Guide (V2)

> Frente **System Prompt e Fluxo de Agentes** (dono: Hyago). Base: [briefing](BRIEFING_AGENTE.md) e gates do [Plano V2](PLANO_V2_PAPEIS_E_CRONOGRAMA.md). Divisão entre **A = Hyago** e **B = parceiro [DECIDIR quem]**. Janela: sáb 17/10 ~20h30 → dom 12h30. Cada marco termina com algo rodando e uma prova. PR pequeno, um card por PR, merge pelo Kenzo.

## Core do agente: definição de pronto

Por texto, contra domínio fake: *"aniversário de um amigo, pizza em casa e filme"* → no máximo 3 perguntas → plano com 2+ necessidades e motivos → ajuste ("pizza mais barata") gera nova versão → "confirmo o plano" devolve evento de aprovação com `planoId` + `versao`. *"pizza calabresa grande, pede logo"* → plano no 1º turno. Evals rodando com LLM real.

## Decisões de simplificação (para caber em duas pessoas)

1. **LLM devolve o estado completo** de ocasião/necessidades a cada turno, não um delta. Elimina lógica de merge; o código só valida e substitui.
2. **Verbalização por template** a partir de `reasons[]` (determinística, sem custo, sem risco de inventar). LLM para verbalizar só se sobrar tempo.
3. **Uma chamada de LLM por turno** (`interpretar`). Menos latência para a voz.
4. **Estado do agente em `Map<subjectRef, AgentSession>`** dentro de `src/agent/orchestrator/`, usando o `subjectRef` da sessão de visitante. Não altera `visitor-session.ts` nem `agent.ts` (Kenzo).
5. **LLM via LangChain.js** (D-013): só `@langchain/core` + o pacote do provedor escolhido (`@langchain/openai`, `@langchain/anthropic` ou `@langchain/google-genai`). `withStructuredOutput(schemaZod)` para o `interpretar`; trocar de modelo = trocar uma linha de configuração. **Sem LangGraph**: o grafo é código nosso. LangChain fica restrito a `src/agent/llm/`; o orquestrador só conhece o `LlmPort`.
6. **Sem chave de LLM até 21h30:** tudo continua com LLM fake roteirizado (testes e rota funcionam); a troca é só no adaptador.

## Divisão dentro da frente

| | A — Hyago | B — Parceiro |
|---|---|---|
| Foco | **Cérebro**: orquestrador, prompts, profundidade L0/L1/L2 | **Infra do agente**: adaptador LLM, domínio fake, `/api/converse`, evals |
| Arquivos | `src/agent/orchestrator/**`, `src/prompts/**` | `src/agent/llm/**`, `src/agent/domain-fake/**`, `src/app/api/converse/**`, `src/evals/**` |
| Cards | TER-04+OCS-03, ENT-02 | TER-05, H-1, evals |

Ponto de contato: tipos do M0 (`AgentSession`, `TurnoInterpretado`, `LlmPort`, `DomainPort`). Não tocar em `src/domain`, `src/mcp`, `src/contracts` (Kenzo) nem em `proposals.ts`/`http.ts`/`visitor-session.ts` (ficam com o Kenzo).

## Marcos

### M0 — Contratos do agente e LLM · juntos · até 21h30 (G2)
- [ ] Tipos em `src/agent/types.ts`: `AgentSession`, `TurnoInterpretado` (Zod), `LlmPort { interpretar, verbalizar }`, `DomainPort` (assinaturas das funções do Kenzo).
- [ ] B: instalar `@langchain/core` + pacote do provedor; escolher modelo com chave e cota disponíveis; `withStructuredOutput` devolvendo um JSON de teste. Chave no `.env`, nome da variável no `.env.example`. Conferir `npm run build` com as dependências novas.
- [ ] A: system prompt v0 + prompt `interpretar` + 15 cenários escritos (só texto, ainda sem rodar).
- [ ] Juntos: formato do cenário de eval (lista de turnos do usuário + nível esperado + máx. perguntas + checagens da saída) e um `LlmFake` roteirizado por cenário.
- [ ] Ler os contratos de Ocasião/Necessidade/Plano do Kenzo (K-3) quando publicados e ajustar `DomainPort`.
- **Pronto quando:** tipos commitados; LLM responde; 15 cenários listados em `src/evals/`.

### M1 — Turno completo com domínio fake · em paralelo · 21h30–00h30 (G3)

**A — Orquestrador**
- [ ] Turno: interpretar → atualizar sessão → decidir (perguntar / montar / ajustar / aprovar / fora de escopo).
- [ ] Teto de 3 perguntas, L0 sem perguntas, padrões assumidos ditos na resposta.
- [ ] Verbalização por template a partir de `reasons[]`.
- [ ] Testes com LLM fake: L0 monta no 1º turno; L2 nunca passa de 3 perguntas; "mais barato" gera ajuste; saída inválida → L1.

**B — Rota e evals**
- [ ] `DomainPort` fake (primeira tarefa, até ~22h30, A depende dele): 2–3 opções por vertical com `reasons[]`, `montarPlano`/`ajustarPlano` com versão, tudo rotulado como simulado.
- [ ] `LlmPort` real com LangChain (`withStructuredOutput` + validação Zod de novo na borda); modelo escolhido por variável de ambiente; timeout/erro → resposta textual limitada.
- [ ] `POST /api/converse` com cookie de sessão e guardas de `http.ts`.
- [ ] Runner de evals: roda os 15 cenários contra o orquestrador (LLM fake primeiro, real depois) e registra nível, nº de perguntas, saída válida.
- **Pronto quando (G3):** via `curl`/UI, "aniversário… pizza… filme" → 1 pergunta → plano com 2+ necessidades (simulado) → evento de aprovação devolvido. Aprovação de fato depende de K-1 e M-1.

### M2 — Domínio real e eventos · juntos · 00h30–03h (G4)
- [ ] Trocar o domínio fake pelas funções do Kenzo (K-5/K-3), se já existirem; senão seguir no fake.
- [ ] Eval que falha se aparecer motivo fora de `reasons[]`.
- [ ] `registrarEvento` nos pontos: opções exibidas, reação, seleção final, necessidade não atendida, fricção.
- [ ] Evals com LLM real; anotar custo e latência por turno.
- **Pronto quando:** mesma jornada com o domínio real (MCP real se G4 passar, senão mock rotulado); evals ≥ 12/15.

### M3 — Voz e ajustes · revezamento · 03h–09h
- [ ] B + Felipe: `sinais` da voz entrando no nível; resposta em fluxo se a latência pedir.
- [ ] A: ajustar prompts pelos evals que falharam; ENT-02 (desenho da solução com o fluxo real).
- **Pronto quando:** jornada por voz no Chrome; evals ≥ 14/15; ENT-02 em PR.

### M4 — Congelamento · 09h (G5) → 12h
- [ ] Sem funcionalidade nova. Rodar o roteiro 10 vezes (aceite D-8: ≥ 9 sem falha).
- [ ] Atualizar `contexto/estado-atual.md` e insumos do doc técnico (05).

## Regras
- Antes do PR: `npm run typecheck && npm run lint && npm test && npm run build`.
- Nenhum PR dá ao LLM acesso a aprovação, carrinho ou `submitOrder`.
- Travou mais de 45 min: avisar e cortar escopo.

## Caminho crítico
`M0 → M1 → G3`. Dependências externas: **K-5/K-3** (Kenzo) para M2 e **K-1 + M-1** para a aprovação aparecer na demo. Se atrasarem, o agente segue no domínio fake e a demo fica rotulada como simulada.
