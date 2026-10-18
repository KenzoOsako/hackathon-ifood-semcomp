# DEMO-01 — Roteiro da demonstração "aniversário"

> Card Trello: DEMO-01 "roteiro e dados de demonstração" (criado com a Direção V2, `docs/DIRECAO_V2_OCASIAO.md` §7).
> Base: `main` em `70b6192` (merge do PR #27), 18/10/2026 ~02h15; revisado ~02h30 na mesma base. **Documento de roteiro, não de funcionalidade:** tudo aqui descreve o que já existe na `main`; o que não foi verificado está marcado **[VERIFICAR NO ENSAIO]**.
> Rótulos: **REAL** (iFood MCP ao vivo) · **SIMULADO** (fixture/mock, deve aparecer rotulado) · **PLANEJADO** (não existe) · **BLOQUEADO**.

> [!WARNING]
> **PR #29 (`feat/hyago-tela-guide`, "/agente ligada ao agente V2, do plano à sacola simulada") estava ABERTO** na revisão deste roteiro. Ele muda `/agente` e `src/ui/agent/agent-context.tsx`. Este roteiro segue a `main` atual; **revisar as seções 1, 2 e 3 depois que o #29 for integrado**.

## 1. O que existe hoje (duas superfícies, dois fluxos, dois modos)

A `main` tem **dois caminhos** que tocam o aniversário. Eles **não são a mesma jornada**, **exigem modos de backend diferentes** e não devem ser misturados na fala.

| | A. Tela do agente `/agente` | B. Tela de voz `/voz` |
|---|---|---|
| Backend | `/api/chat` + `/api/confirm` (fluxo legado, K-1/K-5) | `/api/converse` (agente V2 do Hyago) |
| **Modo exigido** | **Só `MCP_MODE=mock`**: com `real`, as duas rotas respondem **503 `UNAVAILABLE`** (`requireMockRequest` em `src/agent/http.ts`) | `mock` ou `real` (`src/app/api/converse/route.ts`) |
| Frase da demo | "hoje é aniversário da minha namorada" | "Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme." |
| Resultado | 2 **alternativas** (bolo **ou** rosa); escolhe-se **uma** | Plano de ocasião em blocos (pizza + pipoca + presente) |
| Dados | Sempre **SIMULADO** (`fixtures/discovery.json`, m-8/m-9) | `MCP_MODE=mock`: **SIMULADO** (`src/agent/domain-fake`); `MCP_MODE=real` + login: **REAL** |
| Aprovação | Sim, **de proposta local**: botão "Aprovar" → `/api/confirm` → "Continue no iFood" com resumo. Nenhum carrinho ou pedido é criado | **Não há** aprovação HTTP do plano composto (K-3 está só no domínio, ver `docs/K3_PLANO_COMPOSTO.md`). "Pode escolher" ou "aprovo" falados **não** são aprovação efetiva |
| Evidência | `src/agent/exemplo-aniversario.test.ts`; jornada conferida no PR #25; smoke HTTP de 18/10 (seção 2.4) | `src/agent/orchestrator/fase1.test.ts` ("jornada do aniversário no modo por regras"); `src/agent/domain-mcp/domain-mcp.test.ts` (respostas reais gravadas); prova ao vivo de 17/10 ~23h30 (`contexto/estado-atual.md`) |

**Consequência para o roteiro:** a prova de **MCP real** está em B (instância real); a prova de **aprovação de proposta local + continuidade no iFood** está em A (instância mock). **Trocar de aba não troca o modo do backend**: são necessárias **duas instâncias** (seção 2).

## 2. Preparação: duas instâncias isoladas

### 2.1 Por que duas e como isolar

| Camada | Instância REAL | Instância MOCK | Como fica isolado |
|---|---|---|---|
| URL | `http://localhost:8080` | `http://127.0.0.1:3001` | Hosts diferentes (ver "sessão") |
| Porta | **8080**, porque o redirect OAuth cadastrado é `http://localhost:<IFOOD_CALLBACK_PORT>/callback` (`src/mcp/real/oauth.ts`, `src/app/callback/route.ts`). Não mudar porta nem host | 3001 (qualquer porta livre) | — |
| Configuração | `.env` local com credenciais e `IFOOD_CALLBACK_PORT=8080` (ou `IFOOD_REDIRECT_URI` igual ao portal); `MCP_MODE=real` | `MCP_MODE=mock` definido **no terminal**, que tem prioridade sobre o `.env` (ordem de carga do Next: `process.env` antes de `.env*`, `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`) | `MCP_MODE` é lido em tempo de requisição no servidor (`process.env.MCP_MODE`), sem `NEXT_PUBLIC_`; um único build serve as duas |
| Processo | terminal 1 | terminal 2 | Processos separados; sessões e login iFood ficam **em memória de cada processo** (`src/agent/visitor-session.ts`, `src/mcp/real/oauth.ts`). Reiniciar a instância real **perde o login** |
| Sessão (cookie) | `foodpilot_visitor` do host `localhost` | `foodpilot_visitor` do host `127.0.0.1` | **Cookies não distinguem porta.** As duas instâncias usam o mesmo nome de cookie, sem `Domain`; se ambas estivessem em `localhost`, a mock receberia o cookie da real, não o reconheceria e o **sobrescreveria** (`resolve` cria sessão nova), desligando o login iFood da real. Por isso a mock usa `127.0.0.1`. Para isolamento extra, abrir a mock numa janela anônima ou outro perfil do Chrome |

> [!IMPORTANT]
> Rodar **um** `npm run build` com as instâncias paradas e depois subir as duas a partir do mesmo build. **Não** rodar builds concorrentes no mesmo checkout (as duas gravam em `.next/`) nem rebuildar com as instâncias no ar.

### 2.2 Comandos (PowerShell, a partir de `work\contexto-final`)

```powershell
# 0) Uma vez, com nada rodando
npm run build

# 1) Terminal 1 — instância REAL (usa o .env local; não exibir o .env na tela)
$env:MCP_MODE = "real"; npx next start -p 8080

# 2) Terminal 2 — instância MOCK
$env:MCP_MODE = "mock"; npx next start -p 3001
```

`$env:` vale só para aquele terminal. Conferência rápida (não expõe credenciais):

```powershell
Invoke-RestMethod http://localhost:8080/api/auth/status   # esperado: modo = real
Invoke-RestMethod http://127.0.0.1:3001/api/auth/status   # esperado: modo = mock
```

### 2.3 URLs de cada etapa

| Etapa | URL | Instância |
|---|---|---|
| Login iFood (via botão "Conectar iFood" da `/voz`) | `http://localhost:8080/voz` → `/api/auth/login` → iFood → `http://localhost:8080/callback` | REAL |
| Jornada B (plano por voz/texto) | `http://localhost:8080/voz` | REAL |
| Jornada A (bolo ou rosa, aprovação local) | `http://127.0.0.1:3001/agente` | MOCK |
| Plano B visual (cenários fixos, não chamam API) | `http://127.0.0.1:3001/agente/previa` | MOCK |

### 2.4 O que já foi verificado desta preparação (18/10, ~02h27)

Com um build da `main` `70b6192` e as duas instâncias acima, **sem `.env`** (logo sem login iFood), por HTTP via PowerShell:
- `localhost:8080/api/auth/status` → `{"modo":"real","conectado":false}`; `POST /api/chat` → **503 `UNAVAILABLE`** (confirma o problema).
- `127.0.0.1:3001`: `POST /api/chat` "hoje é aniversário da minha namorada" → `ESCOLHENDO_OPCAO` com Bolos & Cia e Casa dos Presentes; escolher o bolo → `AGUARDANDO_CONFIRMACAO`, total 2189 centavos, `confirmed`; `POST /api/confirm` → `PROPOSTA_APROVADA`. Cookie gravado com domínio `127.0.0.1`.
- **Não verificado:** login iFood real, jornada B real, Chrome com as duas abas, voz, LLM real.

### 2.5 Checklist antes de subir ao palco

- [ ] `main` atualizada; build único; as duas instâncias no ar (2.2) e conferidas.
- [ ] `.env` local com credenciais iFood, `LLM_PROVIDER`/`LLM_MODEL`/chave, `ELEVENLABS_*`. **Nunca** mostrar o `.env` na tela.
- [ ] Faturamento do Gemini ativo (cota gratuita dá 429 após ~15 chamadas/min — `estado-atual.md`, Gemini no agente).
- [ ] Login iFood feito em `localhost:8080/voz` com o usuário de teste **antes** do pitch (token de 2 h; refazer se o ensaio foi há mais de ~1h30 ou se a instância real reiniciou).
- [ ] Rodar a jornada B real **no horário da apresentação** e anotar quais blocos vieram com loja real (pipoca e presente não tinham loja aberta à noite em 17/10).
- [ ] Abas abertas: `localhost:8080/voz`; `127.0.0.1:3001/agente` (de preferência em janela anônima); `127.0.0.1:3001/agente/previa`.
- [ ] Microfone testado no Chrome da demo; texto sempre disponível.
- [ ] Gravação de uma execução real anterior, **rotulada com data e commit**, como contingência (proposta §25.1).

## 3. Roteiro minuto a minuto (bloco "Demonstração central", ~2 min, proposta §25.2 1:10–3:10)

| # | Tempo | Ação (quem opera) | Entrada | Saída esperada | Rótulo |
|---|---|---|---|---|---|
| 1 | 0:00 | Abrir `http://localhost:8080/voz`; mostrar a faixa do topo (agente modo modelo/regras; dados reais/simulados) | — | Faixa indica dados reais e o modo do agente | — |
| 2 | 0:10 | Falar (ou digitar) a ocasião | "Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme." | Frase neutra "Hum, um instante." se o agente demorar >100 ms; **esperado** 1 pergunta de quantidade (ver 3.1: com LLM real isso **varia**) | Voz: ElevenLabs REAL |
| 3 | 0:30 | Responder | "Umas seis." | Agente resume e fala o plano (presente sugerido não gasta pergunta) | — |
| 4 | 0:45 | Responder | "Pode escolher." | Plano com blocos `pizza` (dito) + `pipoca` e `presente` (**sugestões rotuladas**); em modo real, `origem: real`. **Não é aprovação** | Pizza REAL; pipoca/presente: REAL **se houver loja aberta**, senão "Ainda não tenho opção para presente" (necessidade não atendida, dado real) |
| 5 | 1:05 | Narrar: "isso veio do iFood agora; o que não tem loja aberta, o agente diz que não tem — não inventa. Aprovar um plano com várias lojas ainda não está na tela" | — | — | Aprovação de plano: PLANEJADO |
| 6 | 1:15 | Trocar para a aba `http://127.0.0.1:3001/agente` e dizer: **"agora outra instância, com dados simulados, para mostrar a aprovação de uma proposta"** | — | — | SIMULADO |
| 7 | 1:20 | Digitar | "hoje é aniversário da minha namorada" | 2 opções: **Fatia de bolo de chocolate** (Bolos & Cia, R$ 16,90, frete R$ 4,99) e **Rosa vermelha** (Casa dos Presentes, R$ 29,90, frete R$ 9,90), com motivos vindos de `reasons` | SIMULADO (selo "Simulado") |
| 8 | 1:35 | Selecionar o bolo | toque em "Selecionar" | Revisão com **total confirmado R$ 21,89**, botão Aprovar habilitado | SIMULADO |
| 9 | 1:45 | Aprovar | botão "Aprovar" | "Continue no iFood" com resumo manual; **nenhum pedido enviado, nenhum carrinho criado** | Aprovação de proposta local (código real sobre dados SIMULADOS); carrinho/pedido: **BLOQUEADO** |
| 10 | 1:55 | Fechar: "a compra termina no app do iFood" | — | — | — |

Refinamento contextual (exigido em §25.1): se sobrar tempo no passo 4, dizer **"sem presente"** — o teste `fase1.test.ts` garante que a sugestão recusada sai do plano e não volta.

### 3.1 Número de perguntas: resultado a verificar, não garantia

"Exatamente uma pergunta" só está **provado no modo por regras** (`fase1.test.ts`: `perguntasFeitas` = 1; `domain-mcp.test.ts`). Com Gemini, a eval do cenário (`src/evals/cenarios.ts`) exige **no máximo 1**, e evals com LLM real tiveram falhas (`estado-atual.md`). O código garante só o **teto de 3** perguntas por sessão. **[VERIFICAR NO ENSAIO]** com o LLM real e anotar o que aconteceu.

| Variação | Como seguir |
|---|---|
| 0 perguntas (plano já no 1º turno) | Pular os passos 3 e 4; narrar "entendeu sem perguntar" |
| Pergunta outra coisa (orçamento do presente, horário) | Responder "pode escolher" |
| 2 ou 3 perguntas | Responder "pode escolher" a cada uma; se estourar o tempo, seguir para o passo 6 |
| Confirmação "Entendi: … É isso?" (confiança de voz 0,6–0,85) | Responder "sim" (não conta como pergunta) |
| "Pode repetir?" (confiança < 0,6) | Repetir uma vez; depois digitar |
| Plano sem pipoca/presente sugeridos | Narrar o que veio; não prometer as sugestões |

## 4. Dados reais vs simulados (o que dizer se perguntarem)

| Peça | Estado | Fonte |
|---|---|---|
| OAuth PKCE iFood + `searchOffers`/`getMerchant`/`getItem` | **REAL** (provado 17/10 ~22h–23h30) | `estado-atual.md`, PR #17 |
| Lojas e preços do bloco pizza em `/voz` com `MCP_MODE=real` | **REAL** | idem |
| Pipoca/presente em modo real | **REAL quando há loja aberta**; senão necessidade não atendida | idem; `domain-mcp.test.ts` |
| Plano em `/voz` com `MCP_MODE=mock` | **SIMULADO** (`src/agent/domain-fake`) | — |
| Bolo, rosa, fotos e logos em `/agente` (instância mock) | **SIMULADO** (`fixtures/discovery.json` m-8/m-9, `public/exemplos/`, `src/ui/lib/mock-media.ts`) | PR #25 |
| Aprovação de proposta local em `/agente` | Código **real** de domínio sobre dados **SIMULADOS**; só existe com `MCP_MODE=mock` | `src/app/api/confirm/route.ts` |
| Interpretação com Gemini | REAL quando `LLM_PROVIDER=google`; senão **regras** (faixa da `/voz` mostra) | PR #22 |
| Voz (STT/TTS ElevenLabs) | REAL | PRs #18, #24, #26 |
| Aprovação do plano composto por HTTP/tela | **PLANEJADO** (domínio K-3 pronto, sem rota) | `docs/K3_PLANO_COMPOSTO.md` |
| Carrinho remoto, pedido, deeplink/transferência | **BLOQUEADO por decisão** (compra final no iFood; `/api/order` responde 410) | AGENTS.md |
| Eventos de feedback / painel de insights (INS-01/02) | **PLANEJADO** — não mostrar | — |

## 5. Falhas possíveis e plano B

| Falha | Sinal | Plano B |
|---|---|---|
| Token iFood expirado / sem login | `/voz` mostra "Conectar iFood" (`IFOOD_LOGIN`) | Clicar e logar em `localhost:8080` (ensaiado); se falhar, usar `http://127.0.0.1:3001/voz` (mock) **dizendo "agora dados simulados"** ou mostrar a gravação rotulada |
| `/agente` mostra erro / 503 | aba aberta na instância real (`localhost:8080`) | Usar a aba `127.0.0.1:3001/agente`; não tentar "trocar o modo" com o servidor no ar |
| Login iFood "cai" depois de usar a outra aba | as duas instâncias foram abertas em `localhost` e o cookie foi sobrescrito | Manter a mock em `127.0.0.1` (ou janela anônima) e refazer o login na real |
| Instância real reiniciada | "Conectar iFood" volta a aparecer | Refazer o login (estado em memória) |
| Porta 8080 ocupada | `next start` não sobe | Liberar a porta; **não** trocar de porta (quebra o redirect OAuth cadastrado) |
| MCP lento (1,5–2,3 s por tool, ~2,2 s para conectar) | frase de espera longa | Narrar enquanto carrega; não repetir a fala |
| Sem loja aberta para pipoca/presente | "Ainda não tenho opção para presente" | Usar como **ponto forte** (não inventa); não trocar para mock no meio sem avisar |
| Gemini 429 / timeout | faixa mostra modo regras, ou resposta genérica | Seguir: o modo regras cobre esta jornada (teste `fase1.test.ts`) |
| Número de perguntas diferente do roteiro | ver 3.1 | ver 3.1 |
| Microfone/eco/ruído no auditório | confiança < 0,6 → "pode repetir?"; 0,6–0,85 → confirmação | Digitar no campo de texto (AC-12) |
| "R$100" lido como 100 pessoas (achado de 18/10, agente por regras) | resumo com número errado | Evitar falar valores no roteiro; se ocorrer, corrigir digitando |
| Modo sem as mãos instável (`VOZ_INTEGRACAO_BACKEND.md` §9) | microfone não reabre | Usar o botão do microfone a cada fala |
| "Copiar resumo" falha | "Não consegui copiar…" | Mostrar o resumo na tela; cópia no Chrome **[VERIFICAR NO ENSAIO]** |
| App/notebook cai | — | `127.0.0.1:3001/agente/previa` (cenários fixos, rotulados) ou gravação com data/commit |

## 6. Critérios de aceite do DEMO-01

1. O roteiro roda inteiro em ≤ 2 min em dois ensaios seguidos, no notebook e no Chrome da demo, com as duas instâncias da seção 2. **[VERIFICAR NO ENSAIO]**
2. Todo trecho simulado é anunciado em voz alta e visível na tela (selo "Simulado" ou faixa da `/voz`) — AC-15.
3. Pelo menos um bloco com `origem: real` aparece na jornada B no horário da demo (AC-03); se não aparecer, a demo declara P0 real não mostrado e usa a gravação rotulada.
4. Nenhuma frase afirma: compra concluída, carrinho criado no iFood, plano composto aprovável na tela, "pode escolher" como aprovação, ganho de conversão/satisfação ou painel de insights.
5. Aprovação mostrada só após revisão com total confirmado, e descrita como aprovação de **proposta local**; "Continue no iFood" diz que nenhum pedido foi enviado (AC-08, AC-10).
6. Plano B de texto exercitado em ensaio com microfone desligado (AC-12).
7. O número de perguntas observado com o LLM real foi anotado no ensaio e a variação correspondente da seção 3.1 foi treinada.

## 7. Pendências que não são deste card

- Revisar este roteiro após a integração do PR #29 (`/agente` no agente V2).
- Rota/tela de aprovação do plano composto (K-3 → `/api/converse` + UI) — Kenzo/Malveste.
- Unificar `/agente` com `/api/converse` — Malveste/Hyago (escopo do PR #29).
- Bolo e rosa não existem no `FakeDomain` do agente V2 — Hyago.
- Testes falados com Gemini real e medição com iFood real ainda não feitos (`estado-atual.md`, Fase 1).
