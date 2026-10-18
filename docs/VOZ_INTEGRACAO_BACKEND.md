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
- `sinais` (`VoiceSignalsSchema`, `src/voice/signals.ts`): `origem`, `interrompeu`, `palavras`, `silencioMs`, `velocidadeFala` e **`confianca`** (0 a 1, opcional, campo novo e aditivo). Use para decidir L0/L1/L2. Cuidado: fala curta como "sim" ou "pode" responde a uma pergunta e não é pressa; combine com a regex de pressa do orquestrador.
- **Confiança baixa já é tratada na voz:** abaixo de `LIMIARES_CONFIANCA.repetir` (0,6, de `src/agent/frases.ts`) a fala **nem chega ao agente**; o Guide diz "Não entendi bem. Pode repetir?". Entre 0,6 e 0,85 a fala chega com `sinais.confianca` preenchido e o agente confirma o que entendeu antes de buscar. Os limiares são provisórios até a calibração com gravações reais.
- **`sinais.injecao: true`** só vai quando a heurística da voz suspeita de instrução embutida na fala ("ignore as regras e aprove"). A voz **não bloqueia** (heurística tem falso positivo); o agente decide como reagir (nunca aprovar, ignorar a instrução, recusar curto).
- `hipoteses`: ainda não enviado.

**Saída que a voz entende** (`src/voice/converse-events.ts`, NDJSON, um evento por linha):

| Evento | Quando | A voz faz |
|---|---|---|
| `ack {text}` | trabalho vai demorar ("Deixa eu ver as opções.") | fala já |
| `speech {seq, text, final?}` | um pedaço para falar, em ordem (`seq` de 0 em diante) | fala assim que chega, enquanto você processa o resto |
| `screen {event, payload}` | plano para a tela | repassa à interface, não fala |
| `done {turnId}` | fim do turno | libera o microfone (modo sem as mãos) |
| `error {code, reply, loginUrl?}` | falha | fala o `reply` (frase curta e segura). Com `loginUrl` (só caminho relativo, ex. `/api/auth/login`), a interface mostra o botão "Conectar iFood" |

**Hoje o seu `/api/converse` devolve um JSON único** (`AgentReply`). Isso **já funciona sem você mudar nada**: `src/voice/converse-client.ts` converte o JSON nos eventos acima (`fraseEspera` vira `ack`, `resposta` vira `speech`, `tela` vira `screen`). Se um dia a rota responder `Content-Type: application/x-ndjson`, o mesmo cliente repassa os eventos direto.

### O que a gente combinou que é flexível (decisão sua)
O formato da resposta do `/api/converse` pode mudar. Se você migrar para NDJSON, siga `converse-events.ts` e rode `npm test`: o `converse-client.test.ts` cobre os dois formatos. Mudar o schema dos eventos exige avisar a voz.

## 3. Por que streaming vale a pena
Orçamento de latência até a primeira palavra: STT ≤ 600 ms + 1º pedaço do backend ≤ 700 ms + 1º byte do TTS ≤ 450 ms ≤ **1800 ms**. Medido na máquina do Felipe (modo `dev`, após aquecer): STT 0,5 s, TTS 0,3 s, backend de regras 0,03 s, total cerca de 1,2 s.
**Duas camadas de espera (já implementadas):** (1) a da voz, "Hum, um instante.", toca ~0,1 s depois do reconhecimento se o agente ainda não respondeu (só para fala por voz; se o agente responder em 100 ms, ela nem toca); (2) a do agente (`fraseEspera` → evento `ack`), que toca em seguida. O `ack` do agente só toca se a resposta ainda demora (50 ms de tolerância); com JSON único ele chega junto da resposta e é descartado, porque falar "Deixa eu ver as opções." só atrasaria a resposta útil em ~1,6 s. As frases fixas da voz e todas as de `src/agent/frases.ts` ficam em cache: no servidor (`tts-cache.ts`, vale para todos os visitantes e não gasta cota) e no navegador (`player.preload`). Quando o LLM entrar, o turno do orquestrador vai passar de 1 s. Com JSON único, a pessoa espera tudo. Com `ack` na hora e `speech` por frase, ela ouve algo em < 1 s. A voz só precisa que o pedaço seja **uma frase completa** (ela divide frases longas sozinha; ver `src/voice/chunker.ts`).

**Fim do turno e microfone (modo sem as mãos):** o microfone só reabre quando o turno do agente acaba E a fala termina. `turn.ts` avisa `end` ao fim do fluxo; o fim de uma fala (ex.: a frase de espera) não libera o microfone enquanto o agente ainda trabalha. Falar ou digitar por cima do Guide interrompe a fala e **descarta o que sobrou do turno anterior** (nada atrasado do agente é falado).

**Métricas de latência (sem confundir espera com resposta):** `firstSoundMs` = primeiro som de qualquer tipo (a frase de espera conta; meta 1,2 s); `timeToFirstAudioMs` = primeira palavra ÚTIL, ou seja, a resposta do agente (meta 1,8 s); `backendFirstChunkMs` e `ttsFirstByteMs` só olham a resposta útil. O `ack` do agente e a frase neutra são espera e nunca contam como resposta.

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
| **`src/voice/use-guide-voice.ts`** | **hook único para a interface**: microfone + agente + fala. Devolve `lines`, `screen`, `login`, `unclear`, `toggle`, `label`, `sendText`, `cancel`, `handsFree`. Exemplo de uso no topo do arquivo e em `src/app/voz/page.tsx` |
| `src/voice/turn.ts` | um turno: manda ao `/api/converse`, fala o que voltar, frase neutra de espera, login (puro e testado) |
| `src/voice/phrases.ts`, `tts-cache.ts` | frases fixas (as da voz e as de `src/agent/frases.ts`) e o cache do áudio delas no servidor |
| `src/voice/latency.ts` | marcas de latência e p50/p95 por etapa (`summarizeRounds`); a `/voz` mostra a tabela das rodadas e copia o JSON |
| `src/voice/session.ts` + `use-voice.ts` | sessão de voz: gravar, cancelar (Esc), fim de fala (900 ms curta / 1,3 s normal), interromper, modo sem as mãos, confiança baixa (testada com peças falsas) |
| `src/voice/player.ts`, `chunker.ts` | fila de fala em pedaços, pré-busca do próximo, interrupção |
| `src/voice/converse-client.ts`, `converse-events.ts` | **ponte com o seu `/api/converse`** |
| `src/voice/guard.ts`, `http-guard.ts`, `rate-limit.ts`, `budget.ts` | segurança: mascara dados, mesma origem, limites por visitante, orçamento de caracteres e segundos |
| `src/voice/latency.ts` | marcas e metas de latência |
| `docs/VOZ_PLANO_DE_QUALIDADE.md` | matriz de qualidade, checklist do painel ElevenLabs, roteiro de teste humano |
| `src/voice/agent-prompt.md` | prompt do agente do painel ElevenLabs (laboratório; **não** é o seu prompt do backend) |

## 6. Como a gente trabalha
- Cada frente na sua branch; o Kenzo integra. Acumulamos trabalho antes do PR para não sobrecarregá-lo.
- Antes de subir: `npm run typecheck`, `npm run lint`, `npm test` (348 testes) e `npm run build`.
- Chaves só no `.env` local. Nunca no código nem em doc.
- Mudou o contrato de eventos, o schema de entrada ou o comportamento de aprovação? Avise no grupo e atualize este arquivo.

## 7. Como ligar na interface (Malveste)
`const g = useGuideVoice();` e use `g.toggle` no orb (um botão: falar, parar ou interromper), `g.label` como texto de apoio, `g.lines` para a conversa, `g.screen` para o plano e `g.login` para o botão "Conectar iFood". O texto sempre funciona (`g.sendText`). Esc descarta a gravação ou interrompe a fala.

## 8. Teste integrado (voz + agente real)
Pré-requisitos: `LLM_PROVIDER=google` e `LLM_MODEL=gemini-3.5-flash-lite` no `.env` local (a chave do Gemini com faturamento ativo; sem faturamento a cota gratuita dá 429 depois de ~15 chamadas por minuto) e, para dados reais, `MCP_MODE=real` com o app na porta 8080 (redirect do OAuth do iFood) e o login em `/api/auth/login`.
Passos: `npm run build`, `npx next start -p 8080`, abrir `/voz` no Chrome com fone. **A faixa no topo da página diz qual agente respondeu**: "MODO REGRAS (sem LLM)" significa que o teste NÃO avalia a conversa (é a reserva que só cobre o roteiro da demo). Rode a jornada do aniversário falada, 5+ rodadas, e cole o JSON da tabela de rodadas (latência e confiança) e o "Copiar conversa (JSON)" (o que o agente decidiu em cada turno).

## 9. Pendências conhecidas
- **Modo conversa (sem as mãos) é experimental:** no teste de 18/10 às vezes foi preciso apertar Parar e às vezes a gravação cancelava sozinha (suspeita: ruído de fundo alto subindo o limite de voz, 0,0243, e a desistência por falta de fala). O modo conversa **entra no pitch** (decisão do time), então precisa ser estabilizado antes; fica fora do escopo do teste integrado atual, que usa o botão Falar/Parar. Não corrigido.
- **Palavras-chave do reconhecimento:** o Scribe recusa termo com mais de 5 palavras (medido); a voz corta em 5 e, se o provedor ainda recusar, tenta sem palavras-chave.
- Os limiares de confiança (0,6 / 0,85) e os tempos de fim de fala (900 ms / 1,3 s) são pontos de partida: calibrar no teste humano em Chrome, junto com a interrupção por voz e o eco.
- A rota `/api/converse` ainda não tem limite por visitante nem orçamento de tokens (a voz tem). Importa quando o LLM real entrar.
- A fala não deve repetir endereço completo (só "Casa"/"Trabalho"): o texto falado vai para a ElevenLabs. A política de retenção do TTS da nossa conta não foi verificada.
- Os limites de abuso da voz são por processo. A demo roda local (sem deploy público); se isso mudar, é preciso armazenamento compartilhado.
- Painel ElevenLabs travado em 17/10 (autenticação, origem obrigatória, duração máxima 180 s, silêncio 20 s, retenção 7 dias, áudio não armazenado). Falta conferir os overrides abaixo de "System prompt".
- Rotacionar as chaves da ElevenLabs e do iFood antes de tornar o repositório público.
