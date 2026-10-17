# Hackathon iFood — SEMCOMP 29

Tema: vendendo com agentes. Equipe de 4.

## Como começar (todo mundo)
```bash
git clone https://github.com/KenzoOsako/hackathon-ifood-semcomp.git
cd hackathon-ifood-semcomp
claude   # abre o Claude Code nesta pasta; ele lê CLAUDE.md -> AGENTS.md sozinho
```
No Codex, o `AGENTS.md` é lido direto. Antes de codar, leia `contexto/`.

## Fluxo
Branch `feat/<nome>-<assunto>` → PR pequeno → o integrador revisa e faz merge na `main`. Detalhes em `AGENTS.md`.

## Referência técnica do MCP

[Guia técnico do MCP iFood](docs/mcp-ifood-referencia.md) para os quatro desenvolvedores e agentes de código: 24 ferramentas documentadas, OAuth, escopos, erros, fluxos e divergências a validar na conexão real.

## Rodar o projeto
```bash
npm install
cp .env.example .env
npm run dev   # http://localhost:3000 (Chrome). Por padrao usa MCP simulado
```
Frentes, regras e pastas de cada pessoa: [docs/frentes.md](docs/frentes.md). Produto V1: [docs/produto-v1.md](docs/produto-v1.md).
