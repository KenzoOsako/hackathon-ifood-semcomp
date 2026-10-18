# Voz × Backend: passagem para o Hyago

Para quem trabalha no agente (`src/agent`, `src/prompts`) e quer ouvir o resultado falando. A voz é **só o meio de áudio** (áudio → texto → nosso backend → frases → fala). O motor é o backend: contexto, MCP e análise crítica. A voz nunca decide nada de negócio.

Mantenedor da voz: Felipe. Branch: `feat/felipe-voz-stt`. O código de voz está em `src/voice/*`, as rotas em `src/app/api/voice/*` e o laboratório em `/voz`.

## 1. Ouvir seu agente falando (2 minutos)
```bash
npm install
npm run dev -- -p 8080        # abra http://localhost:8080/voz no Chrome (8080 é a porta padrão do time: é o redirect do OAuth do iFood)
```
- A chave da ElevenLabs e o `ELEVENLABS_VOICE_ID` ficam no `.env` local (ver `.env.example`).
- Sem chave, o texto funciona e a fala cai no `speechSynthesis` do navegador.
- Digite no campo de texto ou use **Falar**. O laboratório chama o seu `/api/converse` e fala a `resposta`.
- Use fone de ouvido no Modo conversa (sem as mãos), senão o alto-falante vaza no microfone.
- O painel mostra latência por etapa (STT, backend, TTS, até a primeira palavra) e o diagnóstico do microfone.

## 2. Contrato (o que a voz manda e espera)

**Entrada** (`ConverseInputSchema`, já é o seu): `{ texto, origem: "voz"|"texto", sinais?, hipoteses? }`.
- `texto` já vem reconhecido e **com dados sensíveis mascarados** (CPF, CNPJ, cartão, e-mail).
- `sinais` (`VoiceSignalsSchema`, `src/voice/signals.ts`): `origem`, `interrompeu`, `palavras`, `silencioMs`. Use para decidir L0/L1/L2 (fala curta e seca = pressa).
- `hipoteses`: ainda não enviado. A confiança do reconhecimento (`confianca`, 0 a 1) está na `Utterance` e pode ir junto se você quiser usar.

**Saída que a voz entende** (`src/voice/converse-events.ts`, NDJSON, um evento por linha):

| Evento | Quando | A voz faz |
|---|---|---|
| `ack {text}` | trabalho vai demorar ("Deixa eu ver as opções.") | fala já |
| `speech {seq, text, final?}` | um pedaço para falar, em ordem (`seq` de 0 em diante) | fala assim que chega, enquanto você processa o resto |
| `screen {event, payload}` | plano para a tela | repassa à interface, não fala |
| `done {turnId}` | fim do turno | libera o microfone (modo sem as mãos) |
| `error {code, reply}` | falha | fala o `reply` (frase curta e segura) |

**Hoje o seu `/api/converse` devolve um JSON único** (`AgentReply`). Isso **já funciona sem você mudar nada**: `src/voice/converse-client.ts` converte o JSON nos eventos acima (`fraseEspera` vira `ack`, `resposta` vira `speech`, `tela` vira `screen`). Se um dia a rota responder `Content-Type: application/x-ndjson`, o mesmo cliente repassa os eventos direto.

### O que a gente combinou que é flexível (decisão sua)
O formato da resposta do `/api/converse` pode mudar. Se você migrar para NDJSON, siga `converse-events.ts` e rode `npm test`: o `converse-client.test.ts` cobre os dois formatos. Mudar o schema dos eventos exige avisar a voz.

## 3. Por que streaming vale a pena
Orçamento de latência até a primeira palavra: STT ≤ 600 ms + 1º pedaço do backend ≤ 700 ms + 1º byte do TTS ≤ 450 ms ≤ **1800 ms**. Medido na máquina do Felipe (modo `dev`, após aquecer): STT 0,5 s, TTS 0,3 s, backend de regras 0,03 s, total cerca de 1,2 s.
Quando o LLM entrar, o turno do orquestrador vai passar de 1 s. Com JSON único, a pessoa espera tudo. Com `ack` na hora e `speech` por frase, ela ouve algo em < 1 s. A voz só precisa que o pedaço seja **uma frase completa** (ela divide frases longas sozinha; ver `src/voice/chunker.ts`).

## 4. Regras para o texto que vai ser falado
- Sem markdown, listas, `[` `]`, `*`, `#`: a voz remove, mas o texto fica estranho. Escreva como se fala.
- Frases curtas. A voz limita um pedaço a 600 caracteres e a fala total a ~1200.
- Preço, tempo e distância podem vir em notação normal ("R$ 39,90", "25 min", "1,2 km"): `src/voice/speech-text.ts` converte para falar ("39 reais e 90 centavos", "25 minutos", "1,2 quilômetros").
- Motivos só de campos reais (já é a sua regra de `respostaTemplate` / `falaRespeitaSnapshot`).
- **Aprovação:** a voz **nunca** aprova. `detectApprovalIntent` (`src/voice/guard.ts`) só reconhece a intenção ("aprovo o plano versão 2") e entrega o texto; quem valida versão e aprova é o seu backend, e a compra termina no iFood.
- O `texto` pode chegar com marcas como `[CPF]` quando houve dado sensível. Não peça nem repita esses dados.

## 5. O que já existe na voz (mapa)
| Arquivo | Para quê |
|---|---|
| `src/voice/stt.ts`, `tts.ts`, `keyterms.ts` | ElevenLabs STT (Scribe) e TTS (Flash v2.5), palavras-chave para acertar nomes |
| `src/voice/session.ts` + `use-voice.ts` | sessão de voz: gravar, fim de fala, interromper, modo sem as mãos (testada com peças falsas) |
| `src/voice/player.ts`, `chunker.ts` | fila de fala em pedaços, pré-busca do próximo, interrupção |
| `src/voice/converse-client.ts`, `converse-events.ts` | **ponte com o seu `/api/converse`** |
| `src/voice/guard.ts`, `http-guard.ts`, `rate-limit.ts`, `budget.ts` | segurança: mascara dados, mesma origem, limites por visitante, orçamento de caracteres e segundos |
| `src/voice/latency.ts` | marcas e metas de latência |
| `docs/VOZ_PLANO_DE_QUALIDADE.md` | matriz de qualidade, checklist do painel ElevenLabs, roteiro de teste humano |
| `src/voice/agent-prompt.md` | prompt do agente do painel ElevenLabs (laboratório; **não** é o seu prompt do backend) |

## 6. Como a gente trabalha
- Cada frente na sua branch; o Kenzo integra. Acumulamos trabalho antes do PR para não sobrecarregá-lo.
- Antes de subir: `npm run typecheck`, `npm run lint`, `npm test` (230 testes) e `npm run build`.
- Chaves só no `.env` local. Nunca no código nem em doc.
- Mudou o contrato de eventos, o schema de entrada ou o comportamento de aprovação? Avise no grupo e atualize este arquivo.

## 7. Pendências conhecidas
- Reconhecimento de fala bom com microfone fraco, mas confiança baixa ainda não faz o Guide pedir para repetir (proposta pronta, aguardando decisão).
- Fim de fala (700 ms / 1 s) e interrupção por voz precisam de ajuste fino com teste humano em Chrome.
- Limites de abuso são por processo; para deploy público em várias instâncias é preciso armazenamento compartilhado.
- O agente do painel da ElevenLabs está público (autenticação desligada). Ligar autenticação e allowlist de host antes de divulgar.
- Rotacionar as chaves da ElevenLabs e do iFood antes de tornar o repositório público.
