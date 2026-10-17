# Contratos internos — FP-02

Importar por `@/contracts`. Os schemas de `proposal.ts` são aditivos: consumidores legados continuam funcionando. Eles não representam schemas oficiais do MCP e ainda não estão ligados às rotas.

- `Money`: BRL em centavos inteiros seguros. Valores decimais legados exigem conversão explícita na borda, ainda pendente.
- `Cost`: itens, frete e taxas separados; total exige componentes conhecidos e soma consistente. `unknown` não traz total. Zero precisa ser explícito. `estimated` não significa preço confirmado.
- `Constraints`: orçamento rígido/flexível e alergias; composição ausente nunca autoriza alegação de segurança. Aplicação dos filtros é FP-05.
- `CartProposal`: snapshot interno de servidor, com versão, sujeito, estabelecimento, itens, custos, endereço e validade. Não enviar `subjectRef` ao browser/LLM. Estado `approved` rejeita pendências, endereço ausente e total desconhecido.
- `ApprovalRequest`: referência da proposta, versão, interação e canal. Rejeita campos extras, inclusive identidade e `explicit`. O servidor ainda precisa autenticar, conferir propriedade, expiração, estado, versão e replay (FP-06).
- `PortFailure`: erro normalizado sem payload privado. Resultado ambíguo impede repetição automática até reconciliação.

Exemplos válidos, inválidos e erro estão em `proposal.test.ts`. São fixtures locais, sem dados pessoais ou credenciais. Expiração é validada apenas como formato; o relógio e as transições de estado pertencem ao domínio, não ao schema.

`recommendation.ts` acrescenta intenção sem autoridade transacional, contexto autorizado interno com propósitos locais, origens real/mock, razões vinculadas a evidência e resposta pública com até três recomendações. Evidência referenciada valida estrutura, não prova a veracidade do texto: FP-05 deve gerar razões deterministicamente a partir dos campos reais. Datas validam formato, não atualidade. `AuthorizedContext` deve ser construído pelo servidor após autorização; nunca confiar no cliente para criá-lo.

`toPublicProposal` projeta um snapshot validado por allowlist, removendo sujeito, estabelecimento e endereço internos. A UI precisará obter nomes de apresentação autorizados pelo contrato de integração; os IDs de itens e proposta são referências opacas. Não há garantia automática de sanitização de texto livre: fornecedor deve minimizar conteúdo antes de construir resposta pública.

`proposal-state.ts` define transições permitidas: rascunho passa por revisão; aprovação alterada é invalidada antes de novo rascunho; cancelamento/expiração são terminais. A função não executa transição nem concede autorização; versão, relógio, identidade, replay e condições de escrita pertencem à FP-06.

Revisão dos consumidores Hyago/Terossi/Malveste segue pendente; FP-02 não está concluída. As rotas mock já usam proposta local e aprovação vinculada à sessão/versão; não chamam criação de carrinho nem envio de pedido. Integração real continua bloqueada. Exemplos adicionais em `recommendation.test.ts` e `proposal-state.test.ts`; detalhes de migração em `docs/INTEGRACAO_PROPOSTA_LOCAL.md`.
