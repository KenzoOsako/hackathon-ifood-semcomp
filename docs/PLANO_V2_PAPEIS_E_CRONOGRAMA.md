# Guide V2 — Plano de papéis, interfaces e cronograma

> **Proposta de reorganização** (17/10/2026, ~19h45) para análise do time. Complementa `docs/DIRECAO_V2_OCASIAO.md` e **substitui, se aceita, a distribuição de donos** do `docs/PLANO_EXECUCAO_EQUIPE_FOODPILOT.md`. Não altera nada sem o aceite do Kenzo. Marcações: **[DECIDIR]** precisa de resposta do time; **[VERIFICAR]** depende do MCP real. Prazo: **domingo 12h30** (~17 horas).

> **Atualização (20h40):** após o PR #7 do Kenzo, ver [REVISAO_PR7_E_BACKLOG_V2.md](REVISAO_PR7_E_BACKLOG_V2.md): contratos e proposta local já existem; **o bloqueio da demo é a aprovação inalcançável (K-1) e a falta de botão de aprovação (M-1)**; backlog reduzido de 34 para 22 tasks.

## 1. As quatro funções

| Pessoa | Função | Em uma frase |
|---|---|---|
| **Felipe** | Conversação e Voz | Como o usuário **fala e ouve** o Guide, com baixa latência e sem atrito |
| **Hyago** | System Prompt e Fluxo de Agentes | Como o agente **pensa**: prompts, fluxos, extração de contexto e profundidade adaptativa |
| **Kenzo** | Request e Dados | Tudo que **entra e sai** (MCP, OAuth, dados, ranking, eventos) e as regras críticas |
| **Malveste** | Interface e Front-End | Como o usuário **vê e controla** (plano, aprovação, estados, painel) |

## 2. O que cada função entrega

### 2.1 Felipe — Conversação e Voz
**Escopo**
- **Voz de entrada e saída:** ElevenLabs (principal) e Web Speech API (reserva) no Chrome; texto sempre disponível.
- **Turnos de fala:** início e fim da fala do usuário, **interrupção** (o agente para quando o usuário fala por cima), tempo de espera e feedback sonoro/visual ("estou ouvindo", "procurando...").
- **Fala em português do Brasil:** preços, horários, quantidades e nomes ditos de forma natural; respostas curtas; leitura de **até 2 ou 3** opções, o resto na tela.
- **Sinais para o diálogo:** velocidade da fala, interrupções, silêncio, respostas curtas repetidas. Eles alimentam a **profundidade adaptativa** (o Hyago decide o nível; o Felipe fornece os sinais).
- **Confirmação por voz:** frase explícita e validada ("confirmo o plano"), nunca um "sim" solto; a aprovação continua passando pelo backend.
- **Falhas de voz:** microfone negado, ruído, provedor fora do ar; cai para texto sem perder a conversa.
- **Controle de custo de voz** (caracteres e segundos), com limite por pessoa.

**Pastas:** `src/voice/**`, hooks e rotas de voz próprias em `src/app/api/voice/**`.
**Não faz:** prompts do agente, regras de ranking, chamadas ao MCP.
**Entrega de negócio extra:** lidera o **pitch** e o **Entregável 01** (ver §3).

### 2.2 Hyago — System Prompt e Fluxo de Agentes
**Escopo**
- **System prompt e prompts por etapa:** extração de ocasião e necessidades, explicação das opções, perguntas de esclarecimento, tom em português do Brasil.
- **Fluxos do agente:** ocasião → necessidades → busca por vertical → ranking → plano → ajuste → aprovação. Um **orquestrador** (`src/agent/**`) que chama **funções de domínio** do Kenzo, sem acesso transacional.
- **Profundidade adaptativa (L0/L1/L2):** regras, detecção por LLM com saída estruturada validada, teto de 3 perguntas, "resumo e segue".
- **Saídas estruturadas validadas** com os esquemas do contrato (nunca texto solto virando ação).
- **Explicações fiéis:** o modelo só verbaliza `reasons[]` que vierem do ranking.
- **Adaptador de provedor de LLM** e **benchmark curto de modelo** (qualidade, uso de ferramentas, latência, custo).
- **Avaliação (evals):** pelo menos 15 cenários (rápido, vago, ocasião, restrição, mudança de ideia) com resultado esperado.
- **Controle de custo de tokens** (medidor por pessoa).

**Pastas:** `src/agent/**`, `src/prompts/**`, `src/evals/**`.
**Não faz:** autoridade para comprar, aprovar ou relaxar um filtro rígido (isso é código do Kenzo).
**Entrega extra:** **Entregável 02** (desenho da solução, fluxos).

### 2.3 Kenzo — Request e Dados
**Escopo**
- **Requests ao iFood:** cliente MCP real, **OAuth + PKCE**, tokens por usuário, refresh sem corrida, erros por domínio, adaptador por vertical.
- **Sondagem por vertical** (gate de escopo) e normalização dos dados do MCP.
- **Ranking determinístico** por necessidade e vertical, filtros rígidos, totais, incerteza e `reasons[]`.
- **Contratos compartilhados** (inclui Ocasião, Necessidade, Plano) e **proposta versionada** com aprovação que invalida por mudança material. **Nenhuma finalização de compra pelo Guide.**
- **Dados e eventos:** armazenamento (Supabase com RLS se ficar pronto, senão local), **eventos de feedback**, consentimento, apagar dados, **agregados** que o painel lê.
- **Continuidade no iFood:** deeplink validado ou resumo copiável.
- **Segurança:** segredos, histórico de commits, callbacks por ambiente.

**Pastas:** `src/mcp/**`, `src/reco/**`, `src/contracts/**`, `src/domain/**`, `src/data/**`, rotas OAuth em `src/app/api/auth/**`.
**Não faz:** prompts, voz, componentes de tela.
**Entrega extra:** **Entregável 05** (técnico) e **Entregável 06** (feedback do MCP), com contribuição de todos.

### 2.4 Malveste — Interface e Front-End
**Escopo**
- **Conversa e plano de ocasião:** um bloco por necessidade (pizza, pipoca, presente), até 3 opções com motivo, ajuste e **aprovação do plano inteiro**.
- **Estados claros:** ouvindo, pensando, falando, erro, aguardando aprovação, aprovado, expirado; rótulos **real × simulado**.
- **Controles de memória e privacidade:** ver, corrigir, apagar, desligar uso agregado.
- **Painel de insights para o iFood:** só agregados; dados de demonstração rotulados como simulados.
- **Acessibilidade:** teclado, leitor de tela, contraste; modo texto equivalente à voz.
- **Operação da demo:** conduz a tela durante o pitch.

**Pastas:** `src/app/page.tsx`, `src/app/**` (exceto `api/`), `src/ui/**`.
**Não faz:** regra de ranking, chamadas diretas ao MCP, aprovação no navegador (o backend revalida).
**Entrega extra:** **Entregáveis 03 e 04**, testes com pessoas.

## 3. O que sobra fora das quatro funções, e como dividi

| Lacuna | Quem | Por quê |
|---|---|---|
| **Pitch (5+3), narrativa e Entregável 01** | **Felipe** (apoio: todos nas perguntas técnicas) | Quem fala em público e entende o negócio; a voz é o "uau" da demo |
| **Desenho da solução (Entregável 02)** | **Hyago** | É o fluxo do agente |
| **Documento técnico (05) e feedback do MCP (06)** | **Kenzo** | Conhece o MCP e a arquitetura |
| **Entregáveis 03 e 04** | **Malveste** | São a experiência e a interface |
| **Roteiro da demo "aniversário"** | **Felipe** (escreve) + **Malveste** (opera) | Alinha fala e tela |
| **Dados de demonstração e simulados** | **Kenzo** (esquema) + **Hyago** (cenários) | Precisam bater com os contratos |
| **Testes com pessoas e coleta de reações** | **Malveste** (método) + **Felipe** (conversa com participantes) | Gera evidência para o pitch |
| **Integração, QA e deploy** | **Kenzo** coordena; **cada dono testa o que entrega** | Evita gargalo de revisão |
| **Medidor de gastos (tokens e voz)** | **Hyago** (LLM) e **Felipe** (voz) | Cada um mede o próprio |
| **Vídeo de reserva e plano B** | **Malveste** grava, **Felipe** narra | Rede de segurança da demo |

## 4. O que isso muda em relação ao plano anterior

| Item (plano anterior) | Antes | Agora |
|---|---|---|
| OAuth e MCP real (FP-03/04) | Hyago | **Kenzo** |
| Supabase, identidade, RLS e memória (FP-12) | Hyago | **Kenzo** |
| Continuidade externa (FP-11) | Hyago | **Kenzo** (UI: Malveste) |
| Sondagem por vertical (OCS-02) | Hyago | **Kenzo** |
| Eventos de feedback (INS-01) | Hyago | **Kenzo** |
| Feedback MCP (FP-22) e revisão de segredos (SEC-01) | Hyago | **Kenzo** |
| Orquestrador e agente (`agent.ts`) (FP-15) | Kenzo | **Hyago** |
| Adaptador de LLM e benchmark (FP-08/09) | Terossi | **Hyago** |
| Diálogo adaptativo (OCS-03) | Terossi | **Hyago** (sinais de voz: Felipe) |
| Voz e fallback (FP-10) | Terossi | **Felipe** (igual) |
| Pitch (FP-24), Entregável 01 (FP-18), roteiro da demo | Kenzo | **Felipe** |
| Entregável 02 (FP-19) | Kenzo | **Hyago** |
| Ranking, contratos, proposta versionada, QA, deploy, Entregável 05 | Kenzo | **Kenzo** (igual) |
| Interface, entregáveis 03 e 04, painel (FP-07/13/20/23) | Malveste | **Malveste** (igual) |

**Efeito prático:** o Kenzo concentra o que é mais crítico e arriscado (MCP, dados, regras), e o Hyago passa a ser o dono do "cérebro" do agente, que é o diferencial da V2.

## 5. Como as peças se falam (interfaces)

```
Felipe (voz) ──eventos de conversa──▶ Hyago (agente) ──funções de domínio──▶ Kenzo (MCP, ranking, plano, dados)
      ▲                                      │                                         │
      └────────── fala/legenda ◀─────────────┴──── snapshots do plano ───────────────▶ Malveste (UI)
```

1. **Voz → Agente** (`POST /api/converse`, resposta em fluxo): entrada `{sessionId, texto, origem: voz|texto, sinais: {velocidadeFala, interrompeu, silencioMs}}`; saída: `resposta_parcial`, `evento_de_tela`, `resposta_final`.
2. **Agente → Domínio:** funções do Kenzo, sem acesso transacional: `obterContexto`, `buscarNecessidade`, `rankear`, `montarPlano`, `ajustarPlano`, `aprovarPlano(versão)`, `registrarEvento`.
3. **Domínio → UI:** **snapshot do plano versionado** (`planoId`, `versão`, necessidades, opções, motivos, totais conhecidos ou ausentes, pendências, origem real/simulada).
4. **UI/Voz → Aprovação:** evento de aprovação com `planoId` e `versão`; o **backend revalida** tudo.

**Contratos congelados até 21h30** (Kenzo publica; os três consumidores revisam): `Ocasião`, `Necessidade`, `Plano`, `EventoDeConversa`, `EventoDeFeedback`, `ReasonsFromRank`.

## 6. Fluxo ponta a ponta (a demo)

1. Usuário, por voz: "Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme."
2. **Voz** transcreve e envia com os sinais.
3. **Agente** classifica o nível (L2), extrai ocasião e 3 necessidades, faz **uma** pergunta ("quantas pessoas?").
4. **Domínio** busca por vertical (restaurante, mercado, shopping se o gate permitir), filtra e ranqueia, devolve opções com motivos reais.
5. **Agente** verbaliza o plano; **UI** mostra os 3 blocos.
6. Usuário ajusta ("a pizza mais barata"); o domínio recalcula e a versão do plano muda.
7. Usuário aprova o plano; backend revalida; **continuidade no iFood** (deeplink ou resumo). **Nenhum pedido é finalizado pelo Guide.**
8. **Eventos** são gravados (opções, reações, seleção, necessidades não atendidas, fricção).
9. Caso rápido (L0): "pizza calabresa grande, pede logo" → proposta em um turno.

## 7. Cronograma até domingo 12h30

| Janela | Todos | Felipe | Hyago | Kenzo | Malveste |
|---|---|---|---|---|---|
| **19h45–21h30 (Sprint 0)** | Aceite da V2 e dos papéis; **gate das verticais às 21h**; congelar contratos | Voz mínima funcionando (ElevenLabs, ou Web Speech) falando e ouvindo texto de teste | Prompts v0 e **15 cenários de teste**; extração de ocasião em JSON | Sondagem do MCP real; contratos; OAuth | Esqueleto do plano de ocasião com dados simulados |
| **21h30–00h30 (Esqueleto V2)** | Rodada: texto → plano → aprovação, **tudo simulado**, ponta a ponta | Voz plugada ao fluxo; interrupção | Fluxos L0/L1/L2; perguntas; verbalização | Ranking por necessidade; plano versionado; leitura real começa | Estados, aprovação, rótulos real × simulado |
| **00h30–03h (Real)** | MCP real no fluxo; eventos gravados; **1º ensaio completo** | Falhas de voz e fallback; latência | Evals rodando; ajuste de prompt; custo | Dado real muda o resultado; eventos e consentimento | Painel de insights; controles de memória |
| **03h–07h (revezamento)** | Dois descansam por vez; os outros dois seguem os cartões abaixo | Entregável 01 e roteiro | Entregável 02 | Entregável 05/06 e deploy preparado | Entregáveis 03/04 e testes com pessoas |
| **07h–09h** | **Congelamento de funcionalidades às 9h** | Voz estável; pitch rascunhado | Corrigir falhas dos evals | QA integrado (AC) e segurança | Acessibilidade e polimento |
| **09h–11h** | Ensaios da demo (2x), **vídeo de reserva** | Narração e ritmo | Plano B (texto) | Deploy testado | Operar a demo |
| **11h–12h30** | Revisão final, evidências, **submissão** | Pitch final | Fechar desenho | Fechar técnico | Fechar interface |

**Gates (se um falhar, aciona o plano B):**
- **G1 (21h):** verticais sondadas. Falhou → restaurante + mercado reais; shopping simulado e rotulado.
- **G2 (21h30):** contratos congelados.
- **G3 (00h30):** fluxo ponta a ponta com dados simulados.
- **G4 (03h):** dado real do MCP no fluxo. Falhou → demo com simulados rotulados e a integração real mostrada à parte.
- **G5 (09h):** congelamento.

## 8. Definição de pronto e qualidade

Cada entrega só conta com: tipos e testes passando (`typecheck`, `lint`, `test`, `build`), **sem segredo**, rotulagem real × simulado, e PR pequeno com o card citado. **Aceites da demo:**

| ID | Verificação |
|---|---|
| D-1 | A ocasião vira ≥ 2 necessidades em verticais diferentes, com 3 opções e motivos reais cada |
| D-2 | O usuário muda algo por voz, e o plano muda de versão e invalida a aprovação anterior |
| D-3 | **Nenhum** pedido é submetido pelo Guide; a continuidade é no iFood |
| D-4 | Caso rápido (L0) chega à proposta em um turno; caso vago respeita o teto de 3 perguntas |
| D-5 | Interrupção por voz e queda para texto funcionam |
| D-6 | Eventos de feedback são gravados e o painel os mostra, rotulados |
| D-7 | Alergia e teto rígido nunca são relaxados sozinhos |
| D-8 | 10 execuções seguidas do roteiro: ≥ 9 sem falha |

## 9. Riscos da nova distribuição

| Risco | Mitigação |
|---|---|
| **Kenzo sobrecarregado** (MCP real, dados, ranking, contratos, QA, deploy, doc técnico) | Reduzir revisões: dono do módulo aprova mudanças dentro do seu módulo e Kenzo aprova contratos, regras críticas e MCP. **[DECIDIR]** exige ajustar o CODEOWNERS |
| **Hyago depende do domínio do Kenzo** para o agente andar | Domínio **simulado primeiro** (mesmos contratos); troca para o real sem mudar o agente |
| **Felipe depende do agente** para a voz fazer sentido | Voz testada com respostas fixas até o agente existir |
| **Malveste depende dos snapshots** | Snapshots de exemplo no contrato desde 21h30 |
| **Escopo grande para 17 h** | P0 = 2 verticais; painel e 3ª vertical só se o gate e o tempo permitirem |
| **Chave de LLM única e custo** | Medidor por pessoa e limite; provedor decidido no benchmark do Hyago |
| **Cansaço** | Revezamento do sono planejado; nada crítico decidido de madrugada sem revisão |

## 10. Rituais
- **A cada 2 horas, 5 minutos:** o que travou, o que mudou nos contratos, o que cada um entrega até o próximo ponto.
- **Um canal só** para bloqueios; PR parado mais de 15 minutos chama o revisor.
- **Trello:** um card por entrega; quem pega muda o dono e a lista; comentário com link do PR.
- **Contrato mudou?** Aviso imediato aos consumidores antes de mexer no código.

## 11. Decisões para o time agora
1. **Aceitam a distribuição das §2 e §3** (inclui Pitch + Entregável 01 com o Felipe e Entregável 02 com o Hyago)?
2. **Revisão de PR:** o dono do módulo aprova dentro do módulo, e o Kenzo só contratos, regras críticas e MCP? (muda o CODEOWNERS)
3. **Provedor de LLM** e quem guarda a chave (Hyago decide pelo benchmark, mas precisa de acesso hoje).
4. **Endereço e cidade da demo** para a sondagem.
5. **Revezamento do sono**: quem descansa em qual janela.

## 12. Próximos 30 minutos, por pessoa
- **Felipe:** testar a chave da ElevenLabs e subir o primeiro "fala e ouve" com texto fixo; escrever o roteiro do aniversário (versão 1).
- **Hyago:** esboçar o system prompt v0, o JSON de ocasião e os 15 cenários; decidir como testar os provedores de LLM.
- **Kenzo:** rodar a sondagem por vertical, publicar os contratos de Ocasião, Necessidade e Plano, e avisar o resultado do gate.
- **Malveste:** montar a tela do plano de ocasião com dados simulados (um bloco por necessidade) e os estados.
