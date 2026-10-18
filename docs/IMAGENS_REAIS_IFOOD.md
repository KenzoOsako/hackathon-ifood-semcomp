# Imagens reais do catálogo — implementação e validação

Responsável: Kenzo (transferência explícita de Hyago em 18/10/2026).
Base: origin/main 7918d15, após PR #29. Branch: feat/kenzo-imagens-reais-ifood.
Escopo autorizado: plano local PLANO_IMAGENS_REAIS_KENZO.md fornecido pelo usuário.

## Revisão inicial do plano

| Critério | Resultado |
|---|---|
| Arquitetura | Confirmada: texto e voz usam Guide; PR #29 já integrado |
| Dados MCP | extrasDoCartao em domain-mcp transforma itemImageUrl/merchantLogoUrl; guardas preservam URLs oficiais |
| Contratos | OpcaoPlano já tem imagemUrl/logoUrl; nenhum contrato compartilhado alterado |
| Interface | Adaptador descartava URLs; ResultCard só lia mockMediaFor |
| Segurança | HTTPS, host exato e /image/upload/**; Next sem redirects; guarda do backend preservado |
| Testabilidade | Testes de política, adaptador, renderização e smoke de navegação; teste autenticado bloqueado |
| Dependências | Configuração OAuth local ausente, comprovada por resposta 503 de /api/auth/login |
| Novas tarefas | Nenhuma ampliação |
| Conclusão | Plano adequado; sacola reutiliza mídia do snapshot de mesma versão por IDs, sem ampliar seu contrato |

## Implementação

MCP → OpcaoPlano → paraOption.media → ResultCard/CatalogImage. Revisão e sacola usam a mesma mídia do plano; sacola exige planoId/versão e associação lojaId/ref. Logo utiliza primeiro recurso disponível da mesma loja. Não busca mídia por nome nem faz novas chamadas MCP.

Origem real sem imagem recebe ícone neutro, nunca foto mock. Origem simulada preserva os assets de demonstração existentes e seus rótulos. CatalogImage usa next/image com dimensões reservadas, carregamento lazy e fallback em onError; a chave por URL permite recuperação após refinamento.

next.config.ts libera somente HTTPS static.ifood-static.com.br/image/upload/** e maximumRedirects=0. O frontend revalida URLs sem importar dependências de prompts/voz. Nenhum OAuth, autorização, ranking, aprovação ou operação remota alterado.

## Evidências e limites

- Typecheck e build aprovados. Lint sem erros, com 10 avisos preexistentes em orchestrator/index.ts e qualidade/caos.ts.
- 555 testes aprovados, 10 ignorados; 16 novos testes de mídia/adaptador/renderização.
- Revisão independente encontrou perda de imagens simuladas e escolha incompleta do logo; ambos corrigidos e reavaliados sem novo defeito confirmado.
- Navegador em build de produção: texto → plano → revisão → sacola simulada funcional com fallback neutro. Isto não comprova imagem real.
- Instância real localhost:8080: /api/converse pediu conexão; /api/auth/login respondeu 503, “Login iFood não configurado neste servidor”. Nenhum .env local foi encontrado neste checkout. Não foram lidas/expostas credenciais.
- Pendentes: OAuth configurado localmente; busca MCP autenticada; carga de foto/logo reais; refinamento real; inspeção responsiva com mídia; voz com microfone; falha HTTP de imagem no navegador. Renderização automatizada não prova disponibilidade do CDN.
- Evidência local do bloqueio: work/imagens-login-bloqueado.jpg (fora do Git).

## Continuidade

Configurar client ID, client secret e redirect local pelos mecanismos existentes, sem enviar segredos por chat/Git. Reabrir login e concluir teste autenticado de texto/voz, revisão e sacola antes do PR. Não ampliar allowlist para contornar falha. Sem merge ou deploy nesta etapa.

**NÃO APTO PARA ABRIR PR:** gates de MCP real, voz e evidência visual real ainda pendentes conforme §11–13 do plano.
