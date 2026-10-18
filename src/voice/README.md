# src/voice — Conversação e Voz

**Dono:** Felipe. **Status:** funcional em lote e **em pedaços**. Pronto e testado: texto falado, guardas, sinais, gasto, síntese (`/api/voice/tts`, com texto vizinho para a entonação), pré-aquecimento (`/api/voice/warm`), reconhecimento em lote (`/api/voice/stt`), hook do microfone (`use-voice.ts`), **player com fila, busca antecipada e interrupção** (`player.ts`), **divisão em pedaços** (`chunker.ts`), **contrato do fluxo NDJSON** (`converse-events.ts`), **medida de latência** (`latency.ts`) e a página `/voz`. Falta: ligar ao `/api/converse` do Hyago (hoje a página usa o agente de texto, que devolve tudo de uma vez), reconhecimento em tempo real e palavras-chave. **Não verificado:** microfone real (o navegador do painel bloqueia o acesso); precisa de teste em Chrome com microfone.

**Responsabilidade:** o usuário fala e ouve o FoodPilot, com baixa latência e sem atrito.

## Entra
- Resposta do agente (texto em fluxo) e estados da conversa.

## Sai
- Texto transcrito + **sinais**: `velocidadeFala`, `interrompeu`, `silencioMs`, `origem: voz|texto`.
- Eventos de estado para a UI: ouvindo, processando, falando, erro, cancelado.

## Fala em português do Brasil
- Respostas curtas; ler no máximo 2 ou 3 opções, o resto na tela.
- Preços, horários e quantidades ditos de forma natural.

## Regras
1. **ElevenLabs** por adaptador (independente de fornecedor); **Web Speech API** (Chrome) como reserva; **texto sempre disponível**. Falha de voz nunca bloqueia a conversa.
2. **Interrupção:** quando o usuário fala por cima, a fala do agente para.
3. **Confirmação por voz:** só frase explícita e validada ("confirmo o plano"); a aprovação passa pelo backend com `planoId` e `versão`. Voz **não** tem fluxo transacional próprio.
4. Permissão de microfone **não** autoriza compra.
5. Chaves só no servidor (`.env`); nunca no navegador.
6. Medir **latência até a primeira palavra** e **custo** (caracteres e segundos); meta de latência a decidir após medir.

## Interface com as outras frentes
- **Para o agente (Hyago):** `POST /api/converse` (resposta em fluxo). Ver `docs/frentes.md`.
- **Para a UI (Malveste):** estados e legendas; a UI desenha o microfone e o texto.

## Testes
Microfone negado, ruído, provedor fora do ar, interrupção, queda para texto (aceite AC-12 do plano).

## Como testar agora
`npm run dev -- -p 8080` (porta padrão do time, a do redirect do OAuth do iFood) e abrir http://localhost:8080/voz no Chrome. Clique em **Falar**, diga algo e clique em **Parar**. Tocar no botão enquanto o Guide fala **interrompe** a fala. O campo de texto sempre funciona. O diagnóstico da última fala (texto, confiança, sinais, dados sensíveis removidos) aparece embaixo.

## Variáveis (`.env`, nunca no repositório)
`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` (padrão `eleven_flash_v2_5`), `ELEVENLABS_STT_MODEL` (padrão `scribe_v2`), `TTS_CHAR_BUDGET`, `STT_SECONDS_BUDGET`.

## Rotas
- `POST /api/voice/tts` `{ text }` → `audio/mpeg`. 503 se a voz estiver indisponível (a tela segue em texto).
- `POST /api/voice/stt` (corpo = áudio de uma fala) → `{ texto, confianca, duracaoS, redacoes, injecao }`. O texto já vem **sem dados sensíveis** e `injecao` sinaliza tentativa de manipular o agente.
- Ambas: origem same-origin, corpo limitado, erros sanitizados e **sem depender de `MCP_MODE`**.

## Fluxo em pedaços (contrato com o backend)
O backend (`/api/converse`, Hyago) responde em **NDJSON**, um evento por linha, conforme `converse-events.ts`: `ack` (reconhecimento imediato, opcional), `speech {seq, text, final?}` (um pedaço para falar), `screen {event, payload}` (para a tela), `done {turnId}` e `error {code, reply}`. A voz toca o primeiro `speech` assim que chega e já busca o áudio dos próximos. Orçamento de latência e regras para o backend: `docs/AGENTE_CONVERSA_E_FLUXO.md` §4.4.

## Modo conversa (sem as mãos)
Na página `/voz`, ligar **Modo conversa**: o Guide escuta, **para sozinho** quando você cala (700 ms para falas curtas, 1 s para normais), reconhece, espera a resposta e fala, e **escuta de novo**. **Falar por cima** do Guide (voz forte e sustentada por ~350 ms) interrompe a fala. Lógica em `session.ts` e `endpoint.ts`, testada com peças falsas; **os tempos e níveis precisam de ajuste em teste humano**. Limites por visitante em `rate-limit.ts` e palavras-chave em `keyterms.ts`. Plano e provas: `docs/VOZ_PLANO_DE_QUALIDADE.md`.
