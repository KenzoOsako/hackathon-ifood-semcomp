# Plano de implementação — o Guide nas telas do Malveste

18/10/2026, ~01h30 (Hyago). **Fonte que guia as próximas ações:** storyboard "Jornada do Guide" (https://claude.ai/artifact/51bWppnPW1zuzYn2CS3rHj, privado; pedir acesso ao Hyago). As decisões dele estão copiadas abaixo para quem não tiver o link.

**Objetivo:** o agente V2 (`/api/converse`, voz do Felipe, MCP real) funcionando na tela de produto do Malveste (`/agente`), da abertura à sacola.
**Quem:** Hyago faz a conexão da tela (combinado com o time); o back do agente segue com o Hyago. `/voz` continua como laboratório do Felipe.

## Decisões de produto (do storyboard)
1. A demo usa **só o agente novo** na tela de produto. O fluxo antigo (`/api/chat`, lista de um item) fica no código, fora da demo.
2. **Aprovar o plano inteiro, por versão.** Tirar um item é falar ("sem pipoca").
3. **Mostrar "o que eu entendi"** (ocasião e itens, com sugestões) durante as perguntas.
4. **Preço por item e "total final no iFood".** A tela não soma nem recalcula; subtotal por loja vem do servidor.
5. **Trocar de alternativa tocando: depois.** Ajuste por voz ou texto cobre a demo; "Ver mais opções" só mostra.
6. **A jornada termina na sacola**, uma simulação do carrinho do iFood, rotulada, sem enviar pedido. O resumo copiável ("Continue no iFood") fica como reserva.

## Regras que não mudam
- A tela só desenha o que o servidor manda; não recalcula ranking, total nem regra de segurança.
- Rotular **real × simulado** por bloco; a sacola é sempre "Simulação".
- **Nenhum pedido é enviado.** A chave do MCP não tem escopo de carrinho (F-002) e a compra final é no iFood (AGENTS.md). "Finalizar pedido" não chama nada remoto.
- Aprovação só por botão ou frase explícita, vinculada à versão; versão antiga é recusada; "sim" sozinho não aprova.
- Motivos só de campos reais; fala sem dado pessoal.

## A jornada, momento a momento (resumo do storyboard)
| # | Momento | Pessoa | Tela |
|---|---|---|---|
| 1 | Abertura | — | Orbe, "Qual a sua vibe de hoje?", sugestões de ocasião, microfone ativo |
| 2 | Entendimento | "Aniversário de um amigo, pizza em casa e filme" | Cartão "O que eu entendi" (aniversário, hoje, em casa, pizza, + pipoca e + presente como sugestão), pergunta "Quantas pessoas?" e respostas rápidas |
| 3 | Plano | "Umas seis" | Plano agrupado por item (cartão de resultado do Malveste), selo "Sugestão", "Ver mais opções", avisos, "Revisar e aprovar" |
| 4 | Refino | "Sem presente, quero a pizza mais bem avaliada" | Só o bloco da pizza muda ("Atualizado"), aviso do que mudou, versão 2 |
| 5 | Revisão | "Aprovo o plano" ou botão | Uma seção por loja, subtotal e frete do servidor, avisos, "Aprovar versão 2" |
| 6 | Sacola | — | Sacola no formato do iFood, uma seção por loja, "Simulação", "Finalizar pedido no iFood" sem envio |

Estados especiais: pedido rápido (direto ao 3), voz em dúvida (Sim/Não), iFood não conectado (cartão "Conectar iFood"), nada encontrado (bloco "nenhuma loja aberta"), fora do escopo, erro com "Tentar de novo".

## Contrato da tela (o que o `/api/converse` passa a devolver)
O que já existe: `resposta` (fala), `fraseEspera`, `tela` com o plano (`PlanoSnapshot`: blocos por item com principal e até 2 alternativas, não encontrados, avisos, versão, origem), `estado`, `nivel`, `origem`. Entra:
- `entendido`: ocasião e itens (categoria, tipo de loja, `sugestao`) **em todo turno**, não só quando há plano. Alimenta o cartão "O que eu entendi".
- `respostasRapidas`: até 4 respostas curtas para a pergunta do turno, sempre com "Pode escolher"; "Sim"/"Não" quando é confirmação de voz. Validadas em código.
- `BlocoPlano.subtotalCents` (quantidade × preço da principal) e o frete, calculados no servidor.
- `tela.tipo = "sacola"` com a sacola montada do plano aprovado (lojas, itens, quantidades, subtotais, fretes, avisos, versão).
- Rota `POST /api/plano/aprovar` `{ planoId, versao, interactionId }`: confere visitante, plano atual e versão; devolve a sacola. A frase "aprovo o plano" leva ao mesmo resultado.

## Fatias
Back (agente) e front (tela) andam em paralelo; o contrato acima é o ponto de encontro.

| # | Fatia | Lado | Arquivos principais | Depende | Pronto quando |
|---|---|---|---|---|---|
| B1 | `entendido` e `respostasRapidas` em todo turno | Back | `src/agent/types.ts`, `orchestrator`, `prompts/interpretar.ts` | — | Teste: turno de pergunta traz ocasião, itens com sugestão e respostas rápidas com "Pode escolher"; confirmação traz Sim/Não |
| B2 | Subtotal e frete por bloco no plano | Back | `domain-fake`, `domain-mcp` | — | Teste: subtotal = quantidade × preço da principal, nos dois domínios |
| B3 | Aprovar o plano → sacola | Back | `src/app/api/plano/aprovar/route.ts`, `orchestrator` | B2 | Testes: versão atual devolve a sacola; versão antiga, sem plano ou outro visitante são recusados; "aprovo o plano" dá o mesmo resultado; nada remoto é chamado |
| B4 | Fala curta, sabendo que a tela mostra os detalhes | Back | `prompts/responder.ts` | — | Evals com Gemini sem regressão; fala do plano em até 2 frases |
| F1 | Tela ligada ao agente e à voz | Front | `src/ui/agent/agent-context.tsx` (passa a usar `useGuideVoice`), `agent-screen.tsx` | — | Na `/agente`, falar ou digitar chega ao `/api/converse`; orbe mostra ouvindo/pensando/falando; cartão "Conectar iFood" em modo real sem login; selo Simulado/Real pela origem |
| F2 | "O que eu entendi" e respostas rápidas | Front | `agent-view.tsx` | B1, F1 | A pergunta mostra o cartão e os botões; tocar num botão manda o mesmo texto da fala |
| F3 | Plano por item | Front | novo `plan-view.tsx`, `result-card.tsx` (adaptador do plano para o cartão) | F1 | Aniversário mostra pizza, pipoca e presente com selo de sugestão, avisos e "Ver mais opções"; ajuste destaca o bloco que mudou e avisa o que mudou |
| F4 | Revisão do plano por loja | Front | `proposal-view.tsx` (ou nova `plan-review.tsx`) | B2, F3 | Uma seção por loja com subtotal e frete do servidor; "Aprovar versão N" chama a rota |
| F5 | Sacola (simulação do iFood) | Front | nova `cart-view.tsx`; `continue-view.tsx` vira reserva | B3, F4 | Plano aprovado aparece na sacola, rotulada "Simulação"; "Finalizar pedido" não envia nada |
| F6 | Estados especiais | Front | `agent-view.tsx`, `plan-view.tsx` | F1–F5 | Pedido rápido, Sim/Não, login, nada encontrado, fora do escopo e erro aparecem como no storyboard |
| V1 | Ensaio de ponta a ponta | Todos | `scripts/medir-agente.mjs`, prévia `/agente/previa` | tudo | Na `/agente`, jornada do storyboard falada em mock e em real (login iFood + Gemini), 5 rodadas medidas; prévia com os cenários do plano |

## Ordem sugerida (até o congelamento das 9h)
1. **Agora:** B1, B2 e B3 no back, em paralelo com F1 na tela.
2. **Em seguida:** F2 e F3 (o coração da demo), depois B4.
3. **Depois:** F4 e F5 (aprovação e sacola).
4. **Por fim:** F6 e V1, a tempo do congelamento.

## Coordenação
- `src/ui/` é a pasta do Malveste: avisar que o Hyago vai mexer em `src/ui/agent/` para não haver edição ao mesmo tempo. Componentes base e home continuam com ele.
- `useGuideVoice` é do Felipe: a tela só consome; mudança no hook passa por ele.
- O fluxo antigo (`/api/chat`, `/api/confirm`) não é apagado; só sai da demo.

## Riscos
- **Cota do Gemini** nos ensaios: ritmo nas evals; faturamento ativo para a demo.
- **Login iFood só em memória:** reiniciar o servidor exige novo login antes da apresentação.
- **Lojas fechadas** de madrugada: conferir pipoca e presente de manhã; o bloco "nenhuma loja aberta" cobre o caso.
- **Variação do Gemini:** o "o que eu entendi" e as respostas rápidas são validados em código; sem eles a tela continua funcionando.
