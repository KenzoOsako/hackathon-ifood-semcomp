# AGENTS.md — Hackathon iFood (SEMCOMP 29)

Tema: **vendendo com agentes** (detalhado às 14:00 de 17/10/2026). Time de 4, 18h de desenvolvimento.

## Antes de qualquer coisa
1. Leia `contexto/contexto.md` (visão completa do evento e do time) e depois o restante de `contexto/`, nesta ordem: `regras-de-negocio.md`, `decisoes.md`, `erros-aprendidos.md`, `estado-atual.md`.
2. Leia também docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md e docs/AUDITORIA-ALINHAMENTO-2026-10-17.md. A proposta final supera o rascunho produto-v1; requisitos aprovados não são funcionalidades implementadas. Não invente requisito. Se faltar informação, pergunte à pessoa antes de codar.
3. Responda em português (Brasil), direto ao ponto.

## Papéis
As frentes novas só serão atribuídas após a auditoria e alinhamento da equipe (decisão 39). Os papéis abaixo descrevem o fluxo de integração vigente, não uma nova distribuição de implementação.
- **3 construtores:** cada um trabalha numa fatia pequena e mensurável, em branch própria (`feat/<nome>-<assunto>`).
- **1 integrador:** único que faz merge na `main`. Se o PR quebra o projeto ou foge das regras, devolve com comentário objetivo e o autor corrige.

## Fluxo de PR
- PR pequeno (idealmente < 300 linhas), uma coisa só, descrição com: o que muda, como testar, o que não foi feito.
- Antes de abrir o PR: rodar build, lint e testes (quando existirem) e atualizar `contexto/estado-atual.md`.
- Nunca commitar direto na `main`. Nunca `push --force` em branch de outra pessoa.
- Commits curtos, em português.

## Regras de código
- **Stack:** Next.js 16 + TypeScript (demo em Chrome desktop). Este Next tem mudanças em relação ao que a IA conhece: consulte `node_modules/next/dist/docs/` antes de usar uma API.
- **Frentes e pastas:** veja `docs/frentes.md`. Mexa só na pasta da sua frente; `src/contracts/` só o integrador.
- **Motivos de recomendação** só vêm de campos reais (`reasons`); o modelo não inventa motivo.
- **Compra final no iFood.** Separar proposta local, carrinho remoto e pedido. Exigir aprovação explícita vinculada à versão antes de adicionar remotamente; alterações materiais invalidam aprovação. Não conectar o submitOrder do esqueleto a operações reais. Transferência/link só se suportados e validados; senão resumo manual.
- Antes do PR: `npm run typecheck && npm run lint && npm test && npm run build`.
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

## Backlog (Trello) — um card por PR
Quadro: **HACKATHON IFOOD** (https://trello.com/b/ZcLDfKqU/hackathon-ifood). Listas, da esquerda para a direita:
`A Desenvolver` → `Desenvolvendo` → `Em Revisão` → `Pronto`.

**Fluxo de um card**
1. Pegue um card em `A Desenvolver`, atribua a si e mova para `Desenvolvendo`. Máximo **1 card em Desenvolvendo por pessoa**.
2. Crie a branch `feat/<nome>-<assunto>` e trabalhe os itens do checklist.
3. Abra o PR citando o card (link) e cole o link do PR na descrição do card. Mova para `Em Revisão`.
4. O integrador (Kenzo) revisa. Se pedir ajustes, o card volta para `Desenvolvendo`. Após o merge, ele move para `Pronto`.

**Padrão do card**
- Título: `[fatia] verbo + resultado` (fatias: infra, agente, dados, ui, entregável, pitch).
- Descrição: `Objetivo` · `Pronto quando` (critério verificável) · `Regras` (RN-xxx) · `Branch` · `PR`.
- Checklist do Trello com 3 a 6 itens; o último é sempre "Atualizar contexto/estado-atual.md".
- Card maior que ~2h: quebre em dois cards e dois PRs.
- Etiquetas (cores, sem nome no Trello): azul = entregável · verde = agente · amarelo = integração MCP · laranja = UI · roxo = infra · vermelho = bloqueado.

**Agentes** podem ler cards, criar cards de backlog, comentar e mover o card em que estão trabalhando até `Em Revisão`. Quem move para `Pronto` é o integrador. Credenciais do Trello e do iFood só em `.env`, nunca no repo, no card ou no chat do grupo.

## Regras do evento (fonte: organização iFood × SEMCOMP)
- Desenvolvimento até **domingo 12h30**; pitches dom 13h–16h (5 min + 3 de perguntas); resultado dom 17h.
- Avaliação: visão e originalidade · arquitetura e engenharia (uso correto do MCP) · design e experiência · impacto · comunicação e pitch.
- Entregáveis obrigatórios: 01 proposta de negócio · 02 desenho de solução · 03 racional da experiência · 04 interface visual · 05 documento técnico resumido · 06 feedback sobre os MCPs (`contexto/feedback-mcp.md`, anotar na hora).
- Chaves do MCP são pessoais do time e serão revogadas na segunda-feira. Não vazar.
