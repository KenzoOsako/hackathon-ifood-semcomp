# Briefing — Agente do Guide (V2, enxuto)

> Frente **System Prompt e Fluxo de Agentes** (Hyago) — `src/agent/**`, `src/prompts/**`, `src/evals/**`.
> Base: [Direção V2](DIRECAO_V2_OCASIAO.md) (D-011), [Plano V2](PLANO_V2_PAPEIS_E_CRONOGRAMA.md) (D-012), [Revisão PR #7](REVISAO_PR7_E_BACKLOG_V2.md), [frentes](frentes.md). **D-011/D-012 ainda aguardam aceite do Kenzo**; se não forem aceitas, este briefing volta ao recorte de refeição única.
> **[DECIDIR]** = decisão humana pendente.

## 1. Objetivo

Transformar uma fala como *"Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme"* em um **plano de ocasião**: uma ou mais **necessidades** (pizza → restaurante, pipoca → mercado, presente → shopping), cada uma com até 3 opções explicadas, e levar até a **aprovação do plano** e a continuidade no iFood.

O agente **pensa e conversa**. Ele não busca no MCP direto, não ranqueia, não aprova e não compra: tudo isso é **função de domínio do Kenzo**. O LLM nunca recebe ferramenta transacional (AGENTS.md).

## 2. Decisão de arquitetura: orquestrador guiado por código

**Recomendação:** em vez de um loop livre em que o LLM escolhe ferramentas, o orquestrador é **código** que, a cada turno, pede ao LLM **uma saída estruturada** e decide o próximo passo. Motivos: a V2 exige teto de 3 perguntas, níveis L0/L1/L2 e eventos em pontos fixos; isso é mais fácil de garantir e testar (evals) em código. O LLM é usado em dois pontos: **interpretar** o turno e **verbalizar** o plano.

```text
 voz (Felipe) ou texto (UI)
        │  POST /api/converse { texto, origem, sinais }  + cookie de sessão
        ▼
 ┌─────────────────────────── TURNO DO ORQUESTRADOR ───────────────────────────┐
 │ 1. LLM interpretar → TurnoInterpretado (JSON validado; inválido → L1)       │
 │      { intencao, nivel, ocasiaoDelta, necessidadesDelta, pergunta? }        │
 │ 2. código atualiza AgentSession (ocasião, necessidades, nível, perguntas)    │
 │ 3. decide a próxima ação:                                                   │
 │      falta info que muda o ranking E perguntas < 3 E nível ≠ L0 → PERGUNTAR │
 │      senão → assume padrões (e diz quais) → MONTAR/AJUSTAR PLANO            │
 │      intenção aprovar → devolve evento de aprovação (backend valida)        │
 │      fora de escopo → recusa educada                                        │
 │ 4. domínio (Kenzo): buscarNecessidade → rankear → montarPlano/ajustarPlano  │
 │ 5. verbalizar plano por template (só reasons[] do ranking) → reply + speech │
 │ 6. registrarEvento (opcoes_exibidas, reacao, friccao, ...)                  │
 └─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
 { reply, speech, evento_de_tela, plano? }  ──► UI (Malveste) + fala (Felipe)
```

**"Loop em busca do objetivo"** = esse turno repetido até o objetivo da sessão: **plano com todas as necessidades cobertas e aprovado**. Cada turno avança um passo (perguntar, montar, ajustar, aprovar).

## 3. Estado da sessão (servidor, RAM, cookie de `visitor-session.ts`)

```ts
type AgentSession = {
  history: { role: "user" | "agent"; text: string; origem: "voz" | "texto" }[]; // janela curta
  nivel: "L0" | "L1" | "L2";
  perguntasFeitas: number;                 // teto 3 por sessão
  pendingQuestion?: string;                // o que foi perguntado e se espera
  ocasiao?: { tipo?: string; pessoas?: number; quando?: string; local?: string };
  necessidades: {
    id: string;
    vertical: "RESTAURANT" | "GROCERIES" | "SHOPPING";
    categoria: string;
    restricoes: string[];                  // rígidas: só o usuário relaxa, explicitamente
    orcamento?: { max: number; tipo: "teto" | "flexivel" };
    assumido: string[];                    // padrões assumidos e ditos ao usuário
  }[];
  plano?: { planoId: string; versao: number }; // dono: domínio do Kenzo
};
```

O histórico guarda o resto do contexto. Ocasião e necessidades ficam estruturadas porque viram entrada do domínio e dos eventos.

## 4. Saídas do LLM (contratos do Hyago, validados com Zod)

| Chamada | Entrada | Saída |
|---|---|---|
| `interpretar` | texto + sinais + estado resumido | `{ intencao: "nova" \| "responder" \| "ajustar" \| "aprovar" \| "fora_escopo", nivel, ocasiaoDelta, necessidadesDelta, pergunta?, sinaisPressa[] }` |
| `verbalizar` | snapshot do plano (opções + `reasons[]`) | `{ reply, speech }` — `speech` curto, até 2–3 opções faladas. **Template no hackathon**; LLM só se sobrar tempo |

LLM via **LangChain.js** (`@langchain/core` + pacote do provedor, `withStructuredOutput`), isolado em `src/agent/llm/` atrás do `LlmPort`; modelo trocável por configuração. Grafo do turno em código próprio, sem LangGraph (D-013).

`interpretar` devolve o **estado completo** de ocasião/necessidades a cada turno (não delta); o código valida e substitui.

Regras de prompt (de `src/prompts/README.md`): pt-BR, curto; só pergunta se mudar o ranking; toda pergunta com "pode escolher por mim"; "resume e segue"; nunca inventa preço, nota, prazo ou motivo.

## 5. Funções de domínio que o agente chama (dono: Kenzo)

| Função | Agente chama? | Observação |
|---|---|---|
| `obterContexto` | Sim | Endereço/contexto autorizado |
| `buscarNecessidade` | Sim | Uma por necessidade; MCP real ou mock por trás |
| `rankear` | Sim | Filtros rígidos antes; devolve `reasons[]` |
| `montarPlano` / `ajustarPlano` | Sim | Nova versão a cada mudança material |
| `registrarEvento` | Sim | Eventos sem PII (`src/data`) |
| `aprovarPlano(versao)` | **Não** | UI (botão) ou voz ("confirmo o plano") envia `planoId` + `versao`; backend revalida |
| Carrinho remoto / `submitOrder` | **Nunca** | Compra final no iFood |

Enquanto as funções reais não existem (dependem de **K-5** e **K-3**), o agente usa um **domínio fake com as mesmas assinaturas**.

## 6. Interface `/api/converse` (H-1, com Felipe)

- Entrada: `{ texto, origem: "voz" | "texto", sinais?: { velocidadeFala, interrompeu, silencioMs } }`. Identidade **só pelo cookie**; usar os guardas de `src/agent/http.ts` (Origin, JSON ≤ 16 KiB, erro sanitizado).
- Saída: `resposta_final { reply, speech, evento_de_tela, plano? }`.
- **[DECIDIR com Felipe]** O plano V2 pede resposta em fluxo (`resposta_parcial`). Sugestão: começar sem fluxo e adicionar depois do G3 se a latência pedir.

## 7. Profundidade adaptativa (regra da V2)

| Nível | Quando | Perguntas |
|---|---|---|
| L0 | Pedido específico, "pede logo", "você escolhe", pressa | 0 — plano no 1º turno |
| L1 | Intenção clara com uma lacuna relevante | 1 |
| L2 | Vago ou ocasião complexa | até 3, uma por vez |

Sinais de pressa (do LLM e de `sinais` da voz) **rebaixam** o nível. Saída inválida → L1.

## 8. Mantido mesmo no enxuto

1. LLM sem ferramenta transacional; aprovação e escrita só no domínio.
2. Motivos só de `reasons[]` reais.
3. Restrição rígida nunca relaxada sem pedido explícito.
4. Falha do LLM → resposta textual limitada, sem inventar plano.
5. Rotular real × simulado em toda resposta.

## 9. Adiado no hackathon (registrar se o time aceitar)

Supabase/memória persistente (Kenzo decide em `src/data`), cinco modos, multi-instância, benchmark extenso (fica um comparativo curto), resposta em fluxo até o G3.

## 10. Dependências

| Preciso de | Quem | Card |
|---|---|---|
| Funções de domínio extraídas de `agent.ts` | Kenzo | K-5 |
| Contrato Ocasião/Necessidade/Plano | Kenzo | K-3 (G2, 21h30) |
| Aprovação alcançável no mock | Kenzo | K-1 |
| Botão de aprovação na UI | Malveste | M-1 |
| Sinais de voz e consumo do `/api/converse` | Felipe | TER-02/06 |
| Chave e cota de LLM | Time | [DECIDIR] |
