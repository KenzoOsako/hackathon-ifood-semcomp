# K-3 — contrato e aprovação local do plano composto

Base: main 18d0aec. Esta fatia adiciona contrato e domínio, sem mudar rotas, agente, voz, UI ou OAuth. Não fecha a jornada V2 sozinha.

## Contratos

`src/contracts/occasion-plan.ts`, exportado por `@/contracts`:

- `Occasion` preserva os campos tipo/pessoas/quando/local do agente; `Need` preserva id/vertical/categoria/restricoes/orcamento. Orçamento de Need segue BRL decimal por compatibilidade; cálculos usam centavos seguros de `Cost`. O contrato do agente ainda não foi substituído.
- `CompositePlan` contém id/versão/estado, ocasião, sujeito interno, blocos e pendências. Cada bloco contém uma necessidade, um snapshot `CartProposal` e uma `Origin`. IDs de necessidade/proposta são únicos e há até cinco blocos. Campos não atendidos da ocasião devem virar pendências do plano pelo chamador; não omiti-los para obter aprovação.
- Um estabelecimento por bloco, sem estabelecimentos repetidos. Necessidades da mesma loja precisam ser consolidadas antes da composição para não duplicar frete/taxas. Todos os blocos pertencem ao mesmo sujeito e, quando conhecidos, ao mesmo endereço.
- `PublicCompositePlan` usa allowlist, sem sujeito/endereço internos nem merchantRef. Mantém custos, itens, origem por bloco e pendências. Não existe selo global de real que esconda um bloco mock; a UI deve rotular cada origem. A projeção pública é dado de apresentação, nunca autorização.
- `composePlanCost` deriva o total dos blocos, preserva ausências/estimativas e rejeita overflow. Nenhuma taxa/frete ausente vira zero. `PlanApprovalRequest` só contém planId/version/interactionId/channel; rejeita identidade e flags extras.

## Ciclo no servidor

`src/domain/occasion-plan-store.ts` implementa `OccasionPlanStore(capacity, now?)`. Capacidade explícita e relógio injetável seguem as práticas do store de propostas existente.

1. `create(subjectRef, { occasion, blocks, unresolved })` aceita snapshots draft/awaiting_approval de fontes confiáveis e cria cópias próprias em draft, com ID gerado no servidor. A validade do plano é a menor validade dos blocos.
2. `review(id, subjectRef, version)` move todos os blocos para awaiting_approval.
3. `approve(subjectRef, request)` valida a versão inteira antes de uma única troca síncrona do snapshot. Se qualquer bloco falhar, nenhum fica aprovado e a interação não é consumida.
4. `revise(...)` substitui todos os blocos, incrementa a versão do plano e remove aprovação. Não reutilizar como entrada os snapshots approved devolvidos ao consumidor; reconstruir a revisão a partir dos dados atuais do servidor.
5. `cancel(...)` é terminal. Repetição/aprovação sem revisão e versões antigas são negadas. Ao atingir capacidade, registros vencidos/cancelados liberam espaço; IDs antigos não são reutilizados.

Aprovação exige endereço nos blocos, custos conhecidos, ausência de pendências e respeito ao teto rígido. Estimativas conhecidas continuam explicitamente estimated, como no contrato de proposta anterior. **Restrições declaradas bloqueiam a aprovação nesta primeira fatia:** CartProposal ainda não carrega prova de composição/eligibilidade. Não converter texto de alergia em garantia; a etapa de integração deve transportar evidência verificada antes de permitir esse caso.

Snapshots pertencem ao plano após composição. Editar uma proposta em outro store não atualiza automaticamente este plano: toda mudança deve passar por revise; o adaptador deverá revalidar fontes/versões antes de aprovar. `origin` é uma declaração estruturada, não prova de autenticidade. Nunca aceitar blocos, preços ou sujeito enviados pelo browser/LLM como fonte confiável.

## Integração seguinte

O `PlanoSnapshot` de `src/agent/types.ts` ainda não contém taxas, endereço e validade suficientes para gerar aprovação segura. Hyago e Kenzo devem mapear os campos pelo domínio, mantendo `montarPlano`/`ajustarPlano`; não atribuir dados inventados aos campos ausentes. A aprovação segue fora das ferramentas do LLM.

Depois, criar a borda HTTP com sessão validada, ligação da intenção explícita e retorno do DTO/resumo; Felipe propaga o evento e Malveste exibe a versão exata. Os nomes planId/version do domínio precisam de mapeamento explícito para planoId/versao usados hoje na conversa.

Nenhuma operação remota é chamada pelo store; uma aprovação local não é autorização para escrita MCP. Coordenação só na instância do processo: armazenamento transacional/identidade/atualidade dos dados são gates antes de escrita real. TTL não comprova que preços externos continuam atuais. A compra final é no iFood.

## Evidências

Testes em `src/domain/occasion-plan-store.test.ts` cobrem os contratos públicos/internos, custos agregados, atomicidade, isolamento, revisão, replay, expiração mínima, capacidade e cópias defensivas. Revisão independente de arquitetura e segurança realizada; não equivale a aceite dos consumidores. Card: https://trello.com/c/txTvVAKy.
