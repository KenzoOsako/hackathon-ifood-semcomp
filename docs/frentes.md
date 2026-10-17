# Frentes de trabalho e como rodar

Visão do produto: `docs/produto-v1.md`. Contexto do evento: `contexto/contexto.md`. Guia do MCP: `docs/mcp-ifood-referencia.md`.

## Como rodar (todo mundo)

```bash
git pull
npm install
cp .env.example .env      # preencher só o que a sua frente precisa
npm run dev               # http://localhost:3000, em Chrome
```

Por padrão roda com **MCP simulado** (`MCP_MODE=mock`, dados em `fixtures/`). O fluxo já funciona de ponta a ponta:
`"estou com fome"` → 3 opções com motivos → `"quero a segunda"` → resumo → **Confirmar** (botão) → pedido e status.

Antes de abrir PR: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

> Next.js 16 mudou APIs. Antes de usar algo novo, consulte `node_modules/next/dist/docs/`.

## Chaves e controle de gastos

- **Chaves compartilhadas** (LLM, ElevenLabs): o Felipe passa por mensagem direta; cada um coloca no **seu `.env`**, que **não vai para o git**. Credenciais do iFood (Client ID/Secret) são pessoais e idem.
- **Limites por pessoa** no `.env`: `LLM_TOKEN_BUDGET`, `TTS_CHAR_BUDGET`, `STT_SECONDS_BUDGET` (0 = sem limite). Preços opcionais (`LLM_PRICE_IN_PER_MTOK`, `LLM_PRICE_OUT_PER_MTOK`) liberam a estimativa de custo.
- **Medidor:** `src/usage/meter.ts`. Toda chamada a modelo ou voz deve fazer `assertBudget(kind)` antes e `record(...)` depois. O consumo desta máquina aparece em `GET /api/usage` e fica em `.usage/usage.jsonl` (ignorado pelo git).
- O total do **time** está nos painéis dos provedores (Anthropic, ElevenLabs); o medidor só mostra a sua parte e para antes de estourar.

## Como as frentes não se atropelam

- **Cada frente mexe só nas suas pastas.** Precisou de algo de outra? Abra um card ou peça mudança no contrato.
- **`src/contracts/` só o integrador altera**, por PR próprio. É o que permite as frentes andarem em paralelo.
- **`main` sempre roda a demo** (mesmo com dados simulados). PR pequeno, a cada 1 ou 2 horas.
- **Troca de peça sem quebrar:** o agente só fala com o MCP pela interface `McpClient` (`src/mcp/types.ts`); a interface só fala com o agente pelas rotas `/api/*` e pelos tipos de `src/contracts`.

## Frente 1 — Agente e MCP

**Pastas:** `src/agent/`, `src/mcp/`, `src/app/api/`.
**Hoje:** o agente usa palavras-chave (sem modelo) e o MCP é simulado.
**Entregas:**
1. Adaptador real em `src/mcp/real.ts` (`MCP_MODE=real`): OAuth + PKCE, tokens por usuário, refresh sem corrida, os 4 domínios, parser de erros por domínio. Siga `docs/mcp-ifood-referencia.md` (§4, §9, §12).
2. Laço do agente com modelo de linguagem e **tool use**, substituindo `handleMessage`, mantendo a máquina de estados e a trava de confirmação.
3. Revalidação do carrinho antes do checkout; `submitOrder` uma vez só; resultado incerto não reenvia.
4. Verificar `tools/list` real contra as 24 tools documentadas e registrar diferenças em `contexto/feedback-mcp.md`.

**Regras:** `userConsent: true` **só** vem de `confirmOrder(..., explicit: true)`, e `explicit` só é `true` por ação clara da pessoa. O modelo nunca preenche. IDs sempre do servidor.

## Frente 2 — Voz e interface

**Pastas:** `src/voice/`, `src/ui/`, `src/app/page.tsx`.
**Hoje:** texto, cartões, confirmação por botão, status com polling.
**Entregas:**
1. Conversa por voz **de verdade**: entrada de fala em português e resposta falada com baixa latência. Time tem **ElevenLabs Pro**: avaliar (a) o produto de agentes conversacionais deles, que já trata turnos de fala e interrupção, ou (b) STT + TTS em streaming ligados ao nosso agente. A Web Speech API do Chrome serve de plano B. **Medir** a latência até a primeira palavra (meta < 2 s).
2. Interrupção (o usuário fala por cima e o agente para), alternar voz e texto.
3. Cartões das opções com os motivos, tela de confirmação clara, estados de espera e de falha.
4. Controle da tela por voz ("mostre a segunda", "mude o orçamento para 35"), via rotas e estado, sem lógica de negócio na interface.

**Regras:** só mostra e fala **motivos que vierem em `reasons`**. Confirmar pedido por voz exige frase explícita e validada pela interface antes de chamar `/api/confirm` com `explicit: true`.

## Frente 3 — Recomendação, memória e dados

**Pastas:** `src/reco/`, `src/memory/`, `fixtures/`.
**Hoje:** ranking determinístico (`rank`), memória em RAM com consentimento, fixtures falsas.
**Entregas:**
1. Motor de recomendação com os dados reais do MCP: rótulos (barata, melhor avaliada, rápida, favorito, novidade, em promoção), anti-repetição, modos (econômico, surpresa) e ajuste por voz. **Motivo sem campo real não existe.**
2. Memória persistente (preferências, restrições, rejeições, aprendizado) com consentimento e tela "o que sei sobre você" (ver, corrigir, apagar).
3. Rotina e contexto: horário, endereço, rotina por dia e turno (`listAddresses`), histórico (`RECENT_ORDERS`).
4. **Gerar histórico real de teste:** pedidos de sandbox para os usuários da demo (o histórico começa vazio).
5. Atualizar `fixtures/` com respostas reais assim que o MCP conectar.

## Integrador (Kenzo)

`src/contracts/`, revisão e merge, CI, deploy (opcional), roteiro da demo, vídeo de reserva, pitch e entregáveis 01–05 em conjunto.

## Onda 2 (só se o núcleo estiver estável)

Mercado (lista por receita, mercado que tem tudo, substituição), extras (grupo, planejamento, proativo). Não começar antes de a camada 2 estar pronta.
