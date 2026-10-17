# src/prompts — System prompt e prompts por etapa

**Dono:** Hyago. **Status:** não implementado.

**Responsabilidade:** como o agente pensa e fala: tom, extração de contexto, perguntas, explicação das opções.

## Arquivos previstos
- `system.ts`: persona e regras gerais (português do Brasil, respostas curtas, tom natural).
- `extrair-ocasiao.ts`: transforma a fala em `Ocasião` e `Necessidades` (JSON validado pelo contrato).
- `profundidade.ts`: classifica o nível L0/L1/L2 e justifica com os sinais recebidos.
- `perguntar.ts`: gera **uma** pergunta de maior valor (só se a resposta mudar o ranking).
- `verbalizar-plano.ts`: fala o plano a partir de `reasons[]` do ranking, **sem inventar motivo**.

## Regras
1. Saída estruturada **sempre validada** com os esquemas de `src/contracts`; saída inválida cai para L1 e pede esclarecimento.
2. O modelo **só verbaliza** motivos que vieram do ranking; nunca acrescenta preço, nota, estoque, prazo ou favorito.
3. **Teto de 3 perguntas** por sessão; cada uma com "pode escolher por mim".
4. Resumir o entendimento em uma frase e seguir ("Entendi: pizza para 6, pipoca e presente até R$ 100. Monto?").
5. Prompts versionados; mudança relevante passa pelos cenários de `src/evals`.
6. Nenhuma instrução de prompt substitui as regras críticas, que são **código** do domínio.
7. Sem segredos nem dados pessoais reais em prompts de exemplo.
