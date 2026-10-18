# DEMO-01 — Roteiro da demonstração "aniversário"

> Card Trello: DEMO-01 "roteiro e dados de demonstração" (criado com a Direção V2, `docs/DIRECAO_V2_OCASIAO.md` §7).
> Base: `main` em `70b6192` (merge do PR #27), 18/10/2026 ~02h15. **Documento de roteiro, não de funcionalidade:** tudo aqui descreve o que já existe na `main`; o que não foi verificado está marcado **[VERIFICAR NO ENSAIO]**.
> Rótulos: **REAL** (iFood MCP ao vivo) · **SIMULADO** (fixture/mock, deve aparecer rotulado) · **PLANEJADO** (não existe) · **BLOQUEADO**.

## 1. O que existe hoje (duas superfícies, dois fluxos)

A `main` tem **dois caminhos** que tocam o aniversário. Eles **não são a mesma jornada** e não devem ser misturados na fala.

| | A. Tela do agente `/agente` | B. Tela de voz `/voz` |
|---|---|---|
| Backend | `/api/chat` + `/api/confirm` (fluxo legado, K-1/K-5) | `/api/converse` (agente V2 do Hyago) |
| Frase da demo | "hoje é aniversário da minha namorada" | "Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme." |
| Resultado | 2 **alternativas** (bolo **ou** rosa); escolhe-se **uma** | Plano de ocasião em blocos (pizza + pipoca + presente) |
| Dados | Sempre **SIMULADO** (`fixtures/discovery.json`, m-8/m-9) | `MCP_MODE=mock`: **SIMULADO** (`src/agent/domain-fake`); `MCP_MODE=real` + login: **REAL** |
| Aprovação | Sim: botão "Aprovar" → `/api/confirm` → "Continue no iFood" com resumo | **Não há** aprovação HTTP do plano composto (K-3 está só no domínio, ver `docs/K3_PLANO_COMPOSTO.md`) |
| Evidência | `src/agent/exemplo-aniversario.test.ts`; jornada conferida no PR #25 | `src/agent/orchestrator/fase1.test.ts` ("jornada do aniversário no modo por regras"); `src/agent/domain-mcp/domain-mcp.test.ts` (respostas reais gravadas); prova ao vivo de 17/10 ~23h30 (`contexto/estado-atual.md`) |

**Consequência para o roteiro:** a prova de **MCP real** está em B; a prova de **aprovação + continuidade no iFood** está em A. A demo usa as duas, dizendo em voz alta qual é qual.

## 2. Pré-requisitos (checklist antes de subir ao palco)

- [ ] `main` atualizada, `npm run build` e `npm start` no notebook da demo (Chrome desktop).
- [ ] `.env` local com `MCP_MODE=real`, credenciais iFood, `LLM_PROVIDER`/`LLM_MODEL`/chave, `ELEVENLABS_*`. **Nunca** mostrar o `.env` na tela.
- [ ] Faturamento do Gemini ativo (cota gratuita dá 429 após ~15 chamadas/min — `estado-atual.md`, Gemini no agente).
- [ ] Login iFood feito com o usuário de teste **antes** do pitch (token de 2 h; refazer se o ensaio foi há mais de ~1h30).
- [ ] Rodar a jornada B real **no horário da apresentação** e anotar quais blocos vieram com loja real (pipoca e presente não tinham loja aberta à noite em 17/10).
- [ ] Segunda aba já aberta em `/agente` (jornada A) e terceira em `/agente/previa` (cenários fixos) para o plano B.
- [ ] Microfone testado no Chrome da demo; texto sempre disponível.
- [ ] Gravação de uma execução real anterior, **rotulada com data e commit**, como contingência (proposta §25.1).

## 3. Roteiro minuto a minuto (bloco "Demonstração central", ~2 min, proposta §25.2 1:10–3:10)

| # | Tempo | Ação (quem opera) | Entrada | Saída esperada | Rótulo |
|---|---|---|---|---|---|
| 1 | 0:00 | Abrir `/voz`; mostrar a faixa do topo (agente modo modelo/regras; dados reais/simulados) | — | Faixa indica `mcp=real` e o modo do agente | — |
| 2 | 0:10 | Falar (ou digitar) a ocasião | "Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme." | Frase neutra "Hum, um instante." se o agente demorar >100 ms; agente faz **1 pergunta** de quantidade | Voz: ElevenLabs REAL |
| 3 | 0:30 | Responder | "Umas seis." | Agente resume e **já fala o plano** (presente sugerido não gasta pergunta) | — |
| 4 | 0:45 | Responder | "Pode escolher." | Plano com blocos `pizza` (dito) + `pipoca` e `presente` (**sugestões rotuladas**); em modo real, `origem: real` | Pizza REAL; pipoca/presente: REAL **se houver loja aberta**, senão "Ainda não tenho opção para presente" (necessidade não atendida, dado real) |
| 5 | 1:05 | Narrar: "isso veio do iFood agora; o que não tem loja aberta, o agente diz que não tem — não inventa" | — | — | — |
| 6 | 1:15 | Trocar para a aba `/agente` e dizer: **"a aprovação de plano com várias lojas ainda está no domínio; aqui mostro a aprovação com dados simulados"** | — | — | SIMULADO |
| 7 | 1:20 | Digitar | "hoje é aniversário da minha namorada" | 2 opções: **Fatia de bolo de chocolate** (Bolos & Cia, R$ 16,90, frete R$ 4,99) e **Rosa vermelha** (Casa dos Presentes, R$ 29,90, frete R$ 9,90), com motivos vindos de `reasons` | SIMULADO (selo "Simulado") |
| 8 | 1:35 | Selecionar o bolo | toque em "Selecionar" | Revisão com **total confirmado R$ 21,89**, botão Aprovar habilitado | SIMULADO |
| 9 | 1:45 | Aprovar | botão "Aprovar" | "Continue no iFood" com resumo manual; **nenhum pedido enviado** | Resumo manual REAL (código); carrinho/pedido: **não existe** |
| 10 | 1:55 | Fechar: "a compra termina no app do iFood" | — | — | — |

Refinamento contextual (exigido em §25.1): se sobrar tempo no passo 4, dizer **"sem presente"** — o teste `fase1.test.ts` garante que a sugestão recusada sai do plano e não volta.

## 4. Dados reais vs simulados (o que dizer se perguntarem)

| Peça | Estado | Fonte |
|---|---|---|
| OAuth PKCE iFood + `searchOffers`/`getMerchant`/`getItem` | **REAL** (provado 17/10 ~22h–23h30) | `estado-atual.md`, PR #17 |
| Lojas e preços do bloco pizza em `/voz` com `MCP_MODE=real` | **REAL** | idem |
| Pipoca/presente em modo real | **REAL quando há loja aberta**; senão necessidade não atendida | idem; `domain-mcp.test.ts` |
| Plano em `/voz` com `MCP_MODE=mock` | **SIMULADO** (`src/agent/domain-fake`) | — |
| Bolo, rosa, fotos e logos em `/agente` | **SIMULADO** (`fixtures/discovery.json` m-8/m-9, `public/exemplos/`, `src/ui/lib/mock-media.ts`) | PR #25 |
| Interpretação com Gemini | REAL quando `LLM_PROVIDER=google`; senão **regras** (faixa da `/voz` mostra) | PR #22 |
| Voz (STT/TTS ElevenLabs) | REAL | PRs #18, #24, #26 |
| Aprovação do plano composto por HTTP/tela | **PLANEJADO** (domínio K-3 pronto, sem rota) | `docs/K3_PLANO_COMPOSTO.md` |
| Carrinho remoto, pedido, deeplink/transferência | **BLOQUEADO por decisão** (compra final no iFood; `/api/order` responde 410) | AGENTS.md |
| Eventos de feedback / painel de insights (INS-01/02) | **PLANEJADO** — não mostrar | — |

## 5. Falhas possíveis e plano B

| Falha | Sinal | Plano B |
|---|---|---|
| Token iFood expirado / sem login | `/voz` mostra "Conectar iFood" (`IFOOD_LOGIN`) | Clicar e logar (ensaiado); se falhar, seguir em texto com `MCP_MODE=mock` **dizendo "agora dados simulados"** ou mostrar a gravação rotulada |
| MCP lento (1,5–2,3 s por tool, ~2,2 s para conectar) | frase de espera longa | Narrar enquanto carrega; não repetir a fala |
| Sem loja aberta para pipoca/presente | "Ainda não tenho opção para presente" | Usar como **ponto forte** (não inventa); não trocar para mock no meio sem avisar |
| Gemini 429 / timeout | faixa mostra modo regras, ou resposta genérica | Seguir: o modo regras cobre esta jornada (teste `fase1.test.ts`) |
| Microfone/eco/ruído no auditório | confiança < 0,6 → "pode repetir?"; 0,6–0,85 → confirmação | Digitar no campo de texto (AC-12) |
| "R$100" lido como 100 pessoas (achado de 18/10, agente por regras) | resumo com número errado | Evitar falar valores no roteiro; se ocorrer, corrigir digitando |
| Modo sem as mãos instável (`VOZ_INTEGRACAO_BACKEND.md` §9) | microfone não reabre | Usar o botão do microfone a cada fala |
| "Copiar resumo" falha | "Não consegui copiar…" | Mostrar o resumo na tela; cópia no Chrome **[VERIFICAR NO ENSAIO]** |
| App/notebook cai | — | `/agente/previa` (cenários fixos, rotulados) ou gravação com data/commit |

## 6. Critérios de aceite do DEMO-01

1. O roteiro roda inteiro em ≤ 2 min em dois ensaios seguidos, no notebook e no Chrome da demo. **[VERIFICAR NO ENSAIO]**
2. Todo trecho simulado é anunciado em voz alta e visível na tela (selo "Simulado" ou faixa da `/voz`) — AC-15.
3. Pelo menos um bloco com `origem: real` aparece na jornada B no horário da demo (AC-03); se não aparecer, a demo declara P0 real não mostrado e usa a gravação rotulada.
4. Nenhuma frase afirma: compra concluída, carrinho criado no iFood, plano composto aprovável na tela, ganho de conversão/satisfação ou painel de insights.
5. Aprovação mostrada só após revisão com total confirmado; "Continue no iFood" diz que nenhum pedido foi enviado (AC-08, AC-10).
6. Plano B de texto exercitado em ensaio com microfone desligado (AC-12).

## 7. Pendências que não são deste card

- Rota/tela de aprovação do plano composto (K-3 → `/api/converse` + UI) — Kenzo/Malveste.
- Unificar `/agente` com `/api/converse` — Malveste/Hyago.
- Bolo e rosa não existem no `FakeDomain` do agente V2 — Hyago.
- Testes falados com Gemini real e medição com iFood real ainda não feitos (`estado-atual.md`, Fase 1).
