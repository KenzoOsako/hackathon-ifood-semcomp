# Integração da proposta local — FP-06

Fatia FP-02/FP-06 de 17/10/2026, base e85cd2b; escopo de revisão: texto/mock. Não certifica OAuth, MCP real, deploy ou P0 completo.

## Para Malveste / interface

`POST /api/chat` recebe `{ "message": "pizza" }`. O `sessionId` legado é aceito por compatibilidade e ignorado para identidade. O browser envia/recebe cookie same-origin automaticamente; nunca gerar ou expor sujeito/token no JavaScript da UI. JSON, Origin same-origin e no máximo 4000 caracteres por mensagem; resposta sem cache.

Busca mantém `state: ESCOLHENDO_OPCAO` e `options` legados. Selecionar `1`, `2` ou `3` retorna `state: AGUARDANDO_CONFIRMACAO` com `proposal`, sem `cart` remoto. A UI atual exibe o resumo por texto; o cartão antigo condicionado a `cart` não aparece. Exibir custos desconhecidos como pendências, sem inventar zero. `cancelar` limpa a seleção; refazer a busca cria nova proposta e invalida a anterior. Com vários endereços, usar `endereço N`; zero endereços bloqueia busca. Todos os dados atuais são simulados.

O novo botão de aprovação deverá enviar para `POST /api/confirm`:

```json
{ "proposalId": "id-exibido", "version": 1, "interactionId": "uuid-da-interacao", "channel": "button" }
```

Enviar a versão exibida, não buscar silenciosamente uma versão mais recente. Não enviar `explicit`, `sessionId` ou `subjectRef`. Texto de aprovação, quando inequívoco, usa `aprovar <id> v<versão>`; voz deve usar os mesmos campos e esclarecer ambiguidade antes do envio. Um `sim` isolado não aprova.

A resposta bem-sucedida usa `state: PROPOSTA_APROVADA`, snapshot público e aviso de compra externa; não traz pedido. Hoje os candidatos do mock não informam taxas, então o chat não produz proposta pronta para aprovação. O teste positivo do endpoint usa uma fixture completa construída no servidor, não um total recebido do cliente. Até resolver as pendências, permitir revisão/cancelamento/resumo manual, sem habilitar aprovação com falsa certeza.

Erros: 400 dados inválidos/pendências, 403 sessão/origem inválida, 409 versão antiga/replay/concorrência, 410 expirada e 503 indisponível. Mostrar o `reply` sanitizado e permitir nova revisão. `GET /api/order` responde 410; não iniciar polling. Recarregar após reinício/expiração exige nova conversa. Tokens e IDs de sujeito nunca aparecem no DTO público de proposta.

Única alteração em `page.tsx` nesta fatia: efeito de rolagem com bloco sem retorno, autorizada pelo usuário após erro de cleanup do React no teste do navegador. Layout e controles pertencem à frente de Malveste. Contraste insuficiente dos balões no tema escuro foi observado na captura; ajuste visual permanece com essa frente.

## Para Hyago / integração

Não ligar MCP real às sessões anônimas: `MCP_MODE` diferente de mock falha fechado. O agente usa uma porta reduzida de leitura; nenhum caminho da aplicação chama `createCart`, `submitOrder` ou `trackOrder`. As funções antigas do adaptador mock permanecem isoladas para o dono do módulo revisar; não foram promovidas a integração real.

Precisamos de identidade/OAuth server-side e dados normalizados com encargos, composição, origem, autorização, atualização e ausências explícitas. Preço legado decimal é convertido para centavos seguros no limite da proposta. Não presumir frete/taxa grátis nem capacidades de handoff. A integração real deve revalidar dados antes da ação e preservar vínculo de versão, isolamento e idempotência entre instâncias. A compra final continua no iFood.

## Validação e limites

- Vitest cobre isolamento de cookies, body/origem, concorrência, dados privados ausentes na proposta, aprovação com pendências, caso positivo local completo e ausência de chamadas de escrita/tracking.
- Smoke HTTP reproduzível: após `npm run build`, iniciar `MCP_MODE=mock` e `npm run start -- --hostname 127.0.0.1 --port 3107`; executar `node scripts/smoke-proposal.mjs`. A variável opcional `FOODPILOT_BASE_URL` aceita apenas HTTP loopback.
- Navegador local confirmou busca → seleção → proposta pendente → cancelamento; screenshot em `work/evidence/fp06-proposta-local.png` fora do checkout. Não houve compra nem aprovação real.
- Proteções locais não certificam o deploy. Antes de publicar: rate limit de criação de sessões anônimas, ambiente/origem/callbacks, armazenamento entre instâncias e QA público. Ranking, alergias, proveniência e teto total continuam na FP-05; dados MCP reais e aceite dos consumidores continuam pendentes.
