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

## Fase 0 — Congelar o contrato · **resolvida em 18/10 ~01h (Hyago), branch `feat/hyago-gemini-inferencia`**
O que entrou no código (o Felipe só consome):
- `src/voice/signals.ts`: `confianca` opcional (0 a 1) no `VoiceSignalsSchema`. Único toque na pasta da voz, combinado.
- `src/agent/frases.ts`: `FRASES` (movidas do orquestrador), `FRASES_FIXAS` (lista para pré-gerar áudio) e `LIMIARES_CONFIANCA = { repetir: 0.6, confirmar: 0.85 }`.
- `src/agent/contrato-voz.test.ts`: trava o contrato (confiança no schema, faixas em ordem, frases sem markdown e ≤ 600 caracteres, `fraseEspera` vira `ack` no cliente da voz).
- Login (401 `IFOOD_LOGIN` + `loginUrl`) e eventos (`converse-events.ts`) ficaram como estavam.
- Merge de #17, #18, #19 e #20 já feito pelo Kenzo.

Itens originais da Fase 0:
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

### Fase 1 do Hyago: passos e critério de sucesso (18/10 ~01h30)
Ordem pensada para medir antes de mexer e deixar o mais arriscado (LLM) por último. H1 (`frases.ts`) já entrou no PR #22.

| # | Passo | Pronto quando (verificável) | Tempo |
|---|---|---|---|
| H2 | **Medição do backend**: script que roda a jornada do aniversário N vezes contra o servidor, descarta o 1º turno e calcula p50/p95 de `interpretar`, `dominio`, `responder` e `total` | Com Gemini + MCP real em `next start -p 8080`, 5 rodadas geram uma tabela p50/p95 por etapa, registrada no `estado-atual.md` como linha de base | ~40 min |
| H3 | **Pressa por sinais** | Testes: `interrompeu` sem pergunta pendente → L0 e nenhuma pergunta; "sim"/"pode" (1 palavra) respondendo a uma pergunta → **não** vira L0; a regex de pressa continua valendo; evals por regras sem regressão | ~30 min |
| H4 | **Confirmação por confiança** | Testes: `confianca` 0,72 num pedido → o Guide confirma o que entendeu e **não** chama o domínio; "sim" em seguida → busca; a confirmação não conta no teto de 3 perguntas; ≥ 0,85 ou ausente → fluxo normal; < 0,6 (se chegar) → pede para repetir, sem LLM | ~40 min |
| H5 | **Privacidade da fala** | Testes: resposta do LLM com telefone, CEP ou endereço com número → cai no texto pronto; preço ("R$ 39,90"), tempo ("25 min") e distância ("1,2 km") **não** disparam | ~30 min |
| H6 | **Inferência rotulada** | `Necessidade.fonte` = `dito`/`inferido`; no máximo 2 inferidas; a fala chama de "sugestão"; recusada não volta na sessão; aceita vira `dito`; nunca contraria restrição dita. C6 passa com Gemini em 3 de 3 rodadas; evals reais sem regressão nos outros cenários | ~1h30 |
| — | **Fechamento** | `typecheck`, `lint`, `test`, `build` verdes; evals reais rodadas em ritmo; `estado-atual.md` com os números; PR aberto | ~20 min |

**Status 18/10 ~03h (branch `feat/hyago-agente-fase1`):** H2 a H6 implementados e testados offline (308 testes). Decisão do Hyago: sugestões **sem cota própria** (o teto é o do plano, 5 itens); sugestão não gasta pergunta. Falta: evals com Gemini (em ritmo) e a medição com iFood real (precisa de login).

**Sucesso da Fase 1 como um todo:** o agente decide sozinho quando perguntar, confirmar, sugerir ou ir direto, com teste provando cada regra, e temos a linha de base de tempo do backend para comparar na Fase 2.
**Cota do Gemini (decisão do Hyago): ficar dentro do limite gratuito.** H3, H4 e H5 são regras em código testadas offline, sem Gemini. H2 e H6 rodam em ritmo de no máximo ~8 chamadas por minuto (cada turno faz 2), com pausa entre turnos no script; uma jornada de 4 turnos leva ~1 min.
**Depende de:** login iFood no servidor da medição (H2).

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
