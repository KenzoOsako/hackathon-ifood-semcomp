# Contrato para os cartões de sugestão e a saudação (agente → interface)

Tudo **aditivo**: nada do que a interface já lê mudou de nome ou de tipo.

## Cartão de sugestão (`tela.plano.blocos[]`)
Cada bloco é uma necessidade (pizza, leite, presente…). A opção principal é `principal`; até 2 alternativas em `alternativas[]`.

| Campo | Para quê no cartão |
|---|---|
| `bloco.categoria` | título do bloco ("pizza calabresa") |
| `bloco.sugestao` (boolean) | `true`: o Guide sugeriu, a pessoa não pediu → selo "Sugestão" |
| `bloco.cobertura` | `"proxima"`: não achei o pedido exato, este é o mais parecido → selo "Mais parecido" |
| `opcao.loja`, `opcao.item` | nome do estabelecimento e do item |
| `opcao.rotulo` + `opcao.motivo` | **por que foi destacado** ("mais barata": "menor preço com entrega entre as opções (R$ 45,80)") |
| `opcao.descricao` | **descrição do estabelecimento em uma linha**: "nota 4,4 (230 avaliações) · a 1,2 km · entrega até 35 minutos · frete R$ 5,90 · pedido mínimo R$ 20,00 · em promoção (de R$ 45,00)". Só com dados reais; campo ausente some |
| `opcao.nota`, `avaliacoes`, `distanciaKm`, `prazo`, `freteCents`, `pedidoMinimoCents`, `precoCents`, `precoOriginalCents` | para montar o layout do seu jeito (estrela, chips, riscado da promoção) |
| `opcao.origem` | `"real"` ou `"simulado"` |

`tela.tipo`: `mostrar_plano` (primeira vez), `plano_atualizado` (trocou/ajustou), `aguardando_aprovacao` (pessoa disse "pode"). `plano.naoAtendidas[]` lista o que não foi encontrado (mostrar "ainda não tenho opção para X"). Todo texto do plano já vem **limpo** (sem marcação, link, emoji, endereço), pode ir direto para a tela.

Com cartão na tela, a fala pode ser curta; a fala atual continua sendo gerada (`resposta`) e a voz fala o que vier.

## Saudação com o nome
- `GET /api/perfil` → `{ "nome": "Felipe" }` ou `{}`. Só o primeiro nome.
- No hook de voz: `useGuideVoice()` devolve `greeting` ("Oi, Felipe! Eu sou o Guide. Em que posso te ajudar hoje?"), `nome` e `falarSaudacao()` (o navegador só toca áudio depois de um clique: chame no primeiro toque no orbe).
- Fonte do nome: `GUIDE_NOME_DEMO=Felipe` no `.env` (demo e modo simulado) ou, com login real, `IFOOD_SCOPES_EXTRA=mcp.user.basic.read` (o escopo precisa estar aprovado no portal; senão o login falha com `invalid_scope`: remova a variável).
- O Guide também chama a pessoa pelo nome **uma vez**, no encaminhamento do plano ("Pronto, Felipe, o plano está na sua tela…").
- Privacidade: só o primeiro nome, só em memória, nunca em log; vai para a ElevenLabs apenas na fala da saudação e do encaminhamento.
