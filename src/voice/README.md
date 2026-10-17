# src/voice — Conversação e Voz

**Dono:** Felipe. **Status:** parcial. Pronto e testado: texto falado (`speech-text.ts`), guardas (`guard.ts`), sinais (`signals.ts`), gasto (`budget.ts`), síntese ElevenLabs no servidor (`tts.ts` e `/api/voice/tts`). Falta: hook do microfone no navegador, reconhecimento (lote ou tempo real), interrupção e integração com `/api/converse`. Prompt do agente de teste: `agent-prompt.md`.

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
