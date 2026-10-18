# Briefing — Agente Guide (implementação no backend)

> Frente **System Prompt e Fluxo de Agentes** (Hyago) — `src/agent/**`, `src/prompts/**`, `src/evals/**`.
> **Fonte do comportamento:** [AGENTE_CONVERSA_E_FLUXO.md](AGENTE_CONVERSA_E_FLUXO.md) (estados S0–S7, ferramentas 4.2, casos C1–C12, achados dos testes de voz). Este briefing diz **como implementar** isso no backend. Base de escopo: [Direção V2](DIRECAO_V2_OCASIAO.md) (D-011), [Plano V2](PLANO_V2_PAPEIS_E_CRONOGRAMA.md) (D-012), D-013 (LangChain).
> **[DECIDIR]** = decisão humana pendente.

## 1. Decisões fechadas (17/10, ~20h30, Hyago + Felipe)

1. **O cérebro fica no backend.** O orquestrador decide o que perguntar, quando buscar, montar ou ajustar. Quem busca no MCP e ranqueia é o domínio (Kenzo), chamado pelo agente. O LLM interpreta e redige a resposta; não decide o que é verdade nem aprova.
2. **ElevenLabs só ouve e fala** (STT e TTS): recebe a fala, entrega texto ao agente e lê a resposta. Não conduz a conversa nem guarda regra. **Este plano entrega o agente funcionando por texto**; a voz é conectada depois, no mesmo endpoint.
3. **O prompt do spike (`src/voice/agent-prompt.md`) vira a base dos nossos prompts**, dividido conforme a seção 5. Os "Dados de exemplo" saem do prompt e viram fixtures do domínio fake.
4. **LLM via LangChain.js** (D-013), isolado em `src/agent/llm/`. **Sem modelo fixo:** provedor e modelo vêm de variável de ambiente.

## 2. Arquitetura de um turno

```text
 cliente (agora texto/curl; depois a voz)
        │  POST /api/converse { texto, origem?, sinais?, hipoteses? }  + cookie de sessão
        ▼
 ┌──────────────────────────── ORQUESTRADOR (Hyago) ────────────────────────────┐
 │ 1. LLM interpretar → TurnoInterpretado (JSON validado; inválido → L1)        │
 │ 2. código atualiza AgentSession e aplica a máquina de estados S0–S7          │
 │    (teto de 3 perguntas, consentimento, anti-repetição, incerteza)           │
 │ 3. se S2 Perguntar: a pergunta já veio no passo 1 → responde (1 chamada LLM) │
 │ 4. se S3/S4: frase de espera imediata + domínio (Kenzo) em paralelo por      │
 │    necessidade: buscarNecessidade → montarPlano / ajustarPlano               │
 │ 5. LLM responder: fala no estilo do Guide, só com fatos do snapshot          │
 │ 6. registrarEvento                                                           │
 └──────────────────────────────────────────────────────────────────────────────┘
        │  { resposta, evento_de_tela, plano? }
        ▼
 tela (Malveste) · depois: voz lê a resposta
```

**Loop rumo ao objetivo** = esse turno repetido até o plano estar completo e encaminhado para aprovação (S5). A aprovação é do usuário (tela ou frase exigida), validada pelo domínio; **o agente não tem `aprovarPlano`**.

## 3. Estado da sessão (RAM, `Map<subjectRef, AgentSession>` em `src/agent/orchestrator/`)

```ts
type AgentSession = {
  estado: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7";
  nivel: "L0" | "L1" | "L2";               // só rebaixa, nunca sobe sem pedido
  perguntasFeitas: number;                 // teto 3; confirmar reconhecimento não conta
  ultimaFala?: string;                     // anti-repetição
  feedbackPerguntado: boolean;             // no máximo 1 vez
  encaminhado: boolean;                    // S5 dito uma vez
  history: { role: "user" | "agent"; text: string; origem: "voz" | "texto" }[];
  ocasiao?: { tipo?: string; pessoas?: number; quando?: string; local?: string };
  necessidades: { id: string; vertical: "RESTAURANT" | "GROCERIES" | "SHOPPING"; categoria: string;
                  restricoes: string[]; orcamento?: { max: number; tipo: "teto" | "flexivel" }; assumido: string[] }[];
  plano?: { planoId: string; versao: number };
};
```

Não altera `visitor-session.ts` nem `agent.ts` (Kenzo): usa o `subjectRef` que a sessão de visitante já gera.

## 4. Saídas do LLM (validadas com Zod)

| Chamada | Entrada | Saída | Quando |
|---|---|---|---|
| `interpretar` | texto + sinais + hipóteses + estado resumido + opções faladas | `{ intencao: "pedido" \| "responder" \| "consentir" \| "ajustar" \| "aprovar_frase" \| "fora_escopo" \| "incerto", nivel, ocasiao, necessidades, pergunta?, confirmacao? }` — **estado completo**, não delta | Todo turno |
| `responder` | snapshot do plano (opções + `reasons[]`) + o que mudou | `{ fala }` curta, no estilo do Guide | Só em S3/S4 |

- **`consentir` ≠ `aprovar_frase`** (os "três sins" do doc de fluxo): consentir leva a S5; a frase de aprovação vira evento para o domínio validar com `planoId` + `versao`.
- **Incerteza de reconhecimento:** usar `hipoteses` e as opções recém-faladas para confirmar sim/não ("Foi a calabresa?") em vez de pergunta aberta (casos C3/C11).
- **Quem escreve a frase da resposta:** o domínio devolve dados (loja, item, preço, rótulo "mais barata"); o LLM (`responder`) transforma em frase no tom do Guide, recebendo só esses dados. Eval reprova número ou motivo que não veio do domínio. Se o LLM falhar, cai para um template fixo ("Pizza: Forno e Cia, calabresa grande, R$ 39,90, mais barata").
- `sinais` e `hipoteses` são opcionais: o agente funciona sem eles e passa a usá-los quando a voz for conectada.

## 5. Como o prompt do Guide se divide

| Trecho de `src/voice/agent-prompt.md` | Vai para |
|---|---|
| Ritmos, regras de pergunta, separar ocasião em necessidades, fora de escopo, dados pessoais | `src/prompts/interpretar.ts` |
| Quem você é, tom, como fala, verdade sempre, limites, feedback natural | `src/prompts/responder.ts` (estilo é do Felipe; mudanças passam por ele) |
| Dados de exemplo | Fixtures do domínio fake (rotuladas como simuladas) |
| Recomendação principal e rótulo/motivo | **Domínio** (ranking), não o LLM; voz fala a principal, tela mostra até 3 |
| Teto de perguntas, anti-repetição, S5 uma vez | **Código** do orquestrador (o prompt só orienta) |
| "Foi o preço ou o gosto?" | `registrarEvento(reacao, motivo)` |
| "Posso montar?" | Mantido como consentimento; acrescentar o caminho de aprovação em S5 |

Ajustes pendentes no prompt: quantidade a partir de `pessoas` é do domínio (o LLM não calcula quantas pizzas); nome **Guide** é o da persona, **FoodPilot** o do produto **[DECIDIR se unifica]**.

## 6. Latência (para não ficar lento quando a voz entrar)

Medido pelo Felipe: TTS com primeiro byte em ~250–530 ms; STT em lote ~380–550 ms. **O gargalo esperado é o nosso backend** (LLM + domínio/MCP).

1. **Modelo rápido no `interpretar`** (JSON pequeno); trocar por configuração se a qualidade não bastar.
2. **Uma chamada de LLM** nos turnos de pergunta; duas só em S3/S4.
3. **Frase de espera** ("deixa eu ver as opções") disponível assim que o `interpretar` decide montar, para a voz usar.
4. **Necessidades buscadas em paralelo.**
5. **Medir cada etapa** (interpretar, domínio, responder) desde o M1. Sem meta inventada: definir depois de medir.

Lado da voz (Felipe, depois): STT em tempo real e TTS por frase.

## 7. Ferramentas do domínio (contrato do doc de fluxo, seção 4.2; dono Kenzo)

`obterContexto` · `buscarNecessidade` · `montarPlano` · `ajustarPlano` · `registrarEvento`. Nenhuma compra, aprova ou paga. Até existirem, o agente usa um **domínio fake com as mesmas assinaturas**.

## 8. Mantido

LLM sem ferramenta transacional · motivos só de `reasons[]` · restrição rígida nunca relaxada sozinha · falha do LLM/ferramenta → frase curta sem inventar · rótulo real × simulado · nunca dizer que o pedido foi feito.

## 9. Riscos e preocupações abertas

| Risco | Mitigação |
|---|---|
| Ficar lento (2 chamadas de LLM + MCP + TTS) | Seção 6; medir desde o M1 |
| LLM desobedece teto de perguntas / repete proposta | Regras em código, não só no prompt; casos C2, C6 |
| Reconhecimento erra palavras ("espíritas", "Escola Cucurbita") | Confirmação sim/não com contexto; palavras-chave no STT em tempo real |
| Fala inventa número ou motivo | Eval reprova; `responder` recebe só o snapshot |
| Domínio real (K-3/K-5) atrasa | Domínio fake com as mesmas assinaturas |
| Aprovação na tela depende de K-1 e M-1 | O core do agente para no evento de aprovação |
| Sem chave/cota de LLM | `LlmFake` mantém tudo andando; qualquer provedor entra por configuração |
