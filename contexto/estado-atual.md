# Estado atual — 17/10/2026

Base auditada: main 0867abc; esqueleto no PR #4 / 6c1b414. Esta atualização reconcilia documentação e limpa o template; não implementa a proposta inteira.

## Decisões e fontes
[Proposta final](../docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md): decisões 1–39 aprovadas, sem resultados experimentais inventados.
[Auditoria](../docs/AUDITORIA-ALINHAMENTO-2026-10-17.md): matriz completa de 39 decisões, 22 RF, 12 RNF e 15 AC, evidências e lacunas.
Stack definida: Next.js 16, React e TypeScript. Kenzo integra/revisa; Terossi, Malveste e Hyago compõem o time. Novas frentes ainda sem atribuição.

## Existe na main
Texto, parser de palavras-chave, ranking determinístico, fixtures, carrinho/pedido/status simulados e memória RAM. Guia técnico documenta 24 ferramentas; isso não prova autenticação nem disponibilidade real.
MCP_MODE=real lança erro. Voz, LLM, OAuth, Supabase/RLS, feedback completo e deploy público não comprovados/implementados.

## Divergências prioritárias
Compra aprovada termina no iFood, mas mock usa submitOrder. createCart acontece antes de aprovação. Faltam vínculo de versão/revalidação, total com taxas, filtros rígidos de alergia e seleção de endereço real.
Não conectar escritas reais antes de corrigir contratos e guardrails. Próximo P0 precisa de contexto MCP real relevante; mock sozinho não satisfaz D37.

## GitHub/Trello e limites
Trello lido: 13 cards (8 A Desenvolver, 2 Desenvolvendo, 0 Em Revisão, 3 Pronto). Nenhum card alterado ou nova tarefa atribuída.
Branch remota feat/esqueleto-andante em c64eff2 possui medidor de consumo ainda fora da main; não incorporado automaticamente. Preparações locais antigas não commitadas foram preservadas.
Arquivo humano regras-de-negocio.md intacto e ainda incompleto; formalização humana pendente.
Valores com formato de credenciais removidos de .env.example. Se eram válidos, exigem revogação/rotação; histórico Git não foi reescrito.
Sem nova compra, autenticação MCP, deploy, teste de usuários ou alteração de produção nesta auditoria.

## Próximo
Equipe revisa auditoria, valida operações MCP e define recorte P0/responsáveis antes da distribuição. Revisão/merge deste PR pelo integrador. Testes e limitações registrados na seção de validação da auditoria.

## Verificações desta revisão
Proposta byte a byte preservada; 39 decisões/22 RF/12 RNF/15 AC e links conferidos. Lint e quatro testes passaram. Typecheck recebeu geração prévia dos tipos do Next após falha em checkout limpo; resultado final e build na auditoria. npm audit aponta 5 entradas high na cadeia ESLint, pendentes de revisão de compatibilidade.
- Resultado final: typecheck, lint, quatro testes e build passaram. Nenhuma validação externa MCP/checkout decorre desses resultados.

## Plano operacional publicado — 17/10/2026
- PR #5 integrado na main em 88e72d1. Novo documento fornecido pelo usuário: docs/PLANO_EXECUCAO_EQUIPE_FOODPILOT.md, preservado integralmente.
- O plano define 24 tarefas: Kenzo integração/contratos/guardrails/ranking/revisão e merge; Terossi voz/LLM; Malveste UI/UX; Hyago MCP/OAuth/dados. Supera o status histórico de atribuições pendentes; tarefas não estão executadas por sua publicação.
- Esta atualização somente publica o Markdown e seu link de entrada. Não altera Trello, runtime ou regras humanas; não executa as tarefas do plano.

## Direção V2 e reorganização do repositório — 17/10/2026, ~20h
- **Proposta, aguardando aceite do integrador:** `docs/DIRECAO_V2_OCASIAO.md` (D-011) e `docs/PLANO_V2_PAPEIS_E_CRONOGRAMA.md` (D-012). Índice dos documentos em `docs/INDEX.md`.
- **Funções propostas:** Felipe (Conversação e Voz), Hyago (System Prompt e Fluxo de Agentes), Kenzo (Request e Dados), Malveste (Interface e Front-End).
- **Trello:** 8 cards novos (OCS-01 a 04, INS-01/02, UX-01, DEMO-01) e comentários em 5 cards antigos. Donos nos títulos ainda seguem o plano anterior; renomear só após o aceite.
- **Repositório:** README, AGENTS.md, `docs/frentes.md`, contexto e pastas novas com README (`src/voice`, `src/prompts`, `src/evals`, `src/domain`, `src/data`, `src/ui`) e esqueletos dos entregáveis 02 a 06. **Nenhum código de runtime foi alterado.**
- **Pendente:** gate das verticais (21h), contratos de Ocasião, Necessidade e Plano (21h30), provedor de LLM e dono da chave, endereço da demo, regra de revisão de PR (CODEOWNERS), medidor de consumo (ainda na branch `feat/esqueleto-andante`).
- **Segurança:** valores com formato de credencial permanecem no histórico Git; revogar/rotacionar antes de tornar o repositório público.

## Plano de implementação de Kenzo — 17/10/2026
- Base remota consultada: origin/main e85cd2b, merge do PR #6. Plano local em docs/PLANO_IMPLEMENTACAO_KENZO.md organiza as 12 tarefas de Kenzo, com contratos e guardrails antes da integração real.
- FP-01 segue parcial: base e código conferidos; fila de PRs/cards, coordenação com colegas e baseline ainda pendentes. Nenhuma FP de implementação concluída nesta documentação.
- Próximo: concluir FP-01, preparar FP-02 e revisão independente. Sem alteração de runtime, Trello, deploy ou regras humanas.

## FP-02 — contratos mínimos, fatia 1 (17/10/2026)
- Branch feat/kenzo-contratos-minimos, base e85cd2b; plano local anterior preservado. Consulta gh pr list retornou zero PRs abertos nesta execução; Trello/coordenação e aceite dos consumidores ainda pendentes, FP-01 parcial.
- Contratos aditivos em src/contracts/proposal.ts: centavos seguros, custo com ausências explícitas, restrições, snapshot versionado, pedido de aprovação sem identidade do cliente e erros normalizados. Exemplos/testes e limites em src/contracts/README.md.
- Validação final: typecheck, lint, 18 testes e build passaram; git diff --check sem erros. Nenhuma rota foi conectada ao novo contrato; guardrails de servidor continuam pendentes na FP-06. FP-02 parcial, aguardando demais fronteiras e revisão.
- Recuperados HEAD e referência da branch com bytes nulos após interrupção: base exata confirmada no reflog, cópias preservadas fora do repo em work/evidence/git-recovery-contracts. git status voltou a funcionar, alterações locais preservadas.

## FP-02 — intenção, contexto e resposta pública (17/10/2026)
- Contratos aditivos em src/contracts/recommendation.ts e proposal-state.ts: intenção sem execução transacional, propósitos autorizados internos, origem real/mock, razões ligadas a evidências, projeção pública mínima e grafo de estados. Formato validado não prova autorização, atualidade nem veracidade; domínio e adaptadores precisam validar essas condições.
- Trello lido: KEN-01 (https://trello.com/c/WJYltPQt) em Desenvolvendo. Nenhum card alterado nesta implementação. FP-01 ainda depende de coordenação/aceite humano das fronteiras.
- Revisor independente temporário encontrou duas inconsistências de aprovação no schema público; corrigidas com validação cruzada de estado/snapshot e invariantes de subtotal/pendências, cobertas por testes negativos diretos.
- Validação final: typecheck, lint, 25 testes e build passaram após correções; git diff --check sem erros. FP-02 aguarda revisão dos consumidores e migração; rotas legadas não alteradas. Próximo: alinhar os contratos com Hyago/Terossi/Malveste e implementar guardrails de servidor na FP-06.

## FP-06 — domínio de proposta local (17/10/2026)
- src/agent/proposals.ts implementa criação, revisão, edição com nova versão, cancelamento e aprovação vinculada a sujeito/versão/interação, com validade e cópias defensivas. Não recebe cliente MCP nem executa operação remota. Identidade deve vir de sessão de servidor validada na integração futura.
- Armazenamento efêmero com capacidade configurada; libera registros cancelados/vencidos ao atingir limite. Aprovação atômica só na instância local; múltiplas instâncias e execução remota continuam bloqueadas até coordenação transacional apropriada.
- Revisão independente de segurança apontou retenção de capacidade e sobrescrita de estado terminal; corrigidas. Testes cobrem sessão alheia, versão, replay, expiração exata, cancelamento, remoção de endereço e capacidade.
- FP-06 parcial: rotas/identidade real, remoção do alcance legado de submitOrder e revalidação externa ainda pendentes. Nenhuma escrita real habilitada. Validação final: typecheck, lint, 35 testes, build e git diff --check passaram. Revisor confirmou as correções por leitura. Alterações locais sem publicação.

## FP-06 — rotas e jornada mock integradas (17/10/2026)
- Supera as pendências locais de rotas/alcance legado acima: chat/confirm usam sessão opaca emitida pelo servidor, aprovação por sujeito/versão e operações serializadas por visitante. sessionId legado é ignorado para identidade; explicit=true não aprova. JSON limitado, origem validada e erros sanitizados sem cache.
- O agente não chama createCart, submitOrder ou trackOrder; order responde 410. Busca/refinamento cancela proposta antes de I/O; troca de endereço descarta opções anteriores. Sem OAuth/MCP real; o modo real falha fechado. Seleção exibe proposta local; taxas ausentes deixam total desconhecido e bloqueiam aprovação.
- Políticas locais e integração para Malveste/Hyago em docs/INTEGRACAO_PROPOSTA_LOCAL.md. Única edição em page.tsx: efeito de rolagem sem retorno, expressamente autorizado pelo usuário após erro de cleanup React no navegador; layout intacto.
- Validação final: typecheck, lint, 49 testes em oito arquivos, build e diff passaram. Smoke HTTP servido passou em localhost e 127.0.0.1; navegador confirmou busca → seleção → proposta pendente → cancelamento. Aprovação positiva testada apenas com fixture completa no servidor, sem operação remota. Captura fora do checkout: work/evidence/fp06-proposta-local.png.
- Revisor security não confirmou bypass nos limites revisados; risco de esgotamento de sessões anônimas é pendência antes de deploy público. Persistência entre instâncias, identidade/OAuth, dados completos/revalidação MCP e aceite humano continuam pendentes; FP-06/P0 real não concluídos. Contraste do tema escuro observado na captura segue para UI. Nenhum commit, PR, Trello, compra ou deploy nesta fatia.

## Preparação de PR — FP-02/FP-06 (17/10/2026)
- Usuário solicitou publicação do PR para realizar o merge pessoalmente. Reconfirmada origin/main em e85cd2b e nenhuma outra PR aberta na consulta; branch feat/kenzo-contratos-minimos.
- Entrega coesa: contratos e proposta local necessários para retirar compra interna do fluxo textual mock. Card: https://trello.com/c/WJYltPQt (KEN-01). A proposta não fecha FP-05 nem P0 real; aceite humano/consumidores e merge seguem pendentes.
- Validações e limites na seção anterior e em docs/INTEGRACAO_PROPOSTA_LOCAL.md. Preparação em commits separados para contratos, domínio, rotas e documentação; nenhuma alteração em src/mcp, src/reco ou regras humanas.

## PR de implementação aberto — 17/10/2026
- PR #7: https://github.com/KenzoOsako/hackathon-ifood-semcomp/pull/7, branch feat/kenzo-contratos-minimos → main e85cd2b. Aberto para revisão/merge do usuário, sem conflitos na consulta; nenhum merge executado por este chat.
- Revisão independente de e85cd2b..0a2e1f38205450860ddba4fea34befc2132ec99e não encontrou regressão acionável adicional; revisão por leitura, distinta do aceite humano. Typecheck/lint/49 testes/build passaram no código publicado. Commit posterior acrescenta apenas este registro documental.
- Card KEN-01 vinculado ao PR; revisão dos consumidores e limites pré-deploy permanecem pendentes. Nenhum check de CI foi retornado pelo GitHub; resultados acima são locais, não CI aprovado.

## Revisão do PR #7 e poda do backlog — 17/10/2026, ~20h40
- PR #7 (contratos mínimos, proposta local, compra interna eliminada) está na `main`; `typecheck`, `lint`, 49 testes e `build` passam.
- **Bloqueios para a demo:** aprovação inalcançável (toda proposta nasce com taxas e total não confirmados) e UI sem botão de aprovação. Detalhes e backlog enxuto (34 → 22 tasks) em `docs/REVISAO_PR7_E_BACKLOG_V2.md`.
- **IDs de decisão:** as decisões da V2 foram renumeradas para **D-011 e D-012** (D-007 a D-010 são do Kenzo).
- Nenhum card do Trello foi alterado; a poda é proposta.

## Plano do agente (frente Hyago) — 17/10/2026, ~21h
- `docs/BRIEFING_AGENTE.md`: arquitetura do agente na V2 (orquestrador guiado por código, saída estruturada, estado da sessão, funções de domínio, `/api/converse`, L0/L1/L2).
- `docs/PLANO_AGENTE.md`: marcos M0–M4 alinhados aos gates G2–G5, divisão em dupla (Hyago + parceiro a definir), definição de pronto do core.
- D-013 (proposta): LangChain.js isolado em `src/agent/llm/`, sem LangGraph. Nenhum código de runtime alterado; dependências ainda não instaladas.
- Pendente: aceite de D-011/D-012/D-013, parceiro da dupla, provedor/chave de LLM; depende de K-1, K-3, K-5 (Kenzo) e M-1 (Malveste).

## UI: setup do design system — 17/10/2026
- Branch `feat/malveste-ui-setup`: Tailwind v4, tokens em `globals.css`, componentes base em `src/ui/components`, lucide-react e motion instalados (D-014). Nenhuma tela mudou; `page.tsx` e rotas intactos.
- Validação: typecheck, lint, testes e build passaram; classes Tailwind e tokens confirmados no CSS servido pelo dev. Verificação visual em 375px e desktop fica para o PR da home, que tem tela nova.
- Pendente: aviso ao integrador sobre `package.json`/lockfile; dark mode fora do escopo; próximo PR `feat/malveste-ui-home`.

## UI: home fake e moldura de celular — 17/10/2026
- Branch `feat/malveste-ui-home` (empilhada sobre `feat/malveste-ui-setup`; rebase quando o setup for mesclado). `/` agora é a home estilo iFood, toda estática e com dados genéricos; a única parte funcional é a bolinha (link para `/agente`). Selo "Protótipo · dados simulados" visível.
- O chat do esqueleto foi movido sem alterações de lógica para `src/app/agente/page.tsx` (só o container de rolagem mudou) e será refeito no PR da tela do agente. `PhoneFrame` no layout: moldura de 390px no desktop, tela cheia abaixo de 640px.
- Validação: typecheck, lint, 49 testes e build passaram; capturas em Chrome headless a 375px (via iframe, pois a janela headless tem largura mínima) e 1280px conferidas. Texto sobre vermelho usa `--primary` por contraste AA. Teclado: a bolinha é o único foco da home. Falta teste com leitor de tela.

## Agente: decisões de implementação e preocupações — 17/10/2026, ~20h30 (Hyago)
- Cérebro no backend: orquestrador (Hyago) decide perguntar/buscar/montar/ajustar; domínio (Kenzo) busca no MCP e ranqueia; LLM interpreta e fala, sem aprovar nem comprar.
- ElevenLabs só ouve e fala (STT + TTS), sem conduzir a conversa. O agente é entregue funcionando por texto; a voz conecta depois no mesmo endpoint. Provedor/modelo de LLM não fixado (configuração).
- Prompt do spike (src/voice/agent-prompt.md) dividido em interpretar/responder; dados de exemplo viram fixtures do domínio fake; teto de perguntas, anti-repetição e S5 garantidos em código.
- Preocupações registradas: latência (2 chamadas de LLM + MCP + TTS; medir por etapa desde o M1), erros de reconhecimento, fala inventando número, atraso de K-3/K-5/K-1/M-1, provedor e chave de LLM a confirmar.
- Detalhes: docs/BRIEFING_AGENTE.md e docs/PLANO_AGENTE.md. Nenhum código de runtime alterado.

## Agente Guide no backend — M0/M1 (17/10/2026, ~21h, Hyago)
- Implementado em feat/hyago-agente: src/agent/types.ts, orquestrador (src/agent/orchestrator), domínio simulado com os dados do spike (src/agent/domain-fake), LLM via LangChain (src/agent/llm, provedor/modelo por LLM_PROVIDER/LLM_MODEL; sem eles, interpretador por regras), prompts (src/prompts), evals (src/evals) e POST /api/converse com os guardas de http.ts e sessão por cookie.
- Regras em código: teto de 3 perguntas (1 em L1), nível só rebaixa, pressa força L0, aprovação só com frase explícita e só devolve planoId+versão, restrição rígida por sessão, plano vazio não é encaminhado, fala do LLM com número fora do snapshot cai para template.
- Verificação: typecheck, lint, 100 testes (12 cenários de eval + testes do orquestrador) e build passaram; jornada do aniversário e caso rápido rodados no app servido. Revisão independente: 16 achados, altos e médios corrigidos com testes.
- Não verificado: LLM real (sem LLM_PROVIDER configurado nesta máquina); compatibilidade do schema Zod com withStructuredOutput de cada provedor; domínio real (K-3/K-5) e aprovação na tela (K-1/M-1).

## UI: tela do agente — 17/10/2026
- Branch `feat/malveste-ui-agente` (empilhada sobre `feat/malveste-ui-home`). `/agente` é a tela do assistente: "Qual a sua vibe de hoje?", orbe com cinco estados (idle, listening, thinking, speaking, error) sempre com texto de status, conversa por texto contra `POST /api/chat` (cookie de sessão, sem `sessionId`), transcrição recolhível, erro com "Tentar de novo" e sugestões fixas de atalho.
- Microfone desabilitado ("voz em breve"): o encaixe é `voiceState` e `onMicClick` em `AgentScreen`, para a frente de voz ligar. Ao receber `options` mostra só um aviso com botão desabilitado; a tela de opções é o próximo PR.
- Validação: typecheck, lint, 49 testes e build passaram. Fluxo conferido em 375px via Chrome DevTools Protocol (bolinha → agente → sugestão → resposta do mock → transcrição): console limpo, sem rolagem horizontal. Falta teste com leitor de tela e verificação dos estados listening/speaking, que dependem da voz.

## UI: opções, proposta e aprovação — 17/10/2026
- Branch `feat/malveste-ui-opcoes` (empilhada sobre `feat/malveste-ui-agente`). Rotas novas: `/agente/opcoes` (até 3 cartões, cada um com rótulo, motivos de `reasons`, preço, frete e ETA estimado), `/agente/proposta` (itens, frete, taxas, total ou "pendente", pendências e três ações separadas: Aprovar, Mudar o pedido, Cancelar) e `/agente/previa` (dados fixos para revisar o visual dos estados). A conversa é compartilhada por `AgentProvider`; o estado devolvido pelo servidor decide a tela.
- Aprovar envia `{proposalId, version, interactionId, channel: "button"}` para `/api/confirm` com a versão exibida; cancelar e escolher usam `/api/chat` ("cancelar", "1".."3"). A UI não soma nada: ausência de frete/taxas vira pendência, e o botão fica bloqueado com pendências ou proposta expirada.
- Lacunas de contrato para o Kenzo: a proposta pública não traz nome do item, nome da loja nem endereço (a UI usa a opção escolhida para os nomes e não mostra endereço); as opções legadas não trazem origem real/simulado (`DATA_ORIGIN` fica fixo em mock); a aprovação real segue inalcançável até o K-1 (hoje toda proposta nasce com total desconhecido). Comparar opções lado a lado e rejeitar uma opção específica não foram feitos: só há "Refinar a busca".
- Visual: Bricolage Grotesque para títulos, rótulos e preços (via next/font, sem dependência nova); Geist no texto. Validação: typecheck, lint, 49 testes e build passaram; jornada conferida em 375px por CDP (home → agente → opções → proposta bloqueada; prévia aprovável, aprovada, expirada, com pendências), console limpo, sem rolagem horizontal. Falta leitor de tela e foco por teclado verificado.

## UI: palco do orbe e fundo da tela do agente — 17/10/2026
- Na branch `feat/malveste-ui-opcoes`: `OrbStage` (halo, dois anéis, pontos em órbita e ondas) ao redor do orbe e fundo `agent-bg` (brilho rosado + grade de pontos que some nas bordas), tudo em CSS com as cores dos tokens. O estado (`data-state`) só muda o ritmo: órbita acelera ao pensar, ondas ao ouvir/falar, tudo em cinza no erro. Movimento respeita `prefers-reduced-motion`.
- Validação: typecheck, lint, 49 testes e build passaram; capturas a 375px (idle, listening, speaking, error) e desktop, console limpo, sem rolagem horizontal.

## UI: ondas no lugar da órbita — 17/10/2026
- O palco do orbe trocou os pontos em órbita por duas formas líquidas que ondulam (border-radius animado) e três ondas que se expandem a partir do orbe. Ritmo por estado: ondas mais rápidas ao ouvir e ao responder, formas mais agitadas ao pensar, tudo parado e cinza no erro. Só CSS; respeita `prefers-reduced-motion`. Validação: typecheck, lint, 49 testes e build passaram; capturas a 375px sem erro de console.

## UI: orbe orgânico e fundo quente — 17/10/2026
- A pedido do dono da UI, a tela do agente segue a essência de uma imagem de referência: orbe como massa orgânica com gradiente de malha (vermelho, coral, âmbar, vinho) que muda de forma, quatro contornos ondulados como curvas de nível e ondas que se expandem por estado, sobre fundo creme/pêssego. Novos tokens decorativos `--orb-*`, `--warm` e `--peach` em `globals.css`; a bolinha da home usa o mesmo orbe. Só CSS, `prefers-reduced-motion` respeitado. Não feitos: barra inferior com microfone central e chips com ícones.
- Validação: typecheck, lint, 49 testes e build passaram; capturas a 375px sem erro de console.

## UI: tela final e acessibilidade — 17/10/2026
- Branch `feat/malveste-ui-final` (empilhada sobre `feat/malveste-ui-opcoes`). Nova rota `/agente/continuar`: depois que o servidor devolve `PROPOSTA_APROVADA`, mostra "Proposta aprovada. Nenhum pedido foi enviado", um resumo copiável (loja, itens, frete, taxas e total ou "pendente") e três passos para montar o carrinho no iFood. Sem link ou deeplink: transferência automática não existe nesta demo. A prévia ("Aprovada") exibe esta tela.
- Acessibilidade: foco vai ao título ao trocar de tela (`useFocusOnMount`), título de página por rota, `muted-foreground` escurecido para `#5c5c5c` (contraste AA sobre o fundo pêssego), cópia com aviso em `role=status` e fallback de seleção manual.
- Lacuna para o Kenzo: o resumo é montado na UI só reorganizando campos do snapshot; o `buildManualHandoffSummary` de `src/domain/handoff.ts` (K-4) não é servido por nenhuma rota. Ideal: o turno aprovado trazer o texto pronto, para a UI só exibir.
- Validação: typecheck, lint, 92 testes e build passaram; jornada, foco, títulos e cópia conferidos por CDP a 375px, console limpo. Falta teste com leitor de tela real.

## UI: prévia com mais lojas e itens — 17/10/2026
- `/agente/previa` ganhou a aba "3 opções" (açaí, hambúrguer e sushi, com rótulos, motivos e preços inventados) e a proposta passou a ter três itens, um com quantidade 2 ("cada" ao lado do preço unitário). Dados fixos e rotulados como simulados; nada chama a API. `OptionsScreen` foi dividida em `OptionsView` (visual) e `OptionsScreen` (contexto) para a prévia reutilizar a mesma tela. Nomes de itens agora podem vir de um mapa (`itemLabel`), útil enquanto a proposta pública só traz a referência.

## UI: conversa única com resultados no estilo do iFood — 17/10/2026
- Branch `feat/malveste-ui-conversa` (empilhada sobre `feat/malveste-ui-final`). A pedido do dono da UI, `/agente` virou uma tela só e linear: em cima, o que o agente encontrou (lista no formato da busca do iFood com loja, nota, tempo, frete, produto e chips de `reasons`; depois a proposta; depois a continuidade no iFood); embaixo, o painel da conversa com o orbe e as ondas, que desce e encolhe quando chegam resultados. Não há botão de voltar: continuar a conversa refina a lista; "Mudar o pedido" volta à última lista.
- Removidas as rotas `/agente/opcoes`, `/agente/proposta` e `/agente/continuar` e as telas que as serviam; `AgentView` (visual, sem contexto) é usada pela tela real e pela prévia `/agente/previa`, que agora tem os cenários Início, 3 lojas, Proposta, Pendências, Expirada e Aprovada. Abas da busca (Todo o iFood, Restaurantes…) são só cenário. Logos reais não existem: a inicial da loja faz o papel da imagem.
- Validação: typecheck, lint, 92 testes e build passaram; jornada real (sugestão → lista → escolher → proposta → mudar o pedido) conferida a 375px, console limpo, sem rolagem horizontal. Falta teste com leitor de tela na nova estrutura (a troca de tela agora é por região `aria-live`, não por rota; o foco no título por rota deixou de existir).

## UI: orbe no canto sobre campo de ondas — 17/10/2026
- Branch `feat/malveste-ui-ondas` (empilhada sobre `feat/malveste-ui-conversa`). Segundo um desenho do dono da UI, com resultados na tela o painel do assistente deixa de ser uma caixa: o orbe fica pequeno no canto direito e flutua sobre um campo de ondas (cinco linhas finas em senos periódicos que correm em sentidos e ritmos diferentes, `WaveField`), com o texto do assistente à esquerda. O ritmo das ondas acompanha o estado (ouvindo, respondendo, pensando; paradas e cinza no erro). Só CSS/SVG, `prefers-reduced-motion` respeitado. Na abertura continua o orbe grande e centralizado.
- Validação: typecheck, lint, 92 testes e build passaram; jornada a 375px conferida, console limpo.
## Módulos de dados, elegibilidade e ranking com evidências — 17/10/2026
- Worktree isolado `work/gemini-dados`, branch `feat/kenzo-gemini-dados`, atualizada sobre `origin/main` (`fad6231`, que já integra PRs #11/`03d94bf` em `src/mcp/costs.ts`, #12/`d741885` em `src/domain/handoff.ts` e #13 em `src/ui/`). Implementações existentes de custos e resumo manual preservadas integralmente.
- `src/mcp/normalize-candidate.ts` e `src/mcp/normalize-candidate.test.ts`: normalização pura para formato interno (não representa schema oficial do iFood, sem chamadas de rede), reutilizando `@/contracts` e `src/mcp/costs.ts`, validando entradas em runtime e preservando ausências (avaliação, prazo, distância, disponibilidade, composição, histórico e taxas) e origem (`real`/`mock`).
- `src/reco/eligibility.ts` e `src/reco/eligibility.test.ts`: filtros rígidos pré-ranking contra `Constraints` (exclusão por alergia incompatível e por composição ausente/incompleta sem inferir ingredientes pelo nome do prato; teto rígido avaliado sobre o total com encargos necessários; bloqueio de total desconhecido em teto rígido; preferência flexível sem relaxar limite rígido; motivos estruturados de exclusão e pendência).
- `src/reco/rank-eligible.ts` e `src/reco/rank-eligible.test.ts`: ranking determinístico sobre os candidatos elegíveis (até 3 opções sem preenchimento artificial, defesa contra reaparecimento de excluídos, desempate estável, geração de `Recommendation` validada por `RecommendationSchema` com `origins`, `evidence`, `reasons` e `uncertainties`; histórico recente ausente não gera alegação de "nunca pediu" e frequência não vira "favorito declarado").
- Validação local no worktree: `npm run typecheck`, `npm run lint`, `npm test` (14 arquivos, 112 testes) e `npm run build` passaram. Módulos prontos para integração pelo agente/rotas; nenhuma rota, contrato compartilhado, Trello, decisão V2 ou operação externa/MCP real foi alterada ou declarada concluída.

## MCP real comprovado com o agente — 17/10/2026, ~22h (Hyago)
- OAuth PKCE (id.ifood.com.br) com cliente pré-registrado e usuário de teste funcionou; token de 2 h com refresh. tools/list expôs 8 tools filtradas por escopo; listAddresses vazio no usuário de teste; searchOffers real retornou itens em RESTAURANT, GROCERIES e SHOPPING perto da USP São Carlos; getMerchant e getItem OK.
- Latência medida: conectar ~2,2 s e 1,5–2,3 s por tool. Detalhes e implicações em docs/PLANO_AGENTE.md (Estado e próximos passos).
- Feedback registrado: F-002 a F-004 em contexto/feedback-mcp.md. Credenciais do .env eram iguais às que estiveram no histórico do .env.example; o secret foi atualizado localmente. Rotacionar o que estiver no histórico.
- Próximo: McpDomain em src/agent/domain-mcp e cliente MCP + OAuth no app. O Kenzo autorizou o Hyago a implementar as duas peças, inclusive na zona dele (src/mcp, /api/auth, http.ts), com revisão dele.

## Agente com MCP real no app — 17/10/2026, ~23h30 (Hyago)
- `src/agent/domain-mcp/`: `McpDomain` implementa o `DomainPort` com `searchOffers` + normalização, elegibilidade e ranking do Kenzo; rótulos (mais barata = preço + frete, mais rápida, mais bem avaliada) só de campos reais; ajustes reordenam o cache sem nova chamada. 7 testes com respostas reais gravadas (`__fixtures__/search-sao-carlos.json`), incluindo a jornada do aniversário pelo orquestrador.
- `src/mcp/real/`: OAuth PKCE (token só em memória, refresh único 5 min antes, login preso ao mesmo visitante) e cliente MCP por sujeito (D-016). Rotas `/api/auth/{login,concluir,status}` e `/callback`.
- `/api/converse` com `MCP_MODE=real` usa o domínio real; sem login iFood devolve 401 `IFOOD_LOGIN` com `loginUrl`.
- **Prova ao vivo:** login com o usuário de teste, jornada do aniversário pelo `/api/converse`: `mcp=real`, busca real em 2,1 s, plano `origem: real` com loja real de São Carlos; pipoca e presente sem loja aberta à noite (dado real).
- **Não feito:** LLM real não testado (rodou em modo regras); UI ainda usa `/api/chat`, não `/api/converse`; checar presente/pipoca no horário da demo.
- PR #17 (`feat/hyago-mcp-real`) mergeado na `main`.

## K-1 e K-5 — Fluxo aprovável na demo e domínio de proposta integrado (17/10/2026)
- Branch `feat/kenzo-k1-fluxo-aprovavel` sobre `origin/main` (`32bb5b9`, PR #16 integrado).
- `src/contracts/index.ts` e `fixtures/discovery.json`: `CandidateSchema` estendido de forma aditiva com `fees`, `costStatus` e `composition` opcionais; candidatos do mock (`m-1`, `m-2`, `m-4`, `m-5`, `m-6`, `m-7`) passaram a declarar `fees`, `costStatus: "confirmed"` e `composition`, enquanto `m-3` permanece sem `fees` para preservar o caso negativo de aprovação bloqueada por encargos desconhecidos.
- `src/domain/proposal-workflow.ts` e `src/domain/proposal-workflow.test.ts`: lógica de criação/revisão de proposta, aprovação com resumo manual (`buildManualHandoffSummary`) e filtragem pré-ranking (`normalizeCandidates` + `filterEligibleCandidates` + `rankEligibleFilterResult`) extraída de `src/agent/agent.ts`.
- Quando `items`, `delivery` e `fees` são conhecidos e confirmados (ex.: busca por `pizza`), a proposta nasce em `awaiting_approval` com `cost.status: "confirmed"`, `cost.total` preenchido e `unresolved: []`, habilitando o botão "Aprovar proposta" em `/agente/proposta` e `POST /api/confirm` (200 OK) com resumo manual copiável. Quando `fees` ou `delivery` estão ausentes (`m-3`), `cost.status` permanece `"unknown"` e a aprovação continua bloqueada com 400.


## UI: orbe compartilhado (PR A) — 17/10/2026
- Branch `feat/malveste-ui-orbe`. Um só `<Orb size="fab|hero|strip" state=... />` (`src/ui/components/orb.tsx` e `orb-waves.tsx`) substitui `OrbStage`, `WaveField` e o orbe com Motion: núcleo em gradiente (âmbar, vinho e vermelho) com borda dupla, três anéis (1,4x, 1,75x e 2,15x o diâmetro) e três ondas senoidais em SVG atrás, com máscara nas pontas. O diâmetro vem de `--orb-d` (anima ao passar de hero para strip) e a amplitude da onda de `--wave-amp` por estado (idle, listening, thinking, speaking, error). Só CSS/SVG; `prefers-reduced-motion` desliga tudo. Usado na bolinha da home (`fab`, só o núcleo), na abertura (`hero`, 9,5 rem) e na faixa dos resultados (`strip`, 64 px, centralizada, com a legenda acima).
- Novos tokens `--orb-*` e `--cream-*` (fundo creme-pêssego com pontinhos a cada 14 px, aplicado à tela inteira do agente). Vermelho de marca #EA1D2C só em borda, orbe e ícones; texto sobre vermelho segue em #D91A29 (AA). Mesclada a `main` (PR #15 e limpeza do Sonar) mantendo as telas unificadas.
- Validação: typecheck, lint, 144 testes e build passaram; capturas a 375px de home, abertura, ouvindo e faixa falando, console limpo.

## UI: tela de resultados no novo formato (PR B) — 17/10/2026
- Branch `feat/malveste-ui-resultados` (empilhada sobre `feat/malveste-ui-orbe`). Resultados em cartões compactos (`ResultCard`): avatar de inicial, nome, nota · tempo · frete, preço em destaque e prato; um selo por cartão com o rótulo (o da 1ª opção em vermelho cheio, os demais em rosa); só o cartão tocado expande, com uma frase montada só com os textos de `reasons` e os botões Ajustar (foca o campo de texto) e Selecionar. Fim da lista esmaecido. Cabeçalho único (voltar, FoodPilot, Simulado) e linha com a busca em chip e "N opções · total na revisão".
- Estados: carregando (esqueletos), vazio ("Não achei nada nesse limite. Quer subir o orçamento?", com chips que só preenchem o campo), erro (alerta com tentar de novo na legenda), 1 opção (já expandida). O estado vazio ainda não é acionado pelo servidor (sem sinal no contrato); só a prévia o exibe. Prévia `/agente/previa` com dez cenários.
- Decisões tomadas por mim a pedido do dono da UI: #D91A29 no texto sobre vermelho (AA) e #EA1D2C só em borda/orbe; títulos em peso 500; legenda do agente com o texto completo e rolagem interna quando longo; props `Readonly` e `useMemo` no contexto (padrões do Sonar já usados na main).
- Validação: typecheck, lint, 144 testes e build passaram; cenários da prévia e jornada real a 375px conferidos, console limpo, sem rolagem horizontal.

## Gemini no agente — 17/10/2026, ~23h45 (Hyago)
- Gemini ligado pelo adaptador LangChain (`LLM_PROVIDER=google`). Correção em `src/agent/types.ts`: `orcamento.max` passou de `positive()` para `min(1)`, porque o Gemini rejeita `exclusiveMinimum` no esquema da saída estruturada. Branch `feat/hyago-gemini-inferencia`.
- Medição nas 11 evals com LLM real: `gemini-3.5-flash-lite` escolhido (1,0–2,1 s por turno; 7 passaram, 1 falha real, 3 falhas por cota). `3.8-flash` estoura o timeout de 8 s; `3.1-flash-lite` irregular (até 41 s); `2.5-flash` indisponível para chaves novas.
- Falha real: C6 (o modelo não inferiu pipoca/presente da ocasião). Decisão do Hyago: inferir um pouco, como sugestão rotulada, e confirmar o que o usuário disser.
- Cota gratuita do Gemini dá 429 após ~15 chamadas por minuto: para a demo, ativar faturamento.
- Próximos passos e ordem: `docs/PLANO_AGENTE.md` ("Plano seguinte") e `docs/PLANO_INTEGRACAO_VOZ_AGENTE.md` (voz × agente em paralelo).
