# Plano de implementação — Agente Guide (backend)

> Frente **System Prompt e Fluxo de Agentes** (dono: Hyago). Base: [briefing](BRIEFING_AGENTE.md), comportamento em [AGENTE_CONVERSA_E_FLUXO.md](AGENTE_CONVERSA_E_FLUXO.md), gates do [Plano V2](PLANO_V2_PAPEIS_E_CRONOGRAMA.md). Janela: sáb 17/10 ~20h30 → dom 12h30. Cada marco termina com algo rodando e uma prova. Merge pelo Kenzo.
>
> **Atualização 17/10 ~21h30:** Hyago está **100% na frente do agente** e faz as colunas A e B (não há parceiro dedicado; o integrador está com fila de PRs). Trello não está sendo seguido pelo time: não é critério de PR. Ver [Estado e próximos passos](#estado-e-próximos-passos-1710-21h30).

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

## Estado e próximos passos (17/10 ~21h30)

### Onde estamos
| Marco | Estado |
|---|---|
| M0 | ✅ tipos, prompts `interpretar`/`responder`, formato de eval. ⚠️ LangChain instalado, **sem chamada a LLM real** (nenhum provedor configurado) |
| M1 | ✅ orquestrador S0–S7, domínio fake, `/api/converse`, runner de evals, tempos por etapa no log. ❌ evals com LLM real |
| M2 | 🟡 eventos de feedback registrados; troca para domínio/MCP real em andamento (abaixo); eval de motivo só cobre números em dígitos |
| M3/M4 | não iniciados |

Entrega: PR #14 (`feat/hyago-agente`), aguardando revisão.

### Trocar o mock pelo MCP real
1. **Provar o acesso (fora do app).** OAuth PKCE S256 com o cliente pré-registrado (`id.ifood.com.br`; o recurso `consumer-mcp.ifood.com.br/marketplace` anuncia esse servidor em `/.well-known/oauth-protected-resource/marketplace`; sem registro dinâmico), depois `tools/list`, `listAddresses` e `searchOffers` por vertical (pizza/RESTAURANT, pipoca/GROCERIES, presente/SHOPPING). Resultado vai para `contexto/feedback-mcp.md`. Também responde o gate de verticais da V2.
2. **Cliente MCP real com OAuth no app.** Transporte Streamable HTTP (`@modelcontextprotocol/sdk`, dependência a registrar), rotas `/api/auth/login` e `/api/auth/callback`, token só no servidor preso ao cookie de sessão, refresh com antecedência, `MCP_MODE=real` em `src/mcp/index.ts`, e o guarda `requireMockRequest` liberando real só com sessão autenticada. **Zona do Kenzo (D-012): precisa do aval dele ou ser feito por ele.**
3. **`McpDomain` do agente** em `src/agent/domain-mcp/` (zona do Hyago), mesma interface do `FakeDomain`:
   - `obterContexto` → `listAddresses` (um endereço: usar e informar; vários: perguntar — falta este passo no fluxo);
   - `buscarNecessidade` → `searchOffers` (`query`=categoria, `userLocation`, `resultKind: ITEM`, `merchantType` por vertical, teto em `refinements`) → normalização, elegibilidade e ranking do Kenzo (PR #16) → até 3 `OpcaoPlano` com motivo real;
   - `montarPlano`/`ajustarPlano` locais (generalizar o fake); `getItem`/`getMerchant` para frete e pedido mínimo;
   - rota escolhe o domínio por `MCP_MODE`; orquestrador e prompts não mudam; `origem` passa a `real`.
4. Plano B: se o acesso falhar, demo com domínio fake rotulado e integração mostrada à parte (G4).

### Latência (voz + LLM)
Ordem combinada: **medir antes de otimizar**.
1. Medir 2–3 modelos **pequenos** (trocando só `LLM_PROVIDER`/`LLM_MODEL`): tempo de `interpretar` e `responder` no log + evals.
2. Áudio **pré-gerado** para frases fixas (`FRASES` do orquestrador: encaminhar, recusar, repetir, espera).
3. **Frase de espera** imediata quando o `interpretar` decide montar (já devolvida em `fraseEspera`).
4. **Chunks no `responder`:** LLM em fluxo → corte por frase → checagem por frase contra o snapshot → TTS por frase. `/api/converse` passa a responder em fluxo (NDJSON: espera → frases → tela), alinhado ao contrato `resposta_parcial`/`evento_de_tela`/`resposta_final` e à branch `feat/felipe-voz-stt` do Felipe (fila de áudio, interrupção, NDJSON). O `interpretar` não ganha com fluxo: mantê-lo pequeno.
5. STT em tempo real (Felipe) e cache de prompt do provedor.
6. Reserva: ElevenLabs Agents com nosso endpoint como Custom LLM, só se o resto não bastar.

### Resultado do passo 1 — acesso ao MCP comprovado (17/10 ~22h)
- OAuth PKCE com o cliente pré-registrado + usuário de teste: **token OK** (2 h, com refresh). Escopos: `mcp.user.addresses.read`, `mcp.discovery.{search,browse,recommendation,details}.read` + `capability.only-test-agent`.
- `tools/list`: **8 tools** (filtradas por escopo): listAddresses, searchOffers, browseOffers, getRecommendations, getMerchant, getItem, listVouchers, setVoucher.
- `listAddresses`: **0 endereços** no usuário de teste → usar coordenadas fixas do local da demo (USP São Carlos) ou pedir escopo de escrita para `createAddress`.
- `searchOffers` (ITEM) com RESTAURANT/GROCERIES/SHOPPING: **10 resultados reais em cada**. O item já traz `unitPrice`, `promotionalUnitPrice` e `merchant` com `isOpen`, `reviewRating`, `ratingCount`, `straightLineDistanceKm`, `minimumOrderAmount` e `deliveryMethod` (fee, promotionalFee, estimatedMinutes) → ranking sem `getMerchant` por opção.
- **Latência medida:** conectar ~2,2 s; cada tool 1,5–2,3 s. O MCP pesa mais que o TTS. Implicações: cliente MCP aberto por sessão, buscas por necessidade em paralelo, frase de espera.
- Cuidados para o `McpDomain`: filtrar `isOpen` e loja com método de entrega; "presente" é amplo e ruidoso (pede pergunta ou termo mais específico); combos com `optionGroups` obrigatórios viram pendência; nota vem como float (arredondar); `agentHints` do servidor são texto para modelo, não instrução para o nosso código.
- Teste feito com script isolado (fora do repo); amostras de catálogo guardadas localmente para montar o adaptador.

## Plano seguinte: Gemini, inferência e cenários com MCP (17/10 ~23h30, Hyago)

### Onde estamos
- PR #17 aberto: agente com MCP real (jornada do aniversário comprovada ao vivo, `origem: real`).
- Gemini conectado via LangChain. Correção necessária: o Gemini rejeita `exclusiveMinimum` no `response_schema` (`orcamento.max` passou de `positive()` para `min(1)`).
- Medição nas 11 evals: `gemini-3.5-flash-lite` é o escolhido (1,0–2,1 s por turno). `3.8-flash` estoura o timeout de 8 s; `3.1-flash-lite` é irregular (até 41 s); `2.5-flash` está indisponível para chaves novas.
- Erro real só no C6: o modelo foi literal e não inferiu pipoca (filme) nem presente (aniversário). As demais falhas foram 429 (cota gratuita por minuto).
- A interpretação é nossa (Gemini no `/api/converse`). ElevenLabs só faz STT/TTS na branch do Felipe; o `agent-prompt.md` dele é do laboratório da ElevenLabs, não do backend.

### Decisão de produto (Hyago): inferir um pouco, confirmar o que o usuário disser
- O Guide **infere** necessidades implícitas da ocasião (filme → pipoca; aniversário → presente; churrasco → carvão/bebida sem álcool) e as traz como **sugestão rotulada**.
- O que o usuário **diz** vira necessidade confirmada e preferência da sessão. Sugestão aceita é promovida; sugestão recusada sai e não volta na sessão.
- Limites: no máximo 2 sugestões por ocasião; sugestão nunca conta como pergunta (teto de 3 continua); nunca contraria uma restrição dita; o motivo da sugestão é a própria fala ("porque vocês vão ver um filme"), sem inventar dado.
- Preferências ficam **só na sessão**. Guardar entre sessões é dado pessoal: só com consentimento separado (regra V2), fora deste ciclo.

### Fatias (cada uma termina com evals; ordem de execução logo abaixo)
1. **Inferência com rótulo.** `Necessidade.fonte: "dito" | "inferido"`; prompt com exemplos; regras em código (máx. 2 inferidas, recusada não volta, aceita vira "dito"); plano e fala marcam "sugestão"; o C6 passa.
2. **Preferências da sessão.** Sabor, restrição, teto e critério ("sempre a mais rápida") ditos pelo usuário ficam na sessão e entram nas próximas buscas e ajustes.
3. **Evals contra o MCP.** Gravador opcional no `McpDomain` (`MCP_RECORD=<pasta>` salva as respostas de `searchOffers`) e domínio de *replay* que responde com as gravações: cenários com dados reais, determinísticos, offline e sem cota do MCP. Uma bateria "ao vivo" pequena roda à mão com login.
4. **Cenários novos (~20).** Restrição (sem lactose), teto rígido/flexível, mudança de ideia, ajustes em sequência, pressa/interrupção, ruído de STT, aprovação de versão antiga/"sim" solto/sem plano, categoria sem loja aberta, sugestão aceita/recusada, preferência reaproveitada.
5. **Cota do Gemini.** Runner das evals com ritmo (`EVAL_RPM`, pausa entre turnos) e cenário avulso (`-t`); no adaptador, uma nova tentativa curta em 429 dentro do timeout; para a demo, faturamento ativo na chave.
6. **Ponta a ponta.** Jornada com Gemini + MCP real medindo cada etapa; com os números, decidir o NDJSON em fluxo com o Felipe.

### Ordem de execução (combinada 17/10 ~23h45): integrar com a voz antes de refinar
Motivo: a demo é a jornada falada de ponta a ponta. O turno com busca deve passar de 4 s (Gemini interpretar + MCP ~2 s + Gemini responder) contra a meta de 1,8 s da voz até a primeira palavra; a medição real decide se streaming vale mais que cenários novos.
1. **Integração com o Felipe** (~1 h): branch local de teste com PR #17 + PR #18, `/voz` na porta 8080 com Gemini + MCP real, medindo STT, interpretar, MCP, responder e TTS. Merge na `main` continua com o Kenzo.
2. **Fatia 1, inferência rotulada** (~1 h): diferencial de personalização.
3. **Latência conforme a medição:** frase de espera e NDJSON em fluxo, com o Felipe (seção "Latência (voz + LLM)").
4. **Fatias 3 e 4:** evals com MCP gravado e cenários novos, como rede de segurança antes do congelamento.
5. **Fatia 2, preferências da sessão,** se sobrar tempo.
- Fatia 5 vira só faturamento ativo na chave do Gemini; ritmo e nova tentativa em 429 só se a cota atrapalhar.
