# FoodPilot — Direção V2: ocasião, contexto por voz e dados para o iFood

> **Adendo** à proposta canônica (`docs/PROPOSTA_DE_NEGOCIO_FOODPILOT.md`) e ao plano (`docs/PLANO_EXECUCAO_EQUIPE_FOODPILOT.md`). Redigido em 17/10/2026, ~19h30. **Não reescreve os documentos do Kenzo**: ele decide o que incorporar. Marcações: **[DECISÃO PROPOSTA]** aguarda aceite do time; **[HIPÓTESE]** não comprovada; **[VERIFICAR]** depende do MCP real.

## 1. A mudança em uma frase
Mantemos o FoodPilot (copiloto de voz, personalizado, com recomendação explicada e aprovação humana), mas **saímos de "escolher uma refeição" para "resolver uma ocasião"**, entre várias verticais, e o **diferencial passa a ser o contexto rico que a fala gera e o dado estruturado que isso devolve ao iFood**.

Exemplo-guia (a demo): *"Hoje é aniversário de um amigo. Vamos comer pizza em casa e ver um filme."* → o agente sugere **a pizza** (restaurante), **a pipoca** (mercado) e **o presente** (shopping), explica cada escolha e monta uma proposta única.

## 2. O que fica e o que muda

| Tema | Plano original | Direção V2 | Efeito |
|---|---|---|---|
| **Unidade de trabalho** | Uma refeição, até 3 opções de restaurantes | Uma **ocasião** com várias **necessidades**, cada uma com até 3 opções | Novo contrato (Ocasião, Necessidade, Plano) |
| **Verticais** | Só restaurante; supermercado no roadmap (RF-01, decisões 1 e 19) | Restaurante + mercado + shopping (as que o catálogo sustentar) | **Muda o escopo aprovado**: exige D-007 |
| **Diferencial** | Voz como acessibilidade e facilidade | (1) Personalização por **contexto rico** vindo da fala; (2) **feedback estruturado** que o iFood pode usar | Nova camada de dados e painel |
| **Conversa** | Interpretar pedido + refinamento | **Profundidade adaptativa**: rápido quando o usuário tem pressa, guiado quando a ocasião é vaga; nunca cansativo | Nova política de diálogo |
| **Múltiplos estabelecimentos** | P2, só se suportado | **P0 como proposta local** (sem criar carrinhos remotos) | Compatível com "FoodPilot não finaliza compra" |
| **Compra** | Continua no iFood; FoodPilot não submete | **Igual** | Sem mudança, e evita falha parcial entre lojas |
| **Voz** | P1 em paralelo ao P0 textual | **Igual**, texto sempre funcional | Sem mudança |
| **Guardrails** (aprovação, restrições, proveniência) | Regra de negócio | **Igual** | Valem para cada necessidade |

**Sem mudança:** não submeter pedido, aprovação da versão da proposta, filtros rígidos (alergia), proveniência dos motivos, ownership de pastas, fluxo de PR.

## 3. O novo diferencial, escrito com cuidado

### 3.1 Personalização por contexto rico
**[HIPÓTESE]** Falar costuma trazer mais contexto do que filtros de tela: ocasião, quem vai estar, clima da noite, restrições, orçamento por item, "algo diferente". O agente transforma isso em um **contexto estruturado** e o usa para ordenar e justificar. A prova é comparar o **mesmo cenário com e sem esse contexto** (aceite AC-03 do plano) e mostrar a diferença no resultado.

### 3.2 Dado valioso para o iFood
**[HIPÓTESE]** Cada conversa gera sinais que o app não captura bem: **por que** uma opção foi rejeitada, **o que** o cliente procurou e não achou, **como** ocasiões se combinam em categorias, onde a conversa travou. Esses sinais, agregados e anonimizados, podem ajudar o iFood a melhorar a experiência daquele cliente e de outros em situações parecidas.

**O que podemos afirmar no pitch:** que **estruturamos e mostramos** esses sinais (com dados de demonstração rotulados) e **como** o iFood os usaria. **O que não podemos afirmar:** que melhoram satisfação ou conversão (não medimos), nem que o iFood já não coleta algo parecido.

## 4. Experiência: profundidade adaptativa

Objetivo: **o menor número de perguntas que ainda acerta**. Quem quer pedir logo, pede logo.

| Nível | Quando | Comportamento |
|---|---|---|
| **L0 Rápido** | Pedido específico ("pizza calabresa grande"), "o de sempre", "pede logo", "você escolhe", pressa explícita | **0 perguntas.** Proposta no primeiro turno |
| **L1 Padrão** | Intenção clara com uma lacuna que muda o resultado | **1 pergunta**, a de maior valor |
| **L2 Guiado** | Intenção vaga ou ocasião complexa ("aniversário do meu amigo") | **Até 3 perguntas**, uma por vez, cada uma com "pode escolher por mim" |

**Regras:**
1. **Teto:** no máximo 3 perguntas por sessão.
2. **Só pergunta se a resposta muda o ranking.** Senão, assume um padrão e diz qual assumiu.
3. **Rebaixa o nível** com sinais de pressa ("tanto faz", respostas muito curtas e repetidas, interrupção, "só pede"). Pergunta de novo só se o usuário pedir.
4. **Resume e segue:** "Entendi: pizza para 6, pipoca e um presente até R$ 100. Monto?"
5. **Oferece aprofundar, não impõe:** ao fim, "quer que eu refine mais?".
6. **Feedback sem formulário:** os sinais saem de reações naturais (aceitou, trocou, "mais barato"), não de pesquisa. Uma pergunta opcional pós-proposta, no máximo.

**Como detectar:** classificação por LLM com saída estruturada validada (`nivel`, `sinais`) e regras de reserva. Se a saída for inválida, usa L1.

**Diálogo de referência (L2, a demo):**
> **Usuário:** "Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme."
> **Agente:** "Que legal! Quantas pessoas, mais ou menos?" *(1ª pergunta; muda quantidade e pedido mínimo)*
> **Usuário:** "Umas seis."
> **Agente:** "Entendi: pizza para 6, pipoca para o filme e um presente. Quer um valor para o presente, ou escolho algo até R$ 100?"
> **Usuário:** "Pode escolher."
> **Agente:** "Montei três blocos: **Pizza** (...), **Pipoca** (...), **Presente** (...). Cada um com o motivo. Quer ajustar algum?"

## 5. Dados estruturados

### 5.1 Contexto de ocasião (o que a conversa produz)
```jsonc
{
  "occasionId": "anon-uuid",
  "profundidade": "L2",
  "ocasiao": { "tipo": "aniversario", "pessoas": 6, "quando": "hoje", "local": "casa" },
  "necessidades": [
    { "id": "n1", "vertical": "RESTAURANT", "categoria": "pizza", "restricoes": [], "orcamento": null },
    { "id": "n2", "vertical": "GROCERIES",  "categoria": "pipoca", "restricoes": [], "orcamento": null },
    { "id": "n3", "vertical": "SHOPPING",   "categoria": "presente", "orcamento": { "max": 100, "tipo": "flexivel" } }
  ]
}
```

### 5.2 Eventos de feedback (a base dos insights)
Um evento por fato, sem dados pessoais, com identificador anônimo de sessão.

| Evento | Campos principais |
|---|---|
| `opcoes_exibidas` | necessidade, vertical, rótulos, motivos (`reasons`), origem real ou simulada |
| `reacao` | tipo (`aceitou` · `rejeitou` · `ajustou`), **código do motivo** (`preco`, `prazo`, `gosto`, `restricao`, `ja_pediu`, `outro`) |
| `selecao_final` | necessidade, opção, nível de profundidade, número de turnos |
| `necessidade_nao_atendida` | descrição curta, vertical, causa (`sem_resultado` · `preco` · `prazo` · `restricao`) |
| `friccao` | turnos até a primeira proposta, perguntas feitas, nível rebaixado (sim/não) |
| `consentimento` | o que foi autorizado (contexto, memória, uso agregado) e quando |

### 5.3 Insights derivados (o que o iFood veria, sempre agregado)
- Principais **motivos de rejeição** por vertical e rótulo.
- **Necessidades sem cobertura** (o que as pessoas procuram e não acham).
- **Combinações de ocasião** (aniversário → pizza + pipoca + presente).
- **Fricção:** turnos médios até a proposta, por nível.

### 5.4 Regras de privacidade
1. **Consentimento explícito** antes de guardar contexto; "usar de forma agregada" é uma opção separada.
2. **Sem PII** nos eventos; texto livre opcional e curto, com aviso.
3. O usuário pode **ver, corrigir e apagar**.
4. O painel mostra **só agregados**, e dados de demonstração são **rotulados como simulados**.
5. Alinhar com o plano: persistência só com identidade, RLS e controles verificados; senão, memória em sessão e pendência declarada.

## 6. Escopo revisado

| Prioridade | Itens |
|---|---|
| **P0** | Contrato de ocasião e plano multi-necessidade; conversa por texto com extração de contexto e **profundidade adaptativa**; ranking por necessidade em **2 verticais reais** (restaurante e mercado); proposta local única; eventos de feedback gravados (mesmo que em arquivo local); MCP real lendo dados que mudam o resultado; aprovação humana e continuidade no iFood |
| **P1** | Voz com ElevenLabs e plano B de texto; **3ª vertical (shopping)**; painel de insights; memória persistente com controles; modos (econômico, surpresa...) |
| **P2 / roadmap** | Alerta proativo; grupo com vários participantes; mercado avançado (preço por unidade, substituição); integração nativa |

**Gate de escopo [VERIFICAR]:** só entram as verticais que o MCP real sustentar no endereço da demo (mínimo sugerido: **3 lojas abertas e dezenas de itens com preço**). Sem isso a vertical vira **narrativa rotulada**, e a demo continua com as que funcionarem. Adega e farmácia ficam fora: adega pede verificação de maioridade que não sabemos como o MCP trata; farmácia tem risco regulatório.

## 7. Impacto nas tarefas (Trello)

| Card existente | Dono | O que muda |
|---|---|---|
| HYA-01 Validar conexão real | Hyago | Inclui **sondagem por vertical** (ver OCS-02) |
| KEN-01 Contratos | Kenzo | Acrescentar **Ocasião, Necessidade, Plano** (ver OCS-01) |
| KEN-04 Regras críticas de recomendação | Kenzo | Valem **por necessidade**; shopping e mercado têm regras próprias |
| KEN-02/03 Aprovação e sem finalização | Kenzo | Sem mudança; a aprovação passa a ser **do plano** (várias lojas) e invalida por mudança material |
| TER-04/05 Orquestrador e LLM | Terossi | Passa a incluir **extração de contexto e profundidade adaptativa** (ver OCS-03) |
| TER-01/02/03/06/07 Voz | Terossi | Sem mudança |
| ENT-01/02/03/04/05/06, PITCH-01 | vários | Refletir a V2; **demo = aniversário** (ver DEMO-01) |

**Cards novos** (criados no Trello): OCS-01 contratos · OCS-02 sondagem MCP por vertical · OCS-03 diálogo adaptativo e extração · OCS-04 ranking por necessidade · INS-01 eventos e armazenamento · INS-02 painel de insights · UX-01 tela de plano de ocasião · DEMO-01 roteiro e dados de demonstração.

## 8. Métricas (para medir, não para prometer)
- **Tempo e turnos até a primeira proposta**, por nível; **perguntas feitas** (teto 3).
- **% de ocasiões cobertas** pelas verticais disponíveis.
- **Diferença de resultado com e sem contexto** no mesmo cenário (AC-03).
- **Acerto da detecção de pressa** (rápido vs guiado) em cenários de teste.
- **Eventos de feedback por sessão** e **motivos de rejeição classificados**.

## 9. Riscos e pontos abertos
1. **Catálogo fora de restaurante [VERIFICAR]:** os mentores avisaram que algumas verticais são pequenas. Plano B: restaurante + mercado reais, shopping rotulado como simulado.
2. **Mudança de escopo (decisões 1 e 19):** exige D-011 aprovado pelo Kenzo e registro na proposta.
3. **Escopo grande para ~17 horas.** Por isso P0 é só 2 verticais e a camada de dados é simples; painel e voz vêm depois.
4. **Valor para o iFood é hipótese.** Não usar números inventados no pitch.
5. **Conversa cansativa:** testar com pessoas reais; se o usuário disser que perguntamos demais, reduzir o teto.
6. **Presente (shopping):** variantes, prazo e catálogo incertos; começar por uma faixa de preço e categoria simples.

## 10. Linha do tempo (até domingo 12h30)

| Janela | Foco |
|---|---|
| **19h30–21h** | Aceite da V2 (Kenzo); **sondagem por vertical (gate)**; contrato de ocasião; leitura real do MCP |
| **21h–02h** | **Núcleo:** texto → contexto → ranking por necessidade → proposta única; eventos de feedback gravados; UI do plano |
| **02h–08h** | Voz (ElevenLabs), 3ª vertical se o gate permitir, painel de insights, testes com pessoas; entregáveis em paralelo |
| **08h–11h** | Congelar; QA integrado (AC-01 a AC-15 adaptados); deploy; ensaios da demo |
| **11h–12h30** | Pitch final, evidências, submissão |

## 11. Perguntas para o time decidir agora
1. **Aprovam D-011** (escopo multi-vertical e novo diferencial)? Dono da decisão: Kenzo.
2. O corte de 2 verticais no P0 está bom?
3. Quem valida o resultado da sondagem e comunica o gate até **21h**? (Hyago, por padrão.)
