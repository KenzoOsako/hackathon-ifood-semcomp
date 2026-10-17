# src/domain — Ocasião, necessidades e plano versionado

**Dono:** Kenzo. **Status:** não implementado (os contratos de Ocasião, Necessidade e Plano ainda precisam ser publicados, congelamento às 21h30).

**Responsabilidade:** regras críticas e estado do pedido. É a única camada que decide o que pode ser aprovado.

## Funções expostas ao agente (sem acesso transacional)
`obterContexto` · `buscarNecessidade` · `rankear` · `montarPlano` · `ajustarPlano` · `aprovarPlano(versão)` · `registrarEvento`

## Conceitos
- **Ocasião:** tipo, pessoas, quando, local, contexto livre curto.
- **Necessidade:** vertical (`RESTAURANT`, `GROCERIES`, `SHOPPING`), categoria, restrições, orçamento (teto rígido ou flexível).
- **Plano:** versão, necessidades, até 3 opções por necessidade com `reasons[]`, totais conhecidos ou ausentes, pendências, origem real ou simulada.

## Regras
1. **O FoodPilot não finaliza pedido.** Continuidade no iFood: transferência validada, senão link confirmado, senão resumo copiável.
2. Selecionar, editar e aprovar são eventos distintos; aprovar **invalida** em mudança material (item, preço, endereço, restrição) e expira.
3. Filtros rígidos (alergia, teto) nunca são relaxados sozinhos.
4. **Sem carrinho remoto antes da aprovação** e nunca `submitOrder`.
5. Mesma proposta aprovada duas vezes não duplica efeito (idempotência).
6. Falha ambígua exige reconciliação, não reenvio às cegas.

## Testes
Mutações reais permanecem em zero antes da aprovação; aprovação antiga, expirada ou repetida é bloqueada (AC-08 e AC-09 do plano).
