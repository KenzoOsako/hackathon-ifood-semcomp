# Complementos por item — implementação

Data: 18/10/2026. Base origin/main d0a688c; branch feat/kenzo-complementos.

## Jornada
Escolher item → carregar detalhe → configurar complementos por unidade → salvar → revisar nova versão → aprovar sacola local. Nenhuma escrita remota ou pedido.

- MCP: getItem após seleção usa IDs reais e localização resolvida. Valida item/loja/preço e optionGroups; conserva mínimo/máximo, adicionais em centavos e disponibilidade. Falha, payload desconhecido ou customização aninhada bloqueiam a configuração, sem inventar opções.
- Fonte de contrato: https://mcp-developer.ifood.com.br/pt-BR/docs/guides/mcps/discovery/tools , exemplo oficial consultado em 18/10 via page-data público. Payload autenticado atual ainda não validado.
- Mock: hambúrguer tem Molho obrigatório (sem molho ou maionese) e Extras opcionais (guardanapo/queijo), rotulados Simulado. Isso não afirma oferta de restaurante real.
- Interface: grupos por item, quantidade, adicionais, indisponibilidade, obrigatórios e rascunho não salvo. Edição de outro item aguarda salvar o atual. Estado local reinicia por planoId/versão. Cartão, revisão e sacola apresentam preço configurado; servidor calcula sacola e inclui nomes das escolhas.
- API: configuracao é estruturada, limitada e validada em /api/converse, usando sessão/origem existentes. Preços não vêm do cliente. Salvar não chama o LLM; referências, necessidade, planoId e versão são conferidos. Seleção idêntica não incrementa versão; mudança incrementa e exige nova revisão. Ferramenta configurar_complementos dá acesso ao mesmo domínio por texto/voz.
- Aprovação: frase afirmativa inteira, versão explícita atual, plano não vazio e grupos completos. Negativas/condicionais não aprovam. Voz com confiança informada abaixo de 0,85 pede repetição/digitação, sem ações. Restrições acumuladas chegam à busca/montagem e invalidam o plano antigo. Referências de outra necessidade são recusadas. Versões permanecem crescentes após invalidação por restrição.
- Restrições + extras: sem composição dos adicionais, não se afirma segurança. Se o grupo for obrigatório, o item fica bloqueado com orientação para escolher outro; se todos forem opcionais, pode seguir sem adicionais.

## Evidência
- Navegador local :3002, MCP mock e Gemini configurado: plano de hambúrguer → maionese + guardanapo + queijo → salvar v2 → revisão → sacola simulada. Base R$24,90 + R$1,50 + R$3,00 = R$29,40; frete R$4,99; total R$34,39. Obrigatório vazio e rascunho bloqueiam revisão. Console sem erros no fim.
- Screenshot fora do Git: ../../outputs/complementos-sacola.png.
- Primeira chamada Gemini retornou 400 por exclusiveMinimum em schemas novos; corrigido usando min(1), repetição real passou e teste de compatibilidade adicionado.
- Testes cobrem cardinalidade, IDs inválidos/duplicados, indisponibilidade, preços desconhecidos, opcionais, adicionais pagos/grátis, duas unidades, versão antiga, troca de item, restrições e guardas de aprovação. Resultado final dos checks em contexto/estado-atual.md.
- Revisão independente funcional e segurança executadas; correções incorporadas. Segurança não confirmou vulnerabilidade nova. Limite: orçamento flexível não é uma garantia de teto; valor final e disponibilidade são conferidos no iFood.

## Limites e continuidade
Não foi validada uma resposta autenticada nova de getItem nesta entrega. Se o servidor real divergir do contrato oficial, a UI mostra indisponibilidade e impede aprovação até verificar. Customizações aninhadas exigem adaptação posterior com schema real, sem achatar IDs. Ainda sem carrinho/pedido remoto, merge ou deploy.

Próximo aceite: login no ambiente de teste real → buscar item com grupos → conferir detalhe/molho/guardanapo disponíveis → configurar → trocar item → revisar/sacola. Não criar pedido para testar.
