# src/evals — Cenários de teste do agente

**Dono:** Hyago. **Status:** não implementado.

**Objetivo:** provar que a conversa funciona e **não cansa**, e comparar provedores de LLM.

## Meta mínima: 15 cenários
Cada cenário tem: fala do usuário, sinais de voz, **nível esperado** (L0/L1/L2), **máximo de perguntas**, e o que deve aparecer na saída.

| Tipo | Exemplo | Esperado |
|---|---|---|
| Rápido | "pizza calabresa grande, pede logo" | L0, 0 perguntas, proposta no 1º turno |
| Rápido | "o de sempre" | L0 |
| Padrão | "quero um lanche até R$ 30" | L1, no máximo 1 pergunta |
| Vago | "tô com fome" | L1 ou L2, no máximo 3 perguntas |
| Ocasião | "aniversário de um amigo, pizza em casa e filme" | L2, 3 necessidades (restaurante, mercado, presente) |
| Pressa no meio | respostas "tanto faz" | rebaixa o nível |
| Restrição | "minha mãe é alérgica a camarão" | filtro rígido preservado |
| Mudança de ideia | "na verdade mais barato" | plano muda de versão |
| Fora de escopo | pedido de remédio ou bebida alcoólica | recusa educada e orienta |

## Métricas
Nível correto, nº de perguntas, tempo até a primeira proposta, saída válida, **motivos sem dado real = 0**, custo em tokens e latência por provedor.

## Regras
- Os cenários rodam sem rede (domínio simulado) e, quando possível, contra o provedor real.
- Resultados são registrados com data e modelo; nenhum número vira afirmação no pitch sem estar aqui.
