# AGENTS.md — Hackathon iFood (SEMCOMP 29)

Tema: **vendendo com agentes** (detalhado às 14:00 de 17/10/2026). Time de 4, 18h de desenvolvimento.

## Antes de qualquer coisa
1. Leia a pasta `contexto/` inteira, nesta ordem: `regras-de-negocio.md`, `decisoes.md`, `erros-aprendidos.md`, `estado-atual.md`.
2. Não invente requisito. Se faltar informação, pergunte à pessoa antes de codar.
3. Responda em português (Brasil), direto ao ponto.

## Papéis
- **3 construtores:** cada um trabalha numa fatia pequena e mensurável, em branch própria (`feat/<nome>-<assunto>`).
- **1 integrador:** único que faz merge na `main`. Se o PR quebra o projeto ou foge das regras, devolve com comentário objetivo e o autor corrige.

## Fluxo de PR
- PR pequeno (idealmente < 300 linhas), uma coisa só, descrição com: o que muda, como testar, o que não foi feito.
- Antes de abrir o PR: rodar build, lint e testes (quando existirem) e atualizar `contexto/estado-atual.md`.
- Nunca commitar direto na `main`. Nunca `push --force` em branch de outra pessoa.
- Commits curtos, em português.

## Regras de código
- Código simples antes de elegante: é hackathon, mas a `main` sempre roda.
- Sem segredos no repo. Usar `.env` (ignorado) e manter `.env.example` atualizado.
- Não adicionar dependência grande sem registrar em `contexto/decisoes.md`.
- Comentários explicam o porquê, não o quê.

## Pasta `contexto/` (memória do projeto)
Regras de edição completas em `contexto/README.md`. Resumo:
- `regras-de-negocio.md` é **imutável para agentes**: só humanos editam, em PR próprio. Se o código contradiz uma regra, o código está errado; avise a pessoa.
- `decisoes.md` e `erros-aprendidos.md`: só acrescentar no fim, nunca reescrever entradas antigas.
- `estado-atual.md`: atualizado a cada PR.

## Aprendeu algo ou errou?
Registre em `contexto/erros-aprendidos.md` (sintoma, causa, correção) para ninguém repetir.
