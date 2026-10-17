# Plano de implementação — Kenzo / FoodPilot

Data: 17/10/2026. Responsável: Kenzo, com este chat como executor e supervisor.
Fonte de escopo: [plano da equipe](PLANO_EXECUCAO_EQUIPE_FOODPILOT.md). Requisitos: [proposta aprovada](PROPOSTA_DE_NEGOCIO_FOODPILOT.md). Este documento organiza a execução das 12 tarefas de Kenzo; não redistribui tarefas nem substitui as fontes.

## Resultado esperado e ponto de partida

Entregar uma jornada textual que usa contexto MCP real autorizado para alterar recomendações, apresenta até três opções explicadas, permite revisar uma proposta local e continuar a compra no iFood. Voz e memória entram pelos mesmos contratos quando suas frentes estiverem validadas. Mock permite desenvolvimento, mas não fecha o P0 real.

Base remota consultada com `git fetch origin`: `origin/main` em `e85cd2b`, que integra o plano da equipe pelo PR #6. Árvore local limpa antes desta documentação; branch de trabalho `docs/kenzo-plano-implementacao`. Inspeção confirma contratos Zod, ranking e agente do esqueleto. A seleção chama `createCart`, a confirmação chama `submitOrder`, há endereço fixo e frete ausente tratado como zero no ranking. Esses caminhos precisam ser corrigidos antes de habilitar integração transacional. Não há `graphify-out/graph.json` neste checkout.

Esta preparação não conclui FP-01: fila de PRs, Trello, disponibilidade dos colegas e baseline de testes ainda precisam ser revalidados. Nenhuma tarefa de implementação abaixo está concluída por constar neste plano.

## Ordem de execução e gates

| Etapa | Tarefas | Entrega e condição para avançar |
|---|---|---|
| 1. Confirmar base e riscos | FP-01 e FP-14 | Base/PRs/cards conferidos, arquivos coordenados, baseline registrado e parecer de segredos/branch de uso. Bloqueios de segurança identificados antes de habilitar recursos afetados. |
| 2. Liberar interfaces comuns | FP-02 | Contratos, estados, exemplos e testes mínimos; revisão dos consumidores Hyago, Terossi e Malveste. Sem assumir que pseudocódigo do plano é schema externo. |
| 3. Tornar a proposta segura | FP-06 | Seleção/edição/cancelamento locais; aprovação versionada revalidada no servidor; compra interna inalcançável. Gate B0 antes de qualquer escrita real. |
| 4. Tornar recomendações corretas | FP-05 | Total e filtros rígidos antes do ranking, até três opções, razões rastreáveis e refinamento. Fixtures primeiro; prova real depende de FP-04. |
| 5. Costurar a jornada | FP-15 | Integrar FP-04/05/06/07/08/11 e comprovar influência do contexto real. Integrar voz/memória apenas com seus gates satisfeitos. |
| 6. Validar e publicar | FP-16 e FP-17 | Matriz AC executada na revisão candidata; preparar deploy, obter aprovação de publicação e validar ambiente público separadamente. |
| 7. Fechar entrega | FP-18/19/21/24 | Documentos atualizados durante a execução, finalizados com evidência da revisão demonstrada; dois ensaios e submissão humana comprovada. |

FP-18 pode avançar após FP-01; FP-19 começa após FP-02 e é reconciliada após FP-15. FP-21 recebe evidências por PR. Reservar janelas de revisão B0/P0 entre fatias para não bloquear os colegas. Não esperar todas as frentes para testar domínio e contratos.

## Fatias de implementação e aceite

| FP | Trabalho e arquivos previstos | Aceite verificável / dependências |
|---|---|---|
| FP-01 | Ler contexto vigente; conferir HEAD, árvore, PRs e cards; registrar fronteiras e responsáveis por revisão. `contexto/estado-atual.md` e registro de evidências. | Base exata, fila, baseline e arquivos ocupados registrados. PRs #5/#6 presentes na base confirmada; mudanças locais alheias preservadas. Não inferir card concluído pelo merge documental. |
| FP-14 | Parecer sanitizado sobre exposição histórica e branch do medidor de uso. Inspeção controlada de histórico/config; triagem da cadeia ESLint relatada pela auditoria. | Registrar provedores afetados sem valores, pendências dos titulares e exposição do endpoint de uso; não incorporar branch sem revisão. Rotação, reescrita de histórico e atualização de dependência principal seguem aprovação aplicável. Triagem não equivale a correção. |
| FP-02 | Evoluir `src/contracts/index.ts`; exemplos e testes em `src/contracts/`. Definir intenção, contexto autorizado/origem, custos, restrições, recomendação, proposta, aprovação e erros. | Um exemplo válido, inválido e erro por fronteira; estados/transições claros; consumidores revisam. Inteiros em centavos para cálculos internos, com conversão explícita na borda dos valores decimais legados. Campos ausentes continuam ausentes. Compatibilidade transitória não mantém compra interna alcançável. |
| FP-06 | Módulos novos de domínio/proposta sob ownership de Kenzo; adaptação coordenada de `src/agent/agent.ts` e `src/app/api/confirm/route.ts`; revisar alcance de `src/app/api/order/route.ts`. | Proposta com ID/versão/validade, vínculo de identidade derivado no servidor, estado e pendências. Selecionar/editar/cancelar não chama MCP de escrita. Negar versão antiga, expiração, sessão alheia e replay; mudança material invalida aprovação. Serialização por proposta evita dupla escrita; timeout ambíguo não é repetido automaticamente. `submitOrder`/pagamento inacessíveis pelo fluxo e ferramentas do LLM. AC-08/09. |
| FP-05 | Evoluir `src/reco/rank.ts` e testes; módulos auxiliares de custo/filtros se necessários. | Validar valores monetários; total desconhecido não é zero nem recebe selo de teto respeitado. Excluir incompatibilidade rígida; composição ausente não vira alegação de segurança para alergia. Até três elegíveis, ordenação determinística e razões com origem/evidência. Histórico recente não prova “nunca pediu”; frequência não prova favorito declarado. Refinar flexível sem afrouxar limite rígido. AC-04/05/06/07; AC-03 só após dados reais de Hyago. |
| FP-15 | Integrar `src/agent/agent.ts`, rota `src/app/api/chat/route.ts` e demais rotas explicitamente acordadas. Terossi fornece interpretação em módulo separado; Hyago portas MCP; Malveste consome resposta. | Texto → autorização/contexto → ranking → proposta → revisão/aprovação → continuidade suportada. Saída LLM inválida pede esclarecimento. Erros de autenticação não viram mock silencioso. Zero/um/vários endereços tratados, sem `addr-1` fixo. Handoff validado, link confirmado ou resumo manual; sem compra interna. Comparar cenário com/sem dado MCP autorizado para provar AC-03. |
| FP-16 | Testes dos módulos e rotas afetados; registro integrado AC-01–15 em `docs/` com referências sanitizadas. | Resultado por AC: aprovado, falhou, bloqueado, não executado ou não aplicável justificado. Registrar revisão, ambiente, horário São Paulo, responsável e evidência. Testes negativos de identidade, custo, alergia, aprovação e falhas. Browser confirma jornada e rótulos; voz e memória exigem AC-12/13 quando ativas. Nenhum B0 aberto no caminho liberado. |
| FP-17 | Configuração de execução/deploy e instruções; editor único de `package.json`, lockfile e `.env.example`. Hyago valida callbacks e ambiente. | Preparação reproduzível sem segredos; aprovação antes de publicar. Testar aplicação, OAuth/MCP e continuidade na URL pública e local separadamente, registrando revisão e rollback. Falha pública permanece bloqueio de AC-14 mesmo que local funcione. |
| FP-18 | Revisar `docs/entregaveis/01-proposta-de-negocio.md` contra o canônico. | Resumo de uma página revisado pelo time; benefícios comerciais como hipóteses e limites reais explícitos. |
| FP-19 | `docs/entregaveis/02-desenho-de-solucao.md`. | Diagrama e texto mostram fronteiras, autorização, origens, guardrails e checkout externo; reconciliar com a implementação integrada, distinguindo real/mock/planejado. |
| FP-21 | `docs/entregaveis/05-documento-tecnico.md`; insumos das três frentes. | Setup reproduzível, arquitetura, operações realmente verificadas, segurança, testes e limitações da revisão demonstrada. Não documentar schema/endpoint externo inventado. |
| FP-24 | Roteiro e índice de evidências do pitch em `docs/`; consolidar entregáveis 01–06 sem assumir autoria dos colegas. | Roteiro 5 min + 3 de perguntas, dois ensaios registrados, plano B local e apresentação honesta do que falhar. Confirmar porta-voz, regras e responsável pelo envio; comprovante de submissão humana. Depende de FP-16 e FP-18–22. |

Validade da proposta, mecanismo de identidade, retenção e pesos do ranking serão definidos na fatia correspondente, com justificativa e teste; este plano não inventa parâmetros aprovados. Nenhuma aprovação enviada pelo cliente substitui autorização de servidor. Sem identidade/autorização verificável ou suporte da operação, escrita remota permanece desabilitada.

## Coordenação e tamanho dos PRs

- Kenzo edita contratos, ranking, domínio e orquestrador. UI pertence a Malveste; MCP/OAuth/memória a Hyago; LLM/voz a Terossi. Antes de editar arquivo de outro dono, combinar arquivo, motivo e janela.
- Em FP-01, fixar o mapa das rotas backend e o editor de lockfile. Mudanças necessárias em `src/mcp/types.ts` são propostas a Hyago; não editar sua frente simultaneamente.
- Um card por PR, máximo um card em desenvolvimento por pessoa. Se uma FP ultrapassar uma fatia revisável de cerca de duas horas ou 300 linhas, dividir em PRs/cards vinculados à mesma FP. Por exemplo: tipos/custos; estados/proposta; bloqueios de rotas; filtros; ranking; integração.
- Branch por fatia a partir da base confirmada, sem commit direto na `main`. O contrato entra antes dos consumidores; PR dependente informa sua base. PR de Kenzo exige revisão independente da revisão exata antes do merge.
- Revisão de segurança foca identidade/autorização e dados sensíveis; revisão de contratos foca fornecedores/consumidores. Especialistas temporários só quando houver benefício concreto e escopo independente.

## Validação, evidência e contingência

Antes de cada PR, executar os scripts vigentes `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`, além dos cenários afetados. Registrar falhas e não executados; baseline anterior não prova a nova revisão. Para este plano documental, conferir links, cobertura das 12 FP e `git diff --check`; não é validação do produto.

Atualizar `contexto/estado-atual.md` a cada PR. Decisões novas entram por acréscimo em `contexto/decisoes.md`; não editar `contexto/regras-de-negocio.md`. Registrar marcos materiais e próximo passo no Obsidian, sem duplicar logs ou dados privados.

| Bloqueio | Ação de Kenzo |
|---|---|
| MCP real indisponível | Avançar testes/contratos com fixtures rotuladas; pedir evidência mínima a Hyago. Não encerrar AC-03 nem declarar P0 real. |
| Consumidor ainda não integrado | Entregar exemplo validado pelo contrato e teste; registrar dependência e manter revisão do consumidor pendente. |
| Escrita anterior à aprovação ou isolamento falha | Bloquear caminho afetado, corrigir e adicionar teste negativo antes de habilitar integração. |
| Handoff ou escrita remota sem suporte confirmado | Usar resumo manual; não inventar URL nem tool. Escrita opcional não bloqueia desenvolvimento da proposta local. |
| Voz ou persistência sem gate | Manter texto e sessão efêmera identificados; funcionalidade habilitada precisa cumprir os próprios requisitos de segurança. |
| Tempo insuficiente | Cortar ampliação P1/P2 e automatizações opcionais; preservar guardrails, caminho textual e documentação honesta. |

Prazo de referência do evento: 18/10/2026 às 12h30, America/Sao_Paulo. Às 10h, congelar novas funcionalidades conforme plano da equipe; até a entrega, focar correções, QA, evidências e ensaio. Se o início real ocorrer após uma janela, reordenar pelo gate de segurança e dependências, sem prometer cumprir escopo não validado.

## Primeiro passo após este plano

Concluir FP-01: consultar PRs/cards atuais, combinar arquivos e revisão independente, executar baseline e registrar bloqueios. Em seguida, abrir a primeira fatia FP-02 de contratos com exemplos executáveis para os colegas. Este documento não publica PR, altera Trello, executa deploy ou conclui implementação.
