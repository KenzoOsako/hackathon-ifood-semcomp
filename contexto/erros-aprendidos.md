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

## E-004 — `next dev` reescreve o AGENTS.md (17/10/2026)
- Sintoma: após rodar `npm run dev`, `git status` mostra AGENTS.md modificado com um bloco `nextjs-agent-rules`.
- Causa: o Next 16 gera esse bloco sozinho no AGENTS.md ao subir o servidor de desenvolvimento.
- Correção: não commitar a mudança (AGENTS.md é do integrador); desfazer com `git checkout AGENTS.md` antes de `git add`. Conferir `git status` depois de cada `npm run dev`.

## E-005 — Smoke HTTP no Windows: acento no curl e servidor órfão (17/10/2026)
- Sintoma: /api/converse respondeu INVALID_DATA para falas com acento; depois, o smoke rodou contra código antigo.
- Causa: curl no Git Bash do Windows converte o argumento --data para outra codificação (jsonBody exige UTF-8 estrito); parar a tarefa de `npx next start` deixa o processo node filho escutando na porta, e o novo servidor falha ao subir sem ninguém notar.
- Correção: enviar corpo com acento via --data-binary @arquivo ou cliente Node (fetch); depois de parar o servidor, conferir a porta (Get-NetTCPConnection) e checar o log do novo servidor antes de testar.


## E-006 — Gemini: todo turno caía em "Não consegui entender" (17/10/2026)
- Sintoma: com `LLM_PROVIDER=google`, todas as evals falharam igual em ~600 ms, para qualquer modelo; o orquestrador devolvia a frase de falha.
- Causa: o Gemini rejeita `exclusiveMinimum` no `response_schema` (gerado por `z.number().positive()`); o erro some no `catch` do orquestrador. Depois apareceram 429 da cota gratuita (~15 chamadas/min) e `gemini-2.5-flash` indisponível para chaves novas.
- Correção: usar `min(...)` em vez de `positive()`/`gt()` nos schemas que vão ao LLM. Para depurar, envolver `llm.interpretar` e registrar o erro do provedor antes de concluir que é prompt ou modelo. Rodar evals reais em ritmo ou por cenário (`-t`).

## E-007 — Gemini "dispara" num campo de texto curto e derruba o turno (18/10/2026)
- Sintoma: no cenário do filho gripado, o 2º turno ("Pode escolher.") respondia "Não consegui entender" em ~2,7 s ou estourava o timeout de 8 s, nas 2 rodadas.
- Causa: o `gemini-3.5-flash-lite` escreveu uma frase sem espaços de ~250 letras em `ocasiao.tipo` (campo de enfeite, máx. 60). A validação estrita recusava a resposta inteira; quando o modelo seguia escrevendo, o turno estourava o tempo.
- Correção: `.describe()` nos campos curtos (vai ao modelo junto com o schema), teto de saída de 600 tokens e `includeRaw` com saneamento (`src/agent/llm/sanear.ts`) que descarta só campos opcionais fora do formato; necessidades e restrições seguem validadas à risca. O orquestrador passa a registrar o tipo da falha (sem conteúdo). Resultado: o cenário passou nas 2 rodadas seguintes. Uma falha intermitente no churrasco não se repetiu em 3 tentativas e ficou sem causa conhecida.
