# Teste integrado: voz + agente (Gemini) + MCP

Objetivo: uma conversa falada de ponta a ponta com o **agente real** (LLM), sem o modo de reserva por regras, e medir latência e comportamento. Plano de origem: `docs/PLANO_INTEGRACAO_VOZ_AGENTE.md` (Fase 2). Contexto da voz: `docs/VOZ_INTEGRACAO_BACKEND.md`.

## 1. Preparar (uma vez)
1. `.env` local (nunca commitar). Variáveis do agente e da voz:
   ```
   LLM_PROVIDER=google
   LLM_MODEL=gemini-3.5-flash-lite
   GOOGLE_API_KEY=<a chave do Gemini, com faturamento ativo>
   ELEVENLABS_API_KEY=...        ELEVENLABS_VOICE_ID=...
   MCP_MODE=mock                 # ou real (ver §3)
   IFOOD_REDIRECT_URI=           # deixe VAZIO: o padrão é http://localhost:8080/callback
   ```
   Sem faturamento, a cota gratuita do Gemini dá 429 depois de ~15 chamadas por minuto; uma jornada falada tem ~8 turnos com 2 chamadas cada.
2. Verifique tudo (testa as chaves de verdade e não imprime nenhuma):
   ```bash
   node scripts/preflight-integrado.mjs
   ```
   Tem que terminar em "Tudo pronto". Se aparecer `FALHA`, a mensagem diz o que corrigir.

## 2. Subir (build de produção, porta 8080)
A porta **8080** é a do redirect do login do iFood; pare qualquer outro servidor nela antes.

PowerShell:
```powershell
npm run build
$env:MCP_MODE="mock"; npx next start -p 8080
```
Git Bash:
```bash
npm run build && MCP_MODE=mock npx next start -p 8080
```
Abra `http://localhost:8080/voz` no **Chrome, com fone de ouvido**. A faixa no topo da página tem que dizer o modelo (ex.: `google:gemini-3.5-flash-lite`) depois da primeira resposta. Se disser **"MODO REGRAS (sem LLM)"**, o `.env` não foi lido: o teste não vale, reinicie o servidor.

## 3. Dados reais do iFood (opcional, depois do §2 passar)
Pare o servidor e suba com `MCP_MODE=real`. Antes de falar, abra `http://localhost:8080/api/auth/login`, faça o login do iFood e volte para `/voz` (o botão "Conectar iFood" some quando conectou). Só funciona na porta 8080.

## 4. Roteiro falado (uma frase por vez; botão Falar/Parar)
Aquecimento (descartada nas contas): "Oi, tudo bem?"

Jornada do aniversário (o que o plano mede), 6 rodadas ou mais:
1. "Hoje é aniversário de um amigo meu, vamos comer pizza em casa e ver um filme."
2. "Umas seis pessoas."
3. "Pode escolher."
4. "Quero trocar a pizza pela mais rápida."
5. "O que você faz?"
6. "Pode."

Casos que já deram problema (agente por regras) e que agora devem se comportar bem com o LLM:
- "Quero churrasco": ele diz que ainda não tem essa opção, em vez de ignorar ou repetir a mesma frase.
- "Não quero pizza, me dá outra coisa": ele **não** volta a propor pizza.
- Responder algo longo com "pode ser R$ 100 de presente": o valor vira orçamento, nunca "100 pessoas".
- "Aprovo o plano versão um": ele **não** aprova sozinho (só sinaliza; a compra termina no iFood).
- Falar baixo ou com ruído: o Guide pede para repetir ou confirma o que entendeu.

## 5. O que coletar
No fim da página `/voz`:
- **Copiar JSON** da tabela "Latência por rodada" (reconhecimento, 1º som, backend, voz, 1ª palavra útil e a confiança de cada fala).
- **Copiar conversa (JSON)** da tabela "O que o agente decidiu em cada turno" (estado, nível, modelo e tempos de interpretar/domínio/responder).
Cole os dois no chat. Se algo soar estranho, anote em qual frase.

## 6. Como ler
| Medida | Meta | Observação |
|---|---|---|
| Reconhecimento | 600 ms | cresce com o tamanho da fala |
| 1º som | 1200 ms | com o LLM lento, é a frase "Hum, um instante." que cobre a espera |
| Backend (1º pedaço) | 700 ms | com Gemini, interpretar leva ~1 a 2 s: espere passar da meta; o que importa é a espera ser preenchida |
| Voz (1º byte) | 450 ms | |
| 1ª palavra útil | 1800 ms | com LLM real deve passar; a decisão do NDJSON (streaming) sai daqui |

Com menos de 5 rodadas o p95 é só indicativo. A 1ª rodada paga o aquecimento.

## 7. Se algo falhar
| Sintoma | Causa provável |
|---|---|
| Faixa "MODO REGRAS (sem LLM)" | `LLM_PROVIDER`/`LLM_MODEL` vazios ou servidor não reiniciado depois de editar o `.env` |
| O Guide diz "Recurso indisponível" (HTTP 503 no `/api/converse`) | `LLM_PROVIDER` preenchido mas `GOOGLE_API_KEY` vazia ou inválida (medido: é o que acontece sem a chave); rode o verificador |
| Demora de ~8 s e resposta de reserva | Gemini com 429 (cota) ou lento; o orquestrador desiste em 8 s |
| "Reconhecimento de voz indisponível" | veja o log do servidor (`[stt] provedor respondeu <status>`); rode o verificador |
| Botão "Conectar iFood" não some | login não concluído, ou `IFOOD_REDIRECT_URI` fora do padrão (porta 8080, caminho `/callback`) |
| Modo conversa estranho | conhecido (§9 de `VOZ_INTEGRACAO_BACKEND.md`); este teste usa o botão Falar/Parar |

Depois do evento: rotacionar as chaves da ElevenLabs, do Gemini e do iFood.
