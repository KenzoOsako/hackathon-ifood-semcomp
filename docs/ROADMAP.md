# Guide — Roadmap operacional até a submissão

> **Proposta** (17/10/2026, ~20h40) que junta num só caminho o [Plano V2](PLANO_V2_PAPEIS_E_CRONOGRAMA.md), o [Plano do agente](PLANO_AGENTE.md) (Hyago), a [arquitetura de conversa e fluxo](AGENTE_CONVERSA_E_FLUXO.md) e a [revisão do PR #7](REVISAO_PR7_E_BACKLOG_V2.md). **Não substitui nenhum deles**: diz a ordem, os entregáveis e os pontos de controle. Prazo: **domingo 18/10, 12h30**. Marcações: **[DECIDIR]** precisa de resposta; **[VERIFICAR]** depende de teste.

## 1. Tem que ser tudo pela ElevenLabs? Não.

O **agente do painel** da ElevenLabs (o que testamos no Preview) serve como **laboratório**: ajustar tom, voz e ritmo rápido, e ficar como **plano B**. O produto roda **por código**.

| | Agente do painel (ElevenLabs) | Orquestrador por código (nosso) |
|---|---|---|
| Regras (teto de 3 perguntas, L0/L1/L2, sem repetir) | Pedidas no prompt; o modelo pode falhar | **Garantidas em código** e testadas |
| Números e motivos | Só "pedidos" ao modelo | Verificados contra o que o domínio devolveu |
| Versionamento e revisão | Fora do git, no painel | **No git**, com PR e testes |
| Avaliação (evals) | Manual | **Automática** (15+ cenários) |
| Eventos de feedback | Difícil de ligar | Gravados em pontos fixos |
| Hipóteses do reconhecimento | Não temos | Possíveis se o reconhecimento for nosso |
| Esforço | Baixo | Maior, **mas o Hyago já planejou** ([PLANO_AGENTE](PLANO_AGENTE.md)) |
| O que perdemos | Turnos e interrupção prontos | **Temos que fazer** (ver 2.3) |

**Decisão proposta (D-015):** a ElevenLabs é **provedor de voz por API** (TTS e STT). O **cérebro é código nosso**. O agente do painel fica como laboratório e plano B.

## 2. Arquitetura por código

### 2.1 Caminho de uma fala
```
Navegador                         Servidor (Next.js)
─────────                         ──────────────────
mic ─ push-to-talk ─▶ POST /api/voice/stt ─▶ ElevenLabs STT ─▶ texto + sinais
texto + sinais ─────▶ POST /api/converse ──▶ orquestrador (Hyago)
                                              ├─ LLM: interpretar (JSON validado)
                                              ├─ código: estado, nível, teto de perguntas
                                              ├─ domínio (Kenzo): buscar → rankear → plano
                                              └─ verbalizar por template (só reasons[])
{ reply, speech, evento_de_tela, plano? } ◀──┘
speech ─────────────▶ POST /api/voice/tts ──▶ ElevenLabs TTS ─▶ áudio (mp3)
áudio ─ fila de reprodução ─ interrompível ─▶ alto-falante
reply / plano ─────────────────────────────▶ tela (Malveste)
```

### 2.2 Quem é dono de cada peça

| Peça | Arquivos | Dono | Estado |
|---|---|---|---|
| Síntese de voz, texto falado, guardas, sinais, gasto | `src/voice/*`, `/api/voice/tts` | Felipe | **Pronto e na `main`** |
| Reconhecimento (lote) e hook do microfone | `/api/voice/stt`, `src/voice/use-voice.ts` | Felipe | A fazer (R0/R1) |
| Orquestrador, prompts, adaptador de LLM, `/api/converse`, evals | `src/agent/**`, `src/prompts`, `src/evals` | Hyago | Plano pronto |
| Domínio, ranking, plano, MCP, eventos | `src/domain`, `src/reco`, `src/mcp`, `src/data` | Kenzo | PR #7 pronto; K-1, K-3, K-5 a fazer |
| Tela, aprovação, estados de voz, privacidade, painel | `src/app/**`, `src/ui` | Malveste | A fazer |

### 2.3 O que a ElevenLabs fazia e agora é nosso (e como)
- **Fim de fala:** começar com **push-to-talk** (segurar para falar). Depois, detectar silêncio no navegador, ou o controle de fim de fala do reconhecimento em tempo real `[VERIFICAR]`.
- **Interrupção:** o player para o áudio quando o usuário aperta para falar ou o microfone detecta voz; o resto da fala é descartado e o novo turno é processado.
- **Latência:** `speech` é curto (template), a síntese leva ~350 a 620 ms (medido), o reconhecimento em lote ~380 a 550 ms (medido).
- **Fallback:** se a voz falha, `/api/voice/tts` responde 503 e a tela segue em texto.

## 3. Roadmap por marcos

Cada marco termina com **algo rodando e uma prova**.

### R0 · Fundação · agora → 21h30 (G1 e G2)
| Dono | Entregáveis |
|---|---|
| **Kenzo** | Sondagem do MCP real por vertical (**G1**) · **K-1** custo confirmado no mock (destrava a aprovação) · **K-5** funções de domínio fora de `agent.ts` · **K-3** contrato Ocasião, Necessidade e Plano (**G2**) |
| **Hyago** | Tipos do agente (`AgentSession`, `TurnoInterpretado`, `LlmPort`, `DomainPort`) · adaptador de LLM funcionando · 15 cenários de eval escritos (PLANO_AGENTE M0) |
| **Felipe** | Persona vocal final (voz, Expressive off, estabilidade) · `/api/voice/stt` (reconhecimento em lote, mesmos guardas) · hook do microfone push-to-talk · aceite do D-015 |
| **Malveste** | **M-1** proposta, pendências e botão de aprovação na tela · casca do plano de ocasião com dados simulados |
**Pronto quando:** contratos publicados, G1 respondido, microfone grava e devolve texto, tela mostra proposta e botão.

### R1 · Ponta a ponta em texto, simulado · 21h30 → 00h30 (G3)
| Dono | Entregáveis |
|---|---|
| **Hyago + parceiro** | Turno completo com domínio fake; `POST /api/converse`; evals rodando (LLM fake e depois real) |
| **Kenzo** | Ranking por necessidade; plano versionado compondo várias propostas; aprovação do plano |
| **Felipe** | Player com **fila e interrupção**; voz plugada ao `/api/converse` (sinais incluídos); texto como alternativa sempre disponível |
| **Malveste** | UX-01 plano de ocasião (um bloco por necessidade), estados de voz (ouvindo, pensando, falando, erro), aprovação |
**Pronto quando (G3):** "aniversário, pizza e filme" → no máximo 3 perguntas → plano com 2+ necessidades e motivos → ajuste ("pizza mais barata") gera nova versão → **aprovação na tela**, tudo rotulado como simulado.

### R2 · Voz ponta a ponta e dado real · 00h30 → 03h (G4)
| Dono | Entregáveis |
|---|---|
| **Felipe** | Jornada **por voz** no Chrome sem texto · falhas de voz (microfone negado, provedor fora) · testes C1 a C12 de [AGENTE_CONVERSA_E_FLUXO](AGENTE_CONVERSA_E_FLUXO.md) |
| **Hyago** | Domínio real no lugar do fake · eval que **falha** se aparecer motivo fora de `reasons[]` · custo e latência por turno anotados |
| **Kenzo** | Leitura real do MCP no ranking (**G4**), K-4 continuidade no iFood · eventos de feedback gravados |
| **Malveste** | Controles de privacidade · INS-02 painel (se o G3 passou) |
**Pronto quando (G4):** a mesma jornada por voz com **dado real** (ou mock rotulado, se o G4 falhar).

### R3 · Revezamento e entregáveis · 03h → 07h
Dois descansam por vez; os outros dois seguem. **Nada crítico decidido de madrugada sem revisão.**
| Dono | Entregáveis |
|---|---|
| **Felipe** | **ENT-01** proposta de negócio · roteiro do pitch (5+3) · roteiro da demo "aniversário" |
| **Hyago** | **ENT-02** desenho da solução · ajustar prompts pelos evals que falharam |
| **Kenzo** | **ENT-05** documento técnico · **ENT-06** feedback do MCP (≥ 10 observações reais) · deploy preparado |
| **Malveste** | **ENT-03** racional da experiência · **ENT-04** interface visual (capturas) · testes com pessoas |

### R4 · Polimento e extras · 07h → 09h
Em ordem de valor, **só se os marcos anteriores estiverem fechados**: (1) estabilidade e latência; (2) acessibilidade; (3) 3ª vertical (shopping); (4) **reconhecimento em tempo real** com palavras-chave `[VERIFICAR]`; (5) painel de insights; (6) memória persistente.

### R5 · Congelamento e QA · 09h (G5) → 10h30
Sem funcionalidade nova. Matriz de aceite da demo (seção 6), `typecheck`, `lint`, `test`, `build`, correções.

### R6 · Ensaios, vídeo e deploy · 10h30 → 11h30
Roteiro **10 vezes** (aceite: ≥ 9 sem falha) · **vídeo de reserva** gravado · deploy testado em URL pública ou plano B local.

### R7 · Submissão · 11h30 → 12h30
Entregáveis 01 a 06 conferidos, evidências anexadas, **envio por um humano**, comprovante guardado.

## 4. Pontos de controle e plano B

| Gate | Quando | Passou se | Plano B |
|---|---|---|---|
| **G1** | 21h | Verticais sondadas com dados reais | Restaurante e mercado reais; shopping simulado e rotulado |
| **G2** | 21h30 | K-1, K-3, K-5 publicados | Domínio fake com as mesmas assinaturas |
| **G3** | 00h30 | Texto ponta a ponta, simulado, com aprovação | Cortar extras; focar em fechar o fluxo |
| **G4** | 03h | Voz com dado real | Demo com simulados rotulados; integração real mostrada à parte |
| **G5** | 09h | Congelamento | Qualquer item aberto sai da demo |

## 5. Entregáveis do evento

| ENT | Dono | Rascunho | Final |
|---|---|---|---|
| 01 Proposta de negócio | Felipe | 05h | 11h |
| 02 Desenho da solução | Hyago | 05h | 11h |
| 03 Racional da experiência | Malveste | 06h | 11h |
| 04 Interface visual | Malveste | 08h | 11h |
| 05 Documento técnico | Kenzo | 06h | 11h |
| 06 Feedback do MCP | Kenzo (todos contribuem) | anotado **durante** a obra | 11h |
| Pitch e demo | Felipe | 07h | 11h30 |

## 6. Aceite da demo

| ID | Verificação |
|---|---|
| D-1 | A ocasião vira ≥ 2 necessidades em verticais diferentes, com 3 opções e motivos reais |
| D-2 | Uma mudança falada gera nova versão do plano e invalida a aprovação anterior |
| D-3 | **Nenhum** pedido é submetido pelo Guide; a continuidade é no iFood |
| D-4 | Pedido rápido chega à proposta em um turno; caso vago respeita o teto de 3 perguntas |
| D-5 | Interrupção por voz e queda para texto funcionam |
| D-6 | Eventos de feedback são gravados e o painel os mostra, rotulados |
| D-7 | Alergia e teto rígido nunca são relaxados sozinhos |
| D-8 | 10 execuções seguidas do roteiro: ≥ 9 sem falha |

## 7. Dependências críticas
- **K-1 + M-1** → a aprovação aparece na demo (hoje é inalcançável).
- **K-5 + K-3** → o orquestrador troca o domínio fake pelo real.
- **Chave de LLM** → evals reais e o adaptador de produção.
- **`/api/converse` (Hyago)** → a voz integra por ele; até lá, a voz roda com respostas fixas.

## 8. Ritmo de trabalho
- **Sincronização de 5 minutos:** 21h30, 23h30, 00h30, 02h, 03h, 07h, 09h, 10h30, 11h30.
- **Um card por PR**, PR pequeno, `typecheck && lint && test && build` antes de abrir.
- **Contrato mudou?** Avisar os consumidores **antes** de mexer no código.
- Travou mais de 45 minutos: avisar e **cortar escopo**.

## 9. Ordem de corte (se o tempo apertar)
1. Memória persistente → 2. Painel de insights → 3. Reconhecimento em tempo real e palavras-chave → 4. 3ª vertical → 5. Voz (a demo segue em **texto**, e a voz vira vídeo de reserva) → nunca: **aprovação segura, rótulos real × simulado, ponta a ponta de texto**.

## 10. Decisões pendentes
1. **D-015:** ElevenLabs só como voz por API; cérebro por código (esta proposta).
2. **Provedor de LLM e chave** (bloqueia os evals reais).
3. **Aceite de D-011, D-012 e D-013** pelo Kenzo.
4. **Endereço e cidade da demo** para a sondagem.
5. **Revezamento do sono** entre 03h e 07h.
