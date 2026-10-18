# src/data — Eventos de feedback, consentimento e armazenamento

**Dono:** Kenzo. **Status:** parcial — sinais de demanda em `sinais.ts` (sem pedido de consentimento por ora, ver D-019), `/api/sinais` e `/painel` (18/10, Malveste). Eventos `reacao` e `friccao` ainda não.

**Responsabilidade:** estruturar o que a conversa produz e devolver **agregados** que o painel do iFood mostra.

## Eventos (sem dados pessoais, ID anônimo de sessão)

| Evento | Campos principais |
|---|---|
| `opcoes_exibidas` | necessidade, vertical, rótulos, motivos, origem real ou simulada |
| `reacao` | `aceitou` · `rejeitou` · `ajustou`, **código do motivo** (`preco`, `prazo`, `gosto`, `restricao`, `ja_pediu`, `outro`) |
| `selecao_final` | necessidade, opção, nível (L0/L1/L2), nº de turnos |
| `necessidade_nao_atendida` | descrição curta, vertical, causa (`sem_resultado`, `preco`, `prazo`, `restricao`) |
| `friccao` | turnos até a 1ª proposta, perguntas feitas, nível rebaixado |
| `consentimento` | o que foi autorizado (contexto, memória, uso agregado) e quando |

## Agregados (o que o iFood veria)
Motivos de rejeição por vertical e rótulo · necessidades sem cobertura · combinações de ocasião · fricção por nível.

## Regras de privacidade
1. **Consentimento explícito** antes de guardar; "uso agregado" é uma opção separada.
2. **Sem PII**; texto livre opcional, curto e com aviso.
3. O usuário pode **ver, corrigir e apagar**.
4. Dados de demonstração **rotulados como simulados**; o painel não mostra números de impacto inventados.
5. Supabase com RLS **só se** identidade e isolamento forem verificados; senão armazenamento local e persistência declarada como pendente.

## Observação
O benefício para o iFood é **hipótese**: estruturamos e agregamos os sinais, mas não afirmamos melhora de conversão ou satisfação. A proposta canônica não aprova venda de dados; aqui nada é vendido.
