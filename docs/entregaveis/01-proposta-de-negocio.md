# Entregável 01 — FoodPilot: proposta de negócio

Resumo da [proposta final aprovada](../PROPOSTA_DE_NEGOCIO_FOODPILOT.md). Implementação e evidências: [auditoria](../AUDITORIA-ALINHAMENTO-2026-10-17.md).

**Problema e público.** Consumidores iFood enfrentam indecisão, esforço de comparação e personalização insuficiente. Frequência, intensidade e dimensão são hipóteses a validar; nenhum impacto comprovado nesta entrega.

**Solução.** Copiloto conversacional em site Next.js, voz primária e texto disponível, transforma intenção em até três opções elegíveis e explicadas, aprende sob consentimento e prepara proposta revisável de carrinho. Restaurantes/refeições no MVP; Market e integração nativa no futuro.

**Diferencial proposto.** Filtros rígidos antes do ranking contextual; cinco modos em motor comum; justificativas demonstráveis; personalização autorizada e controle humano. Dados ausentes e incertezas devem ser explícitos.

**Jornada.** Visitante informa o necessário progressivamente e autoriza recursos protegidos quando precisar. Refina opções, revisa itens/endereço/custos e aprova antes de adição remota. Compra final no iFood: transferência validada → link confirmado → resumo manual. Mudanças materiais exigem nova revisão.

**Viabilidade.** MCP real relevante é condição do P0 por voz OU texto. Contratos, OAuth e handoff precisam ser comprovados por operação/ambiente. ElevenLabs por adaptador, Web Speech API/texto como fallback; modelo LLM não escolhido; Supabase/PostgreSQL para memória com privacidade. Direções aprovadas não equivalem a implementação.

**Negócio e validação.** Gratuito ao usuário. Conversão, retenção, satisfação e recompra são benefícios indiretos hipotéticos, sem comissão, assinatura ou venda de dados aprovadas. Comparar com navegação tradicional: tempo, interações, relevância, satisfação e confiabilidade. Registrar somente resultados reais.

**Estado e equipe.** Esqueleto textual com MCP/pedidos/status simulados; P0 real, voz, LLM, persistência e deploy pendentes. Kenzo, Terossi, Malveste e Hyago alinharão responsáveis após auditoria (D39). Nenhuma parceria/aprovação iFood alegada.
