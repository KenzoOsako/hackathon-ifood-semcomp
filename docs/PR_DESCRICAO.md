# Agente: relevância, fala vinculada ao plano, cartões, saudação, telemetria e sistema de testes

Leia primeiro: `docs/HANDOFF_AGENTE.md` e `docs/CONTRATO_CARTOES_E_SAUDACAO.md`.

## Escopo
- **Busca com relevância**: planejador de consultas (`Necessidade.consultas`), juiz de relevância (texto + LLM) e cobertura `exata|proxima` ("não achei X; o mais parecido é Y").
- **Guardas da fala**: dados externos saneados na fronteira (`sanearPlano`), fala presa aos fatos do plano, anti-repetição, resposta nunca vazia (`falaMinima`).
- **Contrato dos cartões (Hyago)**: `descricao`, `distanciaKm`, `avaliacoes`, `pedidoMinimoCents`, `precoOriginalCents`, `imagemUrl`, `logoUrl` (imagem só do CDN do iFood), `cobertura`.
- **Saudação pelo nome** (`/api/perfil`, `greeting` do hook de voz; nome real só com escopo extra, senão `GUIDE_NOME_DEMO`).
- **Telemetria sem texto do usuário** (`/api/telemetria`, painel em `/voz`) e **varredura do MCP** (`/api/mcp/explorar`: só leitura, só formato; resultado real em `quality/mcp-formas.json`).
- **Testes**: oráculo de invariantes, caos com semente (0 violações em 6000 conversas) e mutação própria (`scripts/mutacao.mjs`).

## Correções da revisão (Kenzo)
1. **Consultas entram na assinatura do pedido**: trocar "leite integral" por "leite desnatado" (mesma categoria) invalida o plano e o encaminhamento e busca de novo. Teste: `orchestrator/revisao.test.ts` (falha sem a correção).
2. **Preço inválido não vira zero**: `sanearPlano` descarta candidato com preço NaN, infinito ou negativo; a alternativa válida assume; sem candidato válido a categoria vai para "não atendidas" (não há bloco para aprovar). Zero informado pela origem é preservado. Testes em `revisao.test.ts`.

## Testes (rodados nesta branch)
- `npm run typecheck`: sem erros · `npm run lint`: 0 erros (10 avisos de variável não usada) · `npm test`: 534 passando, 10 pulados (testes com LLM real, `EVAL_REAL=1`) · `npm run build`: ok.

## Limitações conhecidas
- **Telemetria e varredura são só para a demo local**: a trava é `TELEMETRIA=1` + checagem de `Host` (forjável). Antes de publicar, trocar por autorização e restrição de ambiente.
- **Hábitos ("o de sempre", "repetir o último") não implementados**: a conta de teste não tem endereços nem histórico e o MCP ao vivo só expõe 8 ferramentas de leitura; erros `INTERNAL` do iFood são intermitentes. A demo precisará de histórico simulado.
- **Guardas rígidas podem trocar fala do LLM por template**: `taxaDeTemplate` é medida, mas o conjunto com Gemini real ainda não foi rodado depois das últimas mudanças.
- **Sem limite/orçamento em `/api/converse`** (P0 de `docs/PLANO_BLINDAGEM.md`): aceitável local, não para link público.
- Mutação: `orchestrator` 57%, `domain-mcp` 47%, `responder` 38% (linha de base; o placar só deve subir).
