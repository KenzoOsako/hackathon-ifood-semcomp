# Erros aprendidos (só acrescentar no fim)

Formato: **E-NNN — título** · sintoma · causa · correção/como evitar.

_(nenhum ainda)_

## E-001 — Tipagem em checkout limpo (17/10/2026)
- Sintoma: npm run typecheck falhou com LayoutProps não encontrado após npm ci.
- Causa: helpers globais são gerados pelo Next, mas script rodava tsc antes da geração.
- Correção: typecheck executa next typegen antes de tsc --noEmit, conforme documentação instalada do Next em node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md. Resultado final registrado na auditoria.

## E-002 — Derivação de schemas Zod com refinamentos (17/10/2026)
- Sintoma: suíte falhou ao importar domínio com `.pick()` em schema refinado.
- Causa: Zod rejeita essa derivação em runtime; TypeScript não detectou o uso.
- Correção: compor shape explícito para entrada mínima e validar novamente o snapshot completo com CartProposalSchema. Schemas públicos também precisam preservar suas invariantes cruzadas; testes de parse direto cobrem o limite.

## E-003 — Runtime com Cache Components e verificação em HTTP real (17/10/2026)
- Sintoma: build rejeitou runtime=nodejs explícito nas rotas; smoke HTTP por 127.0.0.1 recebeu 403 enquanto localhost passava.
- Causa: Cache Components usa runtime Node padrão e não aceita a configuração por segmento; Next normalizou req.url internamente para localhost.
- Correção: remover runtime explícito conforme docs instaladas; comparar Origin com protocolo e Host validado recebido, ignorando X-Forwarded-Host do cliente. Testes cobrem alias legítimo e spoof de origem. Conferir endpoint servido além do teste de handler isolado.

## E-004 — Smoke HTTP no Windows: acento no curl e servidor órfão (17/10/2026)
- Sintoma: /api/converse respondeu INVALID_DATA para falas com acento; depois, o smoke rodou contra código antigo.
- Causa: curl no Git Bash do Windows converte o argumento --data para outra codificação (jsonBody exige UTF-8 estrito); parar a tarefa de `npx next start` deixa o processo node filho escutando na porta, e o novo servidor falha ao subir sem ninguém notar.
- Correção: enviar corpo com acento via --data-binary @arquivo ou cliente Node (fetch); depois de parar o servidor, conferir a porta (Get-NetTCPConnection) e checar o log do novo servidor antes de testar.
