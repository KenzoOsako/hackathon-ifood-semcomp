# Auditoria de alinhamento — 17/10/2026

## Escopo e fontes
Base: main **0867abc**; os commits 8d24fff e 0867abc alteraram apenas .env.example. Esqueleto: [PR #4](https://github.com/KenzoOsako/hackathon-ifood-semcomp/pull/4); guia: PR #3.
Autoridade: [proposta final do usuário](PROPOSTA_DE_NEGOCIO_FOODPILOT.md), preservada byte a byte. Inspeção do código e Trello nesta data. Sem nova autenticação MCP, compra, deploy ou teste com consumidores.
Estados: atendido = evidência no recorte indicado; parcial = parte existe; ausente = não encontrado no esqueleto; divergente = incompatibilidade; não verificável = falta evidência externa. Ausência de evidência não prova indisponibilidade da plataforma.

## Achados verificáveis
- src/mcp/index.ts: mock padrão; modo real lança erro. src/mcp/types.ts é interface interna reduzida, não schema das 24 tools.
- src/agent/agent.ts: palavras-chave, endereço fixo addr-1, sessões em Map global. Escolha chama createCart antes de aprovação; explicit=true chama submitOrder. Hoje simulado, mas divergente da aprovação antes de adição e compra externa. Não conectar esse fluxo a escrita real.
- src/app/page.tsx e src/app/api: texto, cartões e pedido/status simulados. Sem OAuth ou identidade autenticada; sessionId não é autorização.
- src/reco/rank.ts: ranking determinístico com fixtures; até três lojas. Ausência no histórico recente não prova que nunca pediu; frequência não prova favorito declarado. Revisar justificativas.
- Orçamento de item não garante teto total com frete/taxas. Sem filtros rígidos de alergia ou negociação explícita de limites; composição desconhecida não autoriza declarar segurança.
- src/memory/store.ts: RAM com consentimento local, sem Supabase/RLS e controles completos ligados à UI.
- src/reco/rank.test.ts: quatro testes unitários; não provam OAuth, MCP real, aprovação versionada, alergias, total, handoff ou isolamento.
- .env.example tinha valores com formato de credenciais, removidos nesta revisão. Validade não testada; se reais, revogar/rotacionar nos provedores. Histórico Git permanece. Não remover .gitignore nem publicar .env.

## Decisões 1–39
Referências completas no apêndice A da proposta. Estado documental atendido não significa recurso implementado.
| Decisão | Estado | Evidência / pendência |
|---|---|---|
| 1 | atendido no recorte | Refeições em fixtures; Market fora do P0. |
| 2 | atendido documentalmente | Público amplo; pesquisa pendente. |
| 3 | parcial | Texto existe; voz ausente. |
| 4 | divergente | Mock finaliza pedido; falta compra externa. |
| 5 | parcial | Histórico fixture/RAM; MCP real ausente. |
| 6 | parcial | Next.js existe; deploy não verificado. |
| 7 | atendido documentalmente | Gratuidade/benefícios hipotéticos; sem impacto comprovado. |
| 8 | não verificável | Dores ainda não pesquisadas. |
| 9 | parcial | Até três opções; refinamento limitado. |
| 10 | parcial | Ranking existe; filtros/adaptação incompletos. |
| 11 | ausente | Sem negociação explícita. |
| 12 | ausente | Sem transferência/link/resumo validado. |
| 13 | parcial | Entrada sem login; sem recursos protegidos reais. |
| 14 | parcial | Sessão textual efêmera; dados fictícios. |
| 15 | parcial | Store RAM; controles/híbrida ausentes. |
| 16 | parcial | Sem onboarding; palavras-chave limitam diálogo. |
| 17 | divergente | Preço de item não garante teto total. |
| 18 | ausente | Cinco modos pendentes. |
| 19 | parcial | Pratos/lojas fictícios. |
| 20 | divergente | createCart antes de aprovação; sem versão. |
| 21 | parcial | Uma loja por seleção; política multiloja ausente. |
| 22 | ausente | Sem revalidação material. |
| 23 | não verificável | Tracking mock; pós-checkout externo não comprovado. |
| 24 | ausente | Sem comandos de voz. |
| 25 | divergente | Endereço fixo. |
| 26 | ausente | Sem filtros de alergia/incerteza. |
| 27 | ausente | Sem abertura contextual; sem notificações externas. |
| 28 | ausente | Sem feedback integrado. |
| 29 | parcial | Testes de ranking; pesquisa/comparação ausentes. |
| 30 | parcial | Mock sinalizado; integração real ausente. |
| 31 | ausente | Sem adaptador de fala/fallback. |
| 32 | parcial | Ranking/cálculos determinísticos; LLM ausente. |
| 33 | ausente | Sem benchmark; modelo não escolhido. |
| 34 | ausente | Sem Supabase/PostgreSQL. |
| 35 | parcial | Sem áudio persistido; isolamento/retenção incompletos; template corrigido. |
| 36 | não verificável | Verificações locais abaixo; deploy/OAuth não testados. |
| 37 | parcial | Texto e recomendações mock; P0 real pendente. |
| 38 | atendido documentalmente | Equipe registrada; sem atribuições novas. |
| 39 | parcial | Auditoria feita; falta alinhamento de recorte/responsáveis. |

## RF, RNF e critérios de aceite
Inspeção não equivale a teste de aceitação.
| ID | Estado | Evidência / limite |
|---|---|---|
| RF-01 | parcial | Refeições mock |
| RF-02 | parcial | Texto/sessão RAM |
| RF-03 | ausente | Sem voz |
| RF-04 | parcial | Visitante em mock |
| RF-05 | ausente | Sem OAuth/MCP real |
| RF-06 | parcial | Até três opções; explicações incompletas |
| RF-07 | ausente | Sem filtros rígidos |
| RF-08 | ausente | Cinco modos pendentes |
| RF-09 | divergente | Limite de item não é total |
| RF-10 | ausente | Sem negociação explícita |
| RF-11 | divergente | createCart anterior à aprovação; compra interna mock |
| RF-12 | parcial | Uma loja por seleção |
| RF-13 | ausente | Sem revalidação material |
| RF-14 | ausente | Sem handoff/fallback |
| RF-15 | divergente | Endereço fixo |
| RF-16 | ausente | Sem feedback |
| RF-17 | parcial | RAM; controles incompletos |
| RF-18 | ausente | Sem confirmação duradoura |
| RF-19 | ausente | Sem proatividade |
| RF-20 | não verificável | Tracking só mock |
| RF-21 | parcial | Mock identificado; sem operação real |
| RF-22 | parcial | Sem onboarding; diálogo limitado |
| RNF-01 | ausente | Sem isolamento autenticado; sessionId não autoriza |
| RNF-02 | parcial | Template limpo; histórico exige avaliação/rotação |
| RNF-03 | parcial | Schemas parciais; contratos reais não exercitados |
| RNF-04 | divergente | Aprovação posterior; sem versão |
| RNF-05 | parcial | Texto; falhas externas não exercitadas |
| RNF-06 | parcial | Cálculos/ranking; filtros incompletos |
| RNF-07 | ausente | Sem evidência de logs operacionais sanitizados |
| RNF-08 | ausente | Sem métricas de latência/custo |
| RNF-09 | não verificável | Sem teste de teclado/foco/leitor |
| RNF-10 | parcial | Verificações locais abaixo; sem deploy |
| RNF-11 | parcial | RAM; retenção/exclusão por identidade pendentes |
| RNF-12 | parcial | Interface MCP; demais adaptadores ausentes |
| AC-01 | parcial | Visitante mock; sem teste browser |
| AC-02 | ausente | Sem OAuth |
| AC-03 | ausente | P0 sem MCP real |
| AC-04 | parcial | Quatro testes ranking; proveniência incompleta |
| AC-05 | divergente | Teto total não garantido |
| AC-06 | ausente | Alergias não filtradas |
| AC-07 | ausente | Sem negociação rígido/flexível |
| AC-08 | divergente | Escolha chama createCart mock |
| AC-09 | ausente | Sem aprovação versionada |
| AC-10 | ausente | Sem handoff/fallback |
| AC-11 | divergente | Endereço fixo |
| AC-12 | não verificável | Sem voz; texto disponível |
| AC-13 | ausente | Sem persistência/RLS/controles |
| AC-14 | não verificável | Sem deploy testado |
| AC-15 | parcial | Documentação distingue estados; roteiro/UI pendentes |

## Trello — leitura sem redistribuição
[Quadro principal](https://trello.com/b/ZcLDfKqU/hackathon-ifood), 13 cards: A Desenvolver 8; Desenvolvendo 2; Em Revisão 0; Pronto 3. Sem responsáveis/checklists estruturados retornados; não inferir donos pelos títulos.
- [Dividir as tasks](https://trello.com/c/Z5QN9jIm), Desenvolvendo: alinhar após auditoria.
- [Entregável 01](https://trello.com/c/ZdqcpGU8), Desenvolvendo: resumo e proposta canônica nesta revisão; aceite depende de revisão humana.
- [Infra MCP](https://trello.com/c/ymJqCQH3): critérios antigos de SMS/callback/pedido precisam alinhar OAuth por ambiente e compra externa.
- [Guia](https://trello.com/c/ccWrGQBt), [rascunho](https://trello.com/c/JqlySTnS), [gravação](https://trello.com/c/MLf104qZ), Pronto. Rascunho concluído não significa proposta atual implementada.
- Entregáveis 02–06 e pitch: A Desenvolver; nenhuma entrega final verificada. Dez feedbacks no card 06 não são resultados existentes nem meta de teste aprovada automaticamente.
- [retirar .env e gitignore](https://trello.com/c/xaPZMJ5e): título ambíguo e descrição vazia não autorizam retirar proteção.
Nenhum card movido, reatribuído ou concluído nesta atualização.

## Correções e próximos passos
Proposta incorporada integralmente; README/contexto/AGENTS/frentes alinhados; produto-v1 marcado obsoleto; contexto anterior arquivado; decisões antigas preservadas; guia com aviso de escopo; resumo de negócio adicionado.
regras-de-negocio.md intacto por regra humana. Formalizar RN em PR humano próprio; agentes não inventam aprovação.
Equipe revisa matriz e define P0/responsáveis. Validar leitura MCP; corrigir contratos/consentimento/handoff antes de escrita; testar total, alergias, mudanças e isolamento; demonstrar dado real influenciando recomendação; ampliar P1 e preencher entregáveis com evidências.
Este PR documental e de higiene do template não corrige runtime divergente nem conclui P0.

## Branch remota ainda não integrada
feat/esqueleto-andante em c64eff2 contém 60424be (medidor local de tokens/TTS/STT, endpoint /api/usage, testes e proteção .usage/) e merge de main. Nenhum PR aberto retornado pela consulta GitHub.
Inspeção: medidor exige instrumentação manual por chamada e mede uso local; não é faturamento oficial nem limite atômico de requisições concorrentes. /api/usage não possui autenticação no código da branch. Nenhuma chamada real de provedor foi demonstrada.
Não integrado automaticamente nesta revisão documental. Ao abrir PR, reconciliar docs/frentes e renumerar a entrada D-006 da branch para não colidir com as decisões acrescentadas aqui; preservar ambas as decisões históricas.

## Validação documental e ambiente
- Proposta canônica idêntica ao arquivo fornecido: SHA-256 0EBB4D1CC1B405E42902381B8DBB6A4F942E1839533CF353BB2EA9CA9F58A555.
- Matriz validada automaticamente: 39 decisões em ordem, 22 RF, 12 RNF e 15 AC sem duplicatas; links locais dos documentos ativos resolvem; campos de credenciais removidos estão vazios.
- npm ci --ignore-scripts: 370 pacotes instalados com lockfile preservado. Scripts de instalação não executados.
- npm run lint: passou. npm test: 1 arquivo, 4 testes passaram. Aviso Vite sobre configuração CommonJS/ESM permanece; sem falha de testes.
- Primeira tipagem limpa falhou: LayoutProps não gerado. Script corrigido para next typegen && tsc --noEmit conforme docs instaladas; sem mudança na lógica do produto.
- npm audit: 5 entradas high na cadeia de desenvolvimento ESLint (eslint-config-next, @next/eslint-plugin-next, fast-glob, micromatch, braces). Não representam necessariamente cinco falhas independentes. Sugestão automática troca versão principal de eslint-config-next; não aplicada sem revisão de compatibilidade. Exposição explorável não avaliada nesta auditoria documental.
- Sem teste de navegador, OAuth, MCP real, compras, deploy ou consumidores. Testes unitários não validam P0 completo.
- Resultado final: npm run typecheck passou com geração de tipos; npm run build passou (Next.js 16.4.2, página e três rotas de API). git diff --check passou.
