# Mimo — assistente de compras por voz e texto

Protótipo desenvolvido em equipe no Hackathon iFood × SEMCOMP 29 (17–18/10/2026). O Mimo ajuda a planejar uma ocasião, comparar opções de restaurantes, mercado e shopping e revisar uma sacola local. **Nenhum pedido é enviado pelo protótipo.**

O projeto reúne Next.js 16, React 19, TypeScript, LangChain, Model Context Protocol (MCP), OAuth com PKCE e adaptadores de voz. A disponibilidade real de catálogo e serviços depende das permissões e da configuração de cada ambiente. Não representa produto oficial ou parceria comercial com o iFood.

## Conheça o projeto

- [Entregáveis finais: proposta, arquitetura, experiência e relato técnico (PDF)](docs/entregaveis/mimo-entregaveis-completos-final.pdf)
- [Imagens reais: implementação e evidências históricas](docs/IMAGENS_REAIS_IFOOD.md)
- [Complementos por item e aprovação versionada](docs/COMPLEMENTOS_ITENS.md)
- [Mapa da documentação](docs/INDEX.md) e [histórico técnico do time](contexto/estado-atual.md)

FoodPilot é o nome anterior, preservado nos documentos e decisões históricas. Os planos de 17/10 descrevem requisitos e propostas daquele momento; não são inventário atual de funcionalidades.

## O que existe e o que foi verificado

| Área | Implementação no código | Limite da verificação atual |
|---|---|---|
| Conversa | Atendente com ferramentas de leitura, planos, opções e revisão em `src/agent/atendente/` | Testes usam modelos roteirizados; a conversa requer um LLM configurado |
| Catálogo | Domínio simulado e adaptador MCP por visitante em `src/agent/domain-mcp/` | OAuth e catálogo real têm relatos históricos; não foram reexecutados nesta revisão |
| Autorização | OAuth/PKCE e tokens em memória em `src/mcp/real/` | Exige cliente e redirect autorizados; não é login persistente de produção |
| Voz | Adaptadores STT/TTS e integração em `src/voice/` | Provedores e microfone não foram testados nesta revisão |
| Sacola | Cálculos locais, complementos e aprovação vinculada à versão | Aprovar a simulação não cria carrinho remoto nem efetua compra |
| Dados | Sessões e agregados em memória; painel de demonstração | Sem persistência entre instâncias ou homologação para uso com dados reais |

Em 24/10/2026, a base `4c5b11d` passou em tipagem, lint, **457 testes em 54 arquivos** e build de produção em Linux/Node.js 24. São checks locais com dependências de serviços simuladas; não certificam deploy, provedores, acessibilidade completa ou segurança global.

## Executar localmente

Recomendado: **Node.js 24 e npm**, como no workflow de CI. Instale conforme o lockfile:

```sh
npm ci --ignore-scripts
cp .env.example .env
npm run dev
```

No PowerShell, substitua a cópia por `Copy-Item .env.example .env`. Abra `http://localhost:3000`; a home e as prévias permitem explorar a interface. `/agente/previa` usa dados de demonstração.

O catálogo é simulado por padrão (`MCP_MODE=mock`), mas a conversa em `/agente` **também precisa de um LLM**. Configure `LLM_PROVIDER` (`google`, `openai` ou `anthropic`), `LLM_MODEL` e a chave correspondente apenas no ambiente local. `ATENDENTE_MODEL`, quando definido, prevalece sobre `LLM_MODEL`. Sem configuração, `/api/converse` responde 503 `LLM_NAO_CONFIGURADO`; não há fallback conversacional por regras nesse endpoint.

MCP real exige `MCP_MODE=real`, OAuth e redirect autorizado no ambiente usado; consulte o [guia MCP](docs/mcp-ifood-referencia.md). O cliente legado em `src/mcp/index.ts`, usado por rotas antigas, não equivale ao adaptador real do atendente. Voz externa exige configuração própria. Chamadas a LLM e voz podem consumir créditos; os comandos de qualidade abaixo não precisam dessas chaves.

## Verificar qualidade

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

O workflow `.github/workflows/quality.yml` repete esses quatro checks sem segredos de serviços. O build usa `next/font/google` e precisa baixar fontes; testes automatizados não substituem a validação autenticada das integrações.

## Arquitetura e navegação

```text
src/app/          páginas e rotas HTTP (converse, auth, voz e painel)
src/agent/        atendente, sessão, modelos e domínios real/simulado
src/contracts/    contratos e validações de fronteira
src/domain/       propostas, aprovação, complementos e continuidade manual
src/mcp/          adaptação de catálogo, OAuth e cliente MCP
src/reco/         elegibilidade, ranking e motivos baseados em dados
src/voice/        reconhecimento, síntese e controle de voz
src/ui/           componentes e telas
src/data/         sinais agregados de demonstração em memória
fixtures/         dados simulados
docs/             decisões de projeto, desenhos, evidências e entregáveis
contexto/         memória e governança da equipe
```

## Autoria, colaboração e limites

Projeto coletivo de **Kenzo, Felipe (Terossi), Hyago e Malveste**. Atribuições e evolução estão registradas no histórico Git e nos documentos; não atribuir toda a implementação a um único integrante. Mudanças seguem branch própria, PR e revisão do integrador, conforme [AGENTS.md](AGENTS.md). Regras humanas de negócio permanecem intactas.

Não foi identificada licença de distribuição na raiz nesta revisão. Autoria coletiva, marcas e materiais de terceiros exigem avaliação antes de licenciar ou reutilizar; a visibilidade pública não concede por si só licença de uso.

Credenciais ficam fora do Git. O histórico documental registra remoção de valores com formato de credenciais: a rotação/revogação nos provedores ainda precisa de confirmação. Não publicar arquivos `.env`, conversas privadas, tokens ou capturas com dados pessoais. A sacola continua simulada e a compra final ocorre no iFood.
