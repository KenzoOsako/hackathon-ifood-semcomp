# Erros aprendidos (só acrescentar no fim)

Formato: **E-NNN — título** · sintoma · causa · correção/como evitar.

_(nenhum ainda)_

## E-001 — Tipagem em checkout limpo (17/10/2026)
- Sintoma: npm run typecheck falhou com LayoutProps não encontrado após npm ci.
- Causa: helpers globais são gerados pelo Next, mas script rodava tsc antes da geração.
- Correção: typecheck executa next typegen antes de tsc --noEmit, conforme documentação instalada do Next em node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md. Resultado final registrado na auditoria.
