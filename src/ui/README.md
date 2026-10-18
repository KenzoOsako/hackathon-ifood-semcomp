# src/ui — Componentes da interface

**Dono:** Malveste. **Status:** primeira versão do design implementada (ver `contexto/estado-atual.md`).

**Responsabilidade:** como o usuário vê e controla o FoodPilot.

## O que existe
- **Tela única do agente** (`src/app/agente`, `src/ui/agent/`): em cima o que o agente encontrou (lista de resultados, proposta, continuidade no iFood); embaixo a conversa com o orbe. `AgentProvider` (`agent-context.tsx`) fala com `/api/chat` e `/api/confirm` e decide a tela pelo estado devolvido; `AgentView` é só visual (props), usada também pela prévia.
- **Orbe compartilhado** (`components/orb.tsx`, `orb-waves.tsx`): `<Orb size="fab|hero|strip|mini" state=...>`.
- **Home fake do iFood** (`home/ifood-home.tsx`): só cenário; a bolinha abre o agente.
- **Componentes base** (`components/`): button, card, badge (variante `simulated`), alert, input, `StoreLogo`, `PhoneFrame`.
- **Prévia de design** (`/agente/previa`): dados fixos e rotulados; não chama a API.

## Regras
1. Mostrar apenas o que vem do **snapshot/contratos**; **não recalcular** ranking, total nem regra de segurança na interface.
2. Selecionar, editar e aprovar são eventos distintos; **sem finalizar compra** (a compra é no iFood).
3. Rotular **real × simulado** em cada dado (`DATA_ORIGIN` em `agent-context.tsx`). Motivos só os de `reasons`.
4. A UI **não chama o MCP** diretamente; fala com as rotas `/api/*`.
5. **Acessibilidade:** teclado, leitor de tela, contraste AA, `prefers-reduced-motion`; o modo texto é equivalente à voz.
6. Estados de carregando, vazio, erro e expiração visíveis.
7. Sem imagens: todo visual é CSS, SVG ou ícones do lucide-react. Cores só por tokens de `globals.css`.

## Ligação com a voz e com o back
- Voz: `AgentScreen` aceita `voiceState` e `onMicClick`; sem `onMicClick` o microfone fica indisponível.
- Lacunas de contrato conhecidas: proposta pública sem nome do item/loja/endereço; sem sinal de "busca sem resultado"; origem real/simulada por dado; categoria da loja.
