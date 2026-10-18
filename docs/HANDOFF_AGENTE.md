# Handoff do agente (18/10/2026)

Para o Hyago, o Kenzo e para retomar numa sessão nova sem carregar o histórico. Branch: `feat/felipe-agente-capacidades` (sobre a `main` de 70b6192). Responsável pelo agente, pelo fluxo e pela segurança: Felipe (com o Claude). Hyago: interface. Kenzo: domínio e integração.

## 1. Em uma frase
O agente agora **busca com relevância, fala só o que o plano sustenta, entrega dados prontos para os cartões da interface e abre a conversa pelo nome**; um sistema de testes (invariantes, caos e mutação) impede que as falhas já vistas voltem. Falta usar os dados do MCP para a personalização por hábito ("o de sempre").

## 2. O que existe (e como verificar)
| Capacidade | Onde | Verificação |
|---|---|---|
| Planejador de consultas + decomposição de pedido abstrato | `src/prompts/interpretar.ts` (v4), `domain-mcp` (`consultasDe`) | `src/agent/live-agente.test.ts` (Gemini real) |
| Juiz de relevância (texto, depois LLM) e cobertura "mais parecida" | `src/agent/relevancia.ts`, `src/prompts/relevancia.ts` | `relevancia.test.ts` (mutação 99%) |
| Guardas da fala: sanear na fronteira, fala vinculada ao plano, anti-repetição | `src/agent/guardas-fala.ts`, `orchestrator` (`falar`, `fechar`) | `src/qualidade/caos.test.ts` |
| Campos do cartão de sugestão | `OpcaoPlano.descricao`… (`src/agent/descricao.ts`) | `docs/CONTRATO_CARTOES_E_SAUDACAO.md` |
| Nome na abertura | `src/agent/perfil.ts`, `GET /api/perfil`, `useGuideVoice().greeting` | `perfil.test.ts` |
| Telemetria sem texto | `src/agent/telemetria.ts`, `GET /api/telemetria` (`TELEMETRIA=1`), painel na `/voz` | `telemetria.test.ts` |
| Oráculo de invariantes (todo turno de todo teste) | `src/qualidade/invariantes.ts`, usado em `src/evals/runner.ts` | `invariantes.test.ts` |
| Mutation testing próprio | `scripts/mutacao.mjs` (o Stryker não roda com o Vitest 5) | `node scripts/mutacao.mjs --todos` |

Comandos: `npm test` · `CAOS_N=6000 npx vitest run src/qualidade/caos.test.ts` · `node scripts/mutacao.mjs src/agent/relevancia.ts` · `EVAL_REAL=1 npx vitest run src/agent/live-agente.test.ts` (com `LLM_PROVIDER`, `LLM_MODEL` e a chave no ambiente; cota gratuita: esperar ~40 s entre rodadas) · `node scripts/preflight-integrado.mjs`.

## 3. Números medidos
- **Caos** (modelo, catálogo e usuário hostis, com semente): 455 violações em 300 conversas → **0 em 6000**.
- **Mutação** (quanto os testes detectam código quebrado), linha de base: `relevancia` 77→**99%**, `especificidade` 54→**100%**, `proposals` 85%, `visitor-session` 84%, `http` 71%, `speakable` 72%, `budget` 66%, `guard` 57%, `orchestrator` **57%**, `rate-limit` 54%, `domain-mcp` **47%**, `responder` **38%**. Piso de referência em `quality/` (a criar): o placar só sobe.
- **Voz + agente real** (3 testes falados): 1º som ~0,6 a 1,0 s; resposta útil ~2,2 s sem busca e ~5 s com busca real (interpretar 1,4 s + MCP 2 s + responder 0,7 s). Ver `docs/EXEMPLOS_TESTE_FALADO.md`.

## 4. Direção nova: dados do MCP e hábitos
Fonte: `docs/mcp-ifood-referencia.md` (**lido, ainda não testado com dados reais**).

Já disponível com os escopos que o login pede hoje:
- `listAddresses` → `results[]` com indicadores de uso, incluindo `ordersByMerchantTypeWeekdayAndShift` (contagens, como **string**): pedidos por tipo de loja × dia da semana × turno.
- `getRecommendations` com `contentMode`: `RECENT_ORDERS` (traz `lastOrderedAt`, `timesOrdered`, `lastOrderId`), `FAVORITE_MERCHANTS`, `RECOMMENDED`, `BEST_DEALS`, `FEATURED_LOCAL`.
- `getMerchant`, `getItem`, `listItemTaxonomy`.

Exige escopo extra (hoje não pedido): `getUser` BASIC (`mcp.user.basic.read`: nome) e BEHAVIOR (`mcp.user.behavior.read`: `hasClub`, `userBehaviorDescription`).

Não existe: listar todos os pedidos, cancelar. Repetir pedido é `createCart(orderId)` (escrita, fora do nosso escopo): o Guide **propõe**, a pessoa conclui no iFood.

O que dá para inferir: o de sempre (item e loja mais pedidos no mesmo dia/turno), repetir o último pedido, "hoje é dia de lanche" (contagem do dia×turno por tipo de loja), recência ("faz 3 semanas que você não pede em X"), favoritos.

Limites honestos: a contagem por dia/turno é por **tipo de loja**, não por prato; conta de teste pode vir **sem histórico** (a própria referência avisa), então a demo precisa de dados de histórico simulados.

Proposta (encaixa no que já existe):
1. **Auditoria dos dados** (45 min): rota só de desenvolvimento (`localhost` + `TELEMETRIA=1`) que chama as ferramentas de leitura da sessão conectada e devolve **só o esquema** (campos, tipos, quantidades; nunca valores). Resultado documentado em `docs/DADOS_MCP.md`.
2. **`src/agent/habitos.ts`** (puro, testável): resposta crua → `PerfilDeHabitos`; `sugerirDeSempre(perfil, agora)`.
3. **Porta de domínio** `lerHabitos(subjectRef)`: `McpDomain` com `listAddresses` + `RECENT_ORDERS`/`FAVORITE_MERCHANTS` (cache ~10 min); `FakeDomain` com histórico de exemplo.
4. **Intenções** `o_de_sempre` e `repetir_ultimo` no interpretador, **resolvidas em código** (o modelo só reconhece a intenção; quem escolhe o item é o hábito, não o palpite do LLM).
5. **Abertura proativa** ("Oi, Felipe! Quer o de sempre: X-Burger no Burger do Zé?") como cartão, e telemetria de aceitação.

## 5. Análise crítica (sem verniz)
- **Risco principal não medido:** as guardas novas são rígidas e podem trocar fala boa do LLM por template (soa robótico). A telemetria mede isso (`taxaDeTemplate`), mas **ainda não rodei o conjunto com o Gemini real depois das mudanças**.
- Exagerei na infraestrutura de testes em relação ao tempo: ela evita regressão, mas o jurado vê produto, design e pitch. Parar a mutação quando `orchestrator` e `domain-mcp` chegarem a ~70% nas guardas; o resto é rendimento decrescente.
- **Segurança P0 do plano de blindagem ainda aberta:** limite e orçamento no `/api/converse` (E1/E2). Aceitável para demo local; não para link público.
- Branch grande tocando pastas do Hyago e do Kenzo enquanto eles trabalham: abrir o PR já reduz o risco de conflito.
- Latência com busca real (~5 s) depende da frase de espera e do aquecimento; fazer um turno de aquecimento antes de apresentar.
- O nome da conta iFood depende de escopo que não confirmei no portal: a demo usa `GUIDE_NOME_DEMO`.

## 6. Plano até a entrega (12:30; congelar 10:30)
1. Abrir o PR desta branch (descrição com ordem de leitura) e alinhar com o Hyago o contrato dos cartões.
2. Auditoria dos dados do MCP e `habitos.ts` com testes (itens 1 e 2 da §4).
3. Integração (itens 3 a 5), com histórico simulado para a demo.
4. Rodada real: Gemini + MCP, conjunto de avaliações, `taxaDeTemplate`, ajustar prompt e guardas pelo que aparecer.
5. Roteiro da demo, números para o pitch e congelamento.

## 7. Retomar numa sessão nova
Abrir o Claude Code em `C:\Projetos\hackathon-ifood-semcomp`, branch `feat/felipe-agente-capacidades`, e pedir: *"Leia docs/HANDOFF_AGENTE.md, docs/PLANO_BLINDAGEM.md e docs/CONTRATO_CARTOES_E_SAUDACAO.md e continue pelo plano da §6."* Ambiente local (`.env`, nunca no git): `LLM_PROVIDER`, `LLM_MODEL`, `GOOGLE_API_KEY`, `ELEVENLABS_*`, `IFOOD_*`, `MCP_MODE`, `GUIDE_NOME_DEMO`, `TELEMETRIA=1`, `IFOOD_SCOPES_EXTRA` (opcional). Servidor de teste na porta **8080** (redirect do login do iFood).
