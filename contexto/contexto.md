# Contexto atual — FoodPilot / iFood SEMCOMP 29

Atualização: 17/10/2026. Base auditada: main 0867abc; PR #4 introduziu o esqueleto em 6c1b414.
Fonte de produto: [proposta final](../docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md), fornecida pelo usuário com decisões 1–39 aprovadas. Estado técnico separado em [auditoria](../docs/AUDITORIA-ALINHAMENTO-2026-10-17.md).

## Produto e recorte
Consumidor iFood amplo; problema de indecisão, fricção e personalização ainda a validar. MVP de restaurantes/refeições. Site Next.js, voz primária e texto disponível; P0 pode usar voz OU texto, mas exige contexto MCP real relevante e autorizado. Mercado e integração nativa ficam no futuro.
Recomendar até três opções elegíveis e explicadas; preparar proposta local de carrinho. Aprovação explícita vinculada à versão antes de adicionar itens remotamente. Compra final no iFood. Transferência validada → link confirmado → resumo manual; nunca inventar suporte ou URL.
Login opcional para começar; nenhum dado privado sem autorização apropriada. Memória consentida, Supabase/PostgreSQL como direção, ElevenLabs prioritário via adaptador e fallback Web Speech API/texto. Modelo LLM ainda não escolhido. Cinco modos compartilham filtros rígidos antes do ranking.
Sem comprovação de impacto, receita, parceria, deploy público ou integração autenticada.

## Implementação e trabalho restante
Texto, parser por palavras-chave, recomendações determinísticas, carrinho/pedido/status simulados e memória em RAM. MCP_MODE=real lança erro. Checkout interno do mock e criação de carrinho antes de aprovação são divergências: adaptar contratos e guardrails antes de ligar qualquer escrita real.
Stack escolhida: Next.js 16 + TypeScript + React. O bloqueio SMS e a stack indefinida pertencem ao histórico; não representam estado atual. Cadastro/homologação/OAuth precisam de nova evidência no ambiente atual.
A auditoria precede a distribuição de tarefas. Equipe: Kenzo, Terossi, Malveste e Hyago. Kenzo continua integrador pelo fluxo vigente; novas frentes e competências individuais não estão atribuídas.

## Evento e governança
Tema informado: Vendendo com Agentes. Prazo informado: domingo 18/10/2026 às 12h30; pitch 13h–16h, 5 min + 3 de perguntas. Avaliação: visão/originalidade, arquitetura/engenharia/MCP, experiência/design, impacto, comunicação.
Seis entregáveis: proposta de negócio, desenho da solução, racional UX, interface visual, documento técnico e feedback real dos MCPs. Confirmar exigências da organização quando houver dúvida, inclusive aderência do checkout externo ao julgamento.
[Trello principal](https://trello.com/b/ZcLDfKqU/hackathon-ifood): A Desenvolver → Desenvolvendo → Em Revisão → Pronto. Um card por PR; revisão e merge pelo integrador. Proteção técnica da main não foi comprovada; não confundir política com configuração GitHub.
regras-de-negocio.md só humanos editam; decisões/erros/feedback preservam histórico. Esse arquivo humano ainda contém lacunas: regularização pendente, sem inventar RN.
Guia MCP descreve capacidades documentadas, não tools/list autenticado nem autorização para compras. Não criar pedidos para semear histórico sem ambiente e autorização verificados.
[Contexto anterior preservado](../docs/historico/contexto-pre-proposta-final.md): cronograma detalhado, informações do evento, orientações e hipóteses antigas; trechos superados não orientam implementação atual.
