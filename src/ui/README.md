# src/ui — Componentes da interface

**Dono:** Malveste. **Status:** não implementado (a página atual é do esqueleto, em `src/app/page.tsx`).

**Responsabilidade:** como o usuário vê e controla o FoodPilot.

## Componentes previstos
- **Conversa** com legendas da voz e botão de microfone (estados: ouvindo, pensando, falando, erro).
- **Plano de ocasião:** um bloco por necessidade (pizza, pipoca, presente), até 3 opções, motivo de cada, ajuste e **aprovação do plano inteiro**.
- **Indicador de ritmo:** modo rápido ou guiado.
- **Controles de privacidade:** ver, corrigir, apagar, desligar uso agregado.
- **Painel de insights** (agregados, rótulo SIMULADO quando for demonstração).

## Regras
1. Mostrar apenas o que vem do **snapshot do plano**; **não recalcular** ranking, total nem regra de segurança na interface.
2. Selecionar, editar e aprovar são eventos distintos; **sem finalizar compra**.
3. Rotular **real × simulado** em cada dado.
4. A UI **não chama o MCP** diretamente; fala com as rotas da aplicação.
5. **Acessibilidade:** teclado, leitor de tela, contraste; o modo texto é equivalente à voz.
6. Estados de erro e expiração visíveis (plano expirado, aprovação antiga, serviço fora).

## Entradas e saídas
Recebe snapshots do plano versionado e estados de voz; envia eventos de ajuste e aprovação com `planoId` e `versão`.
