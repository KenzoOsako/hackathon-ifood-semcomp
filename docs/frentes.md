# Frentes da Direção V2 (proposta)

Substitui, se aceita (D-008), o mapa de "frentes candidatas". Detalhes: [plano V2](PLANO_V2_PAPEIS_E_CRONOGRAMA.md). Direção: [DIRECAO_V2_OCASIAO.md](DIRECAO_V2_OCASIAO.md).

## Mapa: pastas, dono e fronteiras

| Frente | Dono | Pastas | Recebe | Entrega |
|---|---|---|---|---|
| **Conversação e Voz** | Felipe | `src/voice/**`, `src/app/api/voice/**` | Texto do agente, estados da conversa | Transcrição, sinais (velocidade, interrupção, silêncio), fala com baixa latência, queda para texto |
| **System Prompt e Fluxo de Agentes** | Hyago | `src/agent/**`, `src/prompts/**`, `src/evals/**` | Conversa + funções de domínio | Ocasião e necessidades (JSON validado), perguntas, plano verbalizado, nível L0/L1/L2 |
| **Request e Dados** | Kenzo | `src/mcp/**`, `src/reco/**`, `src/domain/**`, `src/data/**`, `src/contracts/**`, `src/app/api/auth/**` | Pedidos de busca e plano | Opções com motivos reais, plano versionado, eventos, agregados |
| **Interface e Front-End** | Malveste | `src/app/**` (menos `api/`), `src/ui/**` | Snapshots do plano e estados | Tela do plano, aprovação, controles de privacidade, painel de insights |

## Interfaces
1. **Voz → Agente:** `POST /api/converse` (resposta em fluxo). Entrada `{sessionId, texto, origem, sinais}`; saída `resposta_parcial`, `evento_de_tela`, `resposta_final`.
2. **Agente → Domínio (funções do Kenzo):** `obterContexto`, `buscarNecessidade`, `rankear`, `montarPlano`, `ajustarPlano`, `aprovarPlano(versão)`, `registrarEvento`. **Sem acesso transacional.**
3. **Domínio → UI:** snapshot do plano versionado (`planoId`, `versão`, necessidades, opções, motivos, totais conhecidos ou ausentes, pendências, origem real ou simulada).
4. **Aprovação:** UI ou voz envia `planoId` e `versão`; o **backend revalida**. **O FoodPilot não finaliza pedido.**

## Regras comuns
- **Motivo só com dado real** (`reasons` do ranking); o modelo verbaliza, não inventa.
- **Filtros rígidos** (alergia, teto) nunca são relaxados sozinhos.
- **Profundidade adaptativa:** L0 (0 perguntas), L1 (1), L2 (até 3, uma por vez); teto de 3 por sessão.
- **Rotular** o que é real, simulado, planejado ou bloqueado, em tela e em documento.
- **Privacidade:** consentimento explícito, sem dados pessoais nos eventos, painel só com agregados.
- **Dono do módulo**, não outra pessoa, edita sua pasta; mudança de contrato é avisada aos consumidores antes do código.
- **Segredos** só em `.env` local; nunca em documento, card ou chat.

## Executar
`npm ci`, copiar `.env.example` para `.env`, `npm run dev` (http://localhost:3000, Chrome). Só `MCP_MODE=mock` está implementado. Antes de PR: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Gates
- **G1 (21h):** verticais sondadas no MCP real. · **G2 (21h30):** contratos congelados. · **G3 (00h30):** fluxo ponta a ponta simulado. · **G4 (03h):** dado real do MCP no fluxo. · **G5 (09h):** congelamento.
