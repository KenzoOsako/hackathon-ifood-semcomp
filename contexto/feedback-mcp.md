# Feedback sobre o MCP do iFood (entregável 06)

Anotar NA HORA em que acontece, só acrescentar no fim. Todo mundo contribui.

Formato: **F-NNN — título** · quem · o que esperávamos · o que aconteceu · impacto · sugestão.

**F-001 — Cadastro no MCP Portal falha ao enviar SMS** · Felipe · esperava receber o código e criar a conta · erro "Falha ao enviar o código, tente novamente mais tarde" · bloqueia todo o onboarding · sugestão: fila/retry ou login por e-mail como alternativa.

**F-002 — tools/list mostra só 8 ferramentas, filtradas pelos escopos** · Hyago · esperávamos ver as 24 ferramentas documentadas · com escopos de endereço e descoberta (leitura) o gateway expôs 8: listAddresses, searchOffers, browseOffers, getRecommendations, getMerchant, getItem e também listVouchers e setVoucher, que são de carrinho, sem escopo de carrinho concedido · bom para limitar o agente, mas a doc não diz que a lista depende do escopo e as duas tools de voucher aparecem sem motivo claro · sugestão: documentar o filtro por escopo e revisar a exposição das tools de voucher.

**F-003 — Usuário de teste novo não tem endereço** · Hyago · esperávamos poder buscar ofertas logo após o login · listAddresses retornou 0 endereços para o usuário de teste recém-criado; toda busca exige userLocation · obriga a criar endereço (escopo de escrita) ou usar coordenadas fixas para testar · sugestão: usuário de teste com um endereço padrão de sandbox, ou deixar isso explícito na doc.

**F-004 — invalid_client com credencial antiga, sem pista do motivo** · Hyago · esperávamos erro indicando credencial revogada ou regenerada · /authorize respondeu JSON "The requested OAuth 2.0 Client does not exist" com o Client ID copiado de um .env antigo; após atualizar o secret no .env, o mesmo Client ID passou a funcionar · difícil diagnosticar (o secret nem é usado no /authorize) · sugestão: mensagem distinguindo cliente inexistente, cliente desativado e ambiente errado.
