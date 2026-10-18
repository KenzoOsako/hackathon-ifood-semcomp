# Plano de implementação — Voz (Felipe) × Agente (Hyago)

18/10/2026, ~00h. Base: feedback do Felipe ao esboço de integração (ver `docs/PLANO_AGENTE.md`, "Integração com a voz: ajustes do Felipe").
Objetivo: os dois trabalham em paralelo, cada um na sua pasta, e só juntam no ponto de integração. Merge na `main` continua com o Kenzo.

## Regras para não colidir
| | Felipe | Hyago |
|---|---|---|
| Pastas | `src/voice/**`, `src/app/voz/**`, `src/app/api/voice/**` | `src/agent/**`, `src/prompts/**`, `src/evals/**`, `src/app/api/converse/route.ts` |
| Só lê do outro | `src/agent/frases.ts`, `src/agent/types.ts` | `src/voice/signals.ts`, `src/voice/converse-events.ts` |
- Sem dependência nova nas fatias abaixo (evita conflito no `package-lock.json`).
- `contexto/estado-atual.md`: cada um acrescenta **uma seção própria no fim**; conflito se resolve juntando as duas.
- Mudou algo do contrato abaixo? Avisa o outro antes de commitar.

## Fase 0 — Congelar o contrato (juntos, ~15 min)
1. **`confianca` em `sinais`** (Felipe, no PR #18 antes do merge): `confianca: z.number().min(0).max(1).optional()` no `VoiceSignalsSchema`. O schema é `strictObject`: sem isso o agente recusa o campo.
2. **Faixas de confiança:** `< 0,6` a voz não envia e pede "Pode repetir?"; `0,6–0,85` envia e o agente confirma antes de buscar; `≥ 0,85` segue normal. Limiares em constante dos dois lados, calibrados na Fase 2.
3. **Frase de espera em duas camadas:** a voz toca uma frase **neutra** em cache logo depois do STT ("Hum, um instante."), sempre. O agente só manda `fraseEspera` quando decide buscar ("Deixa eu ver as opções.").
4. **Frases fixas do agente** viram arquivo próprio `src/agent/frases.ts` (Hyago, primeiro commit da Fase 1). O Felipe pré-gera o áudio a partir dele. Textos de hoje: os de `FRASES` em `src/agent/orchestrator/index.ts`.
5. **Login:** o agente mantém o 401 `{ code: "IFOOD_LOGIN", reply, loginUrl }`. A voz mostra o botão.
6. **Ordem de merge pedida ao Kenzo:** #17 (agente + MCP) → #18 (voz) → #19 (domínio). Depois disso, cada um abre a sua branch nova a partir da `main`.

## Fase 1 — Em paralelo (~2 h cada)
**Felipe** — branch `feat/felipe-voz-latencia`
- F1. Frase neutra em cache tocando ~0,1 s depois do STT, antes do request ao `/api/converse`.
- F2. Áudio pré-gerado das frases de `src/agent/frases.ts` (cache por texto; se o texto não estiver no cache, TTS normal).
- F3. `code: IFOOD_LOGIN` → botão "Conectar iFood" (`/api/auth/login`); ao abrir a `/voz`, consultar `/api/auth/status`.
- F4. Confiança: enviar `sinais.confianca`; abaixo de 0,6 pedir para repetir sem chamar o backend.
- F5. Painel de latência exporta as rodadas (STT, primeiro pedaço do backend, TTS, primeira palavra) para cálculo de p50/p95.

**Hyago** — branch `feat/hyago-gemini-inferencia` (já existe; rebase na `main` depois da Fase 0)
- H1. `src/agent/frases.ts` com as frases fixas (primeiro commit; avisar o Felipe).
- H2. Medição do backend: script que roda a jornada do aniversário N vezes contra `next start -p 8080`, descarta o 1º turno e calcula p50/p95 de `interpretar`, `dominio` e `responder`.
- H3. Pressa por sinais: `interrompeu` ou fala curta e seca rebaixa para L0 **só sem pergunta pendente** e junto com a regex de pressa existente. Testes: "sim" a uma pergunta não é pressa.
- H4. Confiança na faixa média (0,6–0,85): o agente confirma o que entendeu antes de buscar; a confirmação não conta no teto de 3 perguntas.
- H5. Privacidade da fala: checagem em código no `responder` (endereço completo, telefone, nome) com fallback para texto pronto; endereço só como "Casa"/"Trabalho".
- H6. Inferência rotulada (fatia 1 do plano do agente): `fonte: dito | inferido`, no máximo 2 sugestões; o C6 passa.

O que cada um testa sozinho: Felipe com o agente por regras ou o JSON gravado; Hyago com `/api/converse` direto (texto + `sinais` simulados) e as evals.

## Fase 2 — Integração e medição (juntos, ~45 min)
1. Branch local `integ/voz-agente` = `main` + as duas branches da Fase 1 (não vai para o GitHub).
2. `npm run build && MCP_MODE=real npx next start -p 8080`, login iFood, `/voz`.
3. 5+ rodadas da jornada do aniversário falada, do 2º turno em diante; p50/p95 por etapa juntando o painel da voz (F5) e o script do backend (H2). Espaçar as rodadas se a chave do Gemini estiver sem faturamento.
4. Calibrar os limiares de confiança com as gravações.
5. **Decisão:** se a frase neutra em cache já põe a primeira palavra em ~1 s e a resposta com conteúdo é aceitável, o NDJSON fica de fora. Senão, entra como Fase 4 (Hyago, contrato `converse-events.ts` já pronto).

## Fase 3 — PRs
- Cada um abre o seu PR a partir da sua branch (não da `integ`). Ordem: Felipe primeiro (o agente depende de `confianca` só se a Fase 0 não entrou pelo #18), depois Hyago.
- Antes do PR: `npm run typecheck && npm run lint && npm test && npm run build` e a seção própria no `contexto/estado-atual.md`.

## Pendências fora das fases
- Conferir a retenção de dados da ElevenLabs (TTS) e do Gemini para as nossas contas.
- Plano na tela de verdade (Malveste): a interface ouve o mesmo evento `screen`.
