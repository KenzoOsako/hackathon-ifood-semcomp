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

## Princípio: o agente é o maestro, a tela obedece
A pessoa fala ou toca; o agente decide o que fazer; a resposta dele já diz **qual tela mostrar** (`tela.tipo`) e com quais dados. A interface não tem regra própria de fluxo: só troca de tela conforme o tipo. As confirmações (o que entendeu, "é isso?", aprovação explícita por versão) já acontecem na conversa e foram testadas no back.

| O agente decidiu | `tela.tipo` | A tela mostra (momento do storyboard) |
|---|---|---|
| Ainda conversando ou perguntando | sem `tela` | Orbe e legenda (1 e 2) |
| Montou o plano | `mostrar_plano` | Plano por item (3) |
| Ajustou | `plano_atualizado` | Plano com o bloco "atualizado" (4) |
| A pessoa concordou ("pode", "fechou") | `aguardando_aprovacao` | Revisão por loja (5) |
| A pessoa aprovou ("aprovo o plano") | `sacola` (**novo**) | Sacola simulada (6) |

**Um canal só:** os botões não têm rota própria. "Revisar e aprovar", "Aprovar" e "Pode escolher" mandam ao agente a mesma frase que a pessoa diria (`sendText`). Falar e tocar dão o mesmo resultado; a aprovação continua valendo só para a frase explícita, sobre a versão que está na tela.

## Primeira versão: simples e palpável
Objetivo: a jornada do storyboard funcionando de ponta a ponta na `/agente`, parecida com o pedido, mesmo sem os enfeites. Depois ajustamos.

| # | Passo | Lado | Pronto quando |
|---|---|---|---|
| 1 | **Tela ligada ao agente.** `AgentProvider` passa a usar o `useGuideVoice` (fala, texto, estado do orbe, conversa, login) e escolhe a tela pelo `tela.tipo` | Front | Na `/agente`, falar ou digitar chega ao `/api/converse`; o orbe reage; em modo real sem login aparece "Conectar iFood" |
| 2 | **Plano por item.** Blocos com o cartão de resultado do Malveste (adaptador simples do plano para o cartão), selo "Sugestão", avisos, botão "Revisar e aprovar" que manda "pode" | Front | A jornada do aniversário mostra pizza, pipoca e presente; "sem presente" e "a pizza mais bem avaliada" atualizam o plano |
| 3 | **Sacola no back.** Aprovação explícita devolve `tela.tipo = "sacola"`, montada do plano aprovado com subtotal (quantidade × preço) e frete calculados no servidor | Back | 2 ou 3 testes: aprovação da versão atual gera a sacola; "sim" sozinho não gera; nada remoto é chamado |
| 4 | **Revisão e sacola na tela.** Revisão por loja com o botão "Aprovar versão N" (manda "aprovo o plano"); sacola no formato do iFood, rotulada "Simulação", "Finalizar pedido" sem envio | Front | Da revisão, aprovar leva à sacola com as lojas do plano |
| 5 | **Ensaio.** A jornada inteira na `/agente`, em mock e depois em real (login iFood + Gemini) | Todos | A jornada roda falada do começo à sacola; tempo de cada etapa anotado |

**Verificação:** para a tela, a prova é usar: abrir a `/agente` e fazer a jornada. Antes de cada commit, `typecheck`, `lint`, `test` e `build` (a `main` continua rodando). Testes novos só na aprovação (passo 3).

## Depois (ajustes)
- Cartão "O que eu entendi" e respostas rápidas: o agente passa a mandar ocasião, itens e sugestões de resposta em todo turno.
- Fala mais curta, sabendo que a tela mostra os detalhes.
- Destaque "atualizado" e aviso do que mudou; "Ver mais opções" por bloco.
- Estados especiais: pedido rápido, Sim/Não na voz em dúvida, nada encontrado, fora do escopo, erro.
- Trocar de alternativa tocando.

## Coordenação
- `src/ui/` é a pasta do Malveste: avisar que o Hyago vai mexer em `src/ui/agent/` para não haver edição ao mesmo tempo. Componentes base e home continuam com ele.
- `useGuideVoice` é do Felipe: a tela só consome; mudança no hook passa por ele.
- O fluxo antigo (`/api/chat`, `/api/confirm`) não é apagado; só sai da demo.

## Riscos
- **Cota do Gemini** nos ensaios: ritmo nas evals; faturamento ativo para a demo.
- **Login iFood só em memória:** reiniciar o servidor exige novo login antes da apresentação.
- **Lojas fechadas** de madrugada: conferir pipoca e presente de manhã; o bloco "nenhuma loja aberta" cobre o caso.
- **Variação do Gemini:** a tela depende só do `tela.tipo` e do plano, que são validados em código; a fala pode variar sem quebrar a tela.
