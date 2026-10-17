# Guide — Arquitetura do agente: conversa, fluxo e dados

> **Proposta de contrato entre Felipe (Conversação e Voz), Hyago (Prompt e Fluxo de Agentes) e Kenzo (Request e Dados).** 17/10/2026, ~21h30. Nasceu dos primeiros testes de conversa no ElevenLabs. Marcações: **[DECIDIR]** precisa de resposta; **[VERIFICAR]** depende de teste. Complementa `docs/frentes.md` e `docs/PLANO_V2_PAPEIS_E_CRONOGRAMA.md`.

## 1. O que os primeiros testes mostraram

| # | Observação (teste de voz, agente só com prompt) | Causa | Onde se resolve |
|---|---|---|---|
| 1 | Depois de "Posso montar o plano?", o usuário disse "tanto faz, só faz isso logo" e o agente **repetiu a proposta e perguntou de novo** | Não existe estado "avançar quando o usuário consente" | Fluxo (Hyago) |
| 2 | Perguntou "comer no local ou entrega?" | Fora do escopo e gasta pergunta | Fluxo (Hyago) |
| 3 | Transcrição errou ("espíritas" em vez de "espetinho") e o agente **fingiu que entendeu** | Sem regra de incerteza de reconhecimento | Fluxo (Hyago) + sinal de confiança (Felipe) |
| 4 | "[happy]" e "[calm]" aparecem no texto | Expressive mode ligado | Voz (Felipe) |
| 5 | Voz muito doce e teatral; o desejado é "assistente receptiva e objetiva, mais fina" | Voz e configuração | Voz (Felipe) |
| 6 | Ritmo rápido funcionou: pedido específico → proposta em um turno | Regra L0 do prompt | Mantém |
| 7 | **"Escola Cucurbita"** era provavelmente "escolhe a calabresa". O agente não fingiu entender (bom), mas fez pergunta **aberta** e recomeçou a oferta, em vez de confirmar a hipótese mais provável ("Foi a calabresa?") | Sem uso do contexto como prior; sem hipóteses alternativas do reconhecimento | Fluxo (Hyago) + Voz (Felipe) |
| 8 | Enrolação: "Pizza é sempre uma ótima escolha", "Ah, desculpa" | Prompt sem regra de objetividade | Fluxo (Hyago) |
| 9 | Dois erros de reconhecimento nos primeiros testes ("espíritas", "Escola Cucurbita") | **O usuário disse errado**; quando fala normalmente, o agente entende. Fica como **risco a monitorar**, não como bloqueio | Voz (Felipe); ver seção 7.1 |

**Conclusão:** o prompt isolado não sustenta o produto. O agente precisa de um **fluxo com estados e regras de transição**, de **ferramentas** com contrato e de uma **camada de voz** sem lógica de negócio.

## 2. Três camadas e seus limites

```
 Felipe                      Hyago                          Kenzo
┌──────────┐  eventos    ┌──────────────────┐  ferramentas  ┌───────────────────┐
│  VOZ     │───────────▶│ CONVERSA E FLUXO │──────────────▶│ DOMÍNIO E REQUEST │
│ ouve/fala│◀───────────│ estados, prompts │◀──────────────│ MCP, ranking, plano│
└──────────┘  fala/tela  └──────────────────┘   snapshots   └───────────────────┘
```

| Camada | Dono | É responsável por | **Não pode** |
|---|---|---|---|
| **Voz** | Felipe | Reconhecimento e síntese de fala, turnos, interrupção, latência, persona vocal, guia de estilo de fala, normalização do texto falado, sinais (velocidade, silêncio, interrupção, confiança do reconhecimento), queda para texto | Decidir recomendação, inventar conteúdo, aprovar nada, chamar o MCP |
| **Conversa e fluxo** | Hyago | Máquina de estados, prompts por estado, classificação L0/L1/L2, extração de ocasião e necessidades (JSON validado), política de perguntas, detecção de consentimento, anti-repetição, tratamento de incerteza, verbalização do plano a partir de `reasons[]`, fora de escopo, avaliações | Calcular preço, total, frete ou ranking; chamar função de compra; relaxar filtro rígido; aprovar plano |
| **Domínio e request** | Kenzo | Ferramentas que o agente pode chamar, dados reais ou simulados, ranking e `reasons[]`, plano versionado, aprovação, eventos, segurança | Conduzir a conversa ou decidir o tom |

**Regra de ouro:** *tudo o que o agente diz de número, preço, nota, prazo ou promoção vem de um campo devolvido por uma ferramenta; tudo o que ele faz além de falar passa por uma ferramenta do domínio.* O texto falado é a soma de (a) frases de fluxo do Hyago e (b) fatos do domínio.

## 3. O fluxo da conversa (máquina de estados)

| Estado | O que acontece | Sai quando |
|---|---|---|
| **S0 Abertura** | Saudação fixa e curta: "Oi! Eu sou o Guide! Em que posso te ajudar hoje?" | O usuário fala |
| **S1 Entender** | Classifica o ritmo (L0/L1/L2) e extrai ocasião, necessidades, quantidade, orçamento, restrições. Reconhecimento incerto → **confirmação curta** ("Foi espetinho que você disse?") | Pedido entendido, ou precisa de pergunta |
| **S2 Perguntar** | Uma pergunta por vez, só se a resposta muda a recomendação; sempre com "ou escolho por você". **Teto: 3 perguntas por sessão** (confirmar reconhecimento não conta) | Dado suficiente, teto atingido, pressa ou consentimento |
| **S3 Propor** | Chama as ferramentas, recebe opções com motivos, fala até 3 pontos e deixa o resto na tela | O usuário reage |
| **S4 Ajustar** | Pedidos de mudança viram `ajustarPlano` (nova versão); o agente fala **só a diferença** | O usuário concorda ou muda de novo |
| **S5 Encaminhar** | **Uma vez**: "O plano está na sua tela. É só revisar e aprovar; a compra termina no iFood." Sem repetir a proposta | O usuário continua ou encerra |
| **S6 Feedback** | Opcional, **no máximo uma pergunta leve**, só se houve rejeição ou fim natural | Resposta ou recusa |
| **S7 Encerrar** | Oferece ajuda extra uma vez | Fim |

**Transições especiais (valem em qualquer estado)**
- **Interrupção:** a fala do agente é cortada e a nova fala é processada no estado atual, sem reiniciar.
- **Fora de escopo** (bebida alcoólica, remédio, conselho médico, outros apps): recusar com educação e voltar ao estado anterior.
- **Erro de ferramenta:** uma frase curta ("Não consegui buscar agora"), oferecer alternativa, nunca inventar dado.
- **Silêncio longo:** "Ainda está aí?" **uma vez**; depois aguarda.
- **Anti-repetição:** nunca repetir a mesma proposta duas vezes seguidas.

### Três "sins" que não podem se confundir
| O usuário diz | Significa | Quem trata |
|---|---|---|
| "Pode", "faz", "tanto faz, só faz isso logo" | **Consentimento para montar o plano** → ir a S5 | Fluxo (Hyago) |
| "Aprovo o plano" (na tela, ou por voz com a frase exigida) | **Aprovação da versão do plano** | Domínio (Kenzo), nunca o modelo |
| (fora do Guide) | **Finalizar a compra no iFood** | iFood |

O agente **nunca** diz que o pedido foi feito.

### Ritmos (resumo; detalhes em `src/voice/agent-prompt.md`)
- **L0 Rápido:** pedido específico, "o de sempre", pressa → zero perguntas, proposta no primeiro turno.
- **L1 Padrão:** uma pergunta que muda o resultado.
- **L2 Guiado:** ocasião ou pedido vago → até 3 perguntas, uma por vez.
- **Rebaixar** o nível quando houver sinais de pressa; **nunca subir** sem o usuário pedir.

## 4. Contratos entre as camadas

### 4.1 Voz → Fluxo (Felipe → Hyago)
Entrada do fluxo por turno:
```jsonc
{
  "sessionId": "cookie opaco (não vem do cliente)",
  "texto": "…",
  "origem": "voz|texto",
  "sinais": { "velocidadeFala": 2.8, "silencioMs": 400, "interrompeu": false, "palavras": 7,
              "confiancaReconhecimento": 0.62 },  // [VERIFICAR] se o provedor entrega
  "hipoteses": ["escola cucurbita", "escolhe a calabresa"]  // alternativas do reconhecimento, da mais à menos provável
}
```
**Por que `hipoteses`:** a Web Speech API do navegador devolve alternativas e confiança por frase. Com elas, o fluxo escolhe a interpretação que combina com o **contexto** (as opções que acabou de propor). Se o reconhecimento rodar só dentro da plataforma da ElevenLabs, recebemos apenas o texto final `[VERIFICAR]`.
Saída para a voz (em fluxo): `resposta_parcial`, `evento_de_tela`, `resposta_final`. A voz fala `resposta_*` e **não interpreta** o conteúdo. Já implementado no esqueleto de voz: `src/voice/signals.ts`.

### 4.2 Fluxo → Domínio (Hyago → Kenzo): as ferramentas
O agente só conhece estas ferramentas. **Nenhuma delas compra, aprova ou paga.**

| Ferramenta | Entrada | Saída |
|---|---|---|
| `obterContexto` | sessão | endereço atual, histórico (se autorizado), restrições salvas, **origem real ou simulada** |
| `buscarNecessidade` | vertical, categoria, restrições, orçamento, quantidade | até 3 opções com `reasons[]`, pendências, origem |
| `montarPlano` | ocasião + escolhas | **snapshot do plano** (id, versão, necessidades, totais conhecidos ou ausentes, pendências) |
| `ajustarPlano` | plano, versão, ajuste | snapshot da versão seguinte |
| `registrarEvento` | evento de feedback | confirmação |

**Não existe `aprovarPlano` para o agente.** A aprovação é do usuário (tela ou frase explícita), validada pelo backend.

### 4.3 Fluxo → Tela (Hyago → Malveste)
Eventos de tela (`mostrar_plano`, `destacar_opção`, `plano_atualizado`, `aguardando_aprovação`), todos com o **snapshot** do domínio. A tela não recalcula nada.

## 5. Guia de estilo de fala (dono: Felipe)

A fonte única do "como soa". O Hyago a copia para os prompts; mudanças passam pelo Felipe.

- **Persona:** assistente pessoal, **receptiva e objetiva**. Sorri na voz, vai direto ao ponto, ritmo ágil.
- **Frases:** no máximo duas por vez, até ~18 palavras cada. Uma ideia por resposta.
- **Palavras:** português do Brasil, sem gíria forte ("bora"), sem exclamação em excesso, sem "né" e "tipo".
- **Números:** por extenso e naturais ("trinta e nove e noventa", "trinta e cinco minutos").
- **Listas:** nunca em voz; até 2 ou 3 opções faladas, o resto na tela.
- **Proibido no texto falado:** markdown, símbolos, emojis, colchetes e tags de áudio.
- **Configuração da voz (ElevenLabs):** modelo V4 Turbo; **Expressive mode desligado**; estabilidade ~65–70%; voz brasileira feminina mais leve a escolher por teste lado a lado (candidatas: Pri, Fabi, Marcia; a Amanda Kelly está em uso).
- **Normalização:** `src/voice/speech-text.ts` converte valores e unidades e corta o texto falado em fronteira de frase.

## 6. Casos de teste de conversa (aceite)

Rodar com o agente de prompt (ElevenLabs Preview) agora e, depois, contra o fluxo real.

| ID | Cenário | Esperado | Hoje |
|---|---|---|---|
| C1 | "Pizza calabresa grande, pede logo." | Zero perguntas; proposta em um turno | ✅ |
| C2 | Após a proposta: "tanto faz, só faz isso logo" | **Avança**: "O plano está na sua tela…". Sem repetir | ❌ |
| C3 | Reconhecimento duvidoso ("espíritas") | Confirma em poucas palavras | ❌ |
| C11 | Depois de uma proposta, fala curta e estranha ("Escola Cucurbita") | Trata como **escolha entre as opções ditas** e confirma sim/não: "Foi a calabresa?" | ⚠️ pergunta aberta |
| C12 | Sem elogio nem pedido de desculpa em excesso | Vai direto à próxima ação | ⚠️ |
| C4 | Nunca perguntar "no local ou entrega?" | Assume entrega | ❌ |
| C5 | Nenhum colchete ou tag no texto | Texto limpo | ❌ |
| C6 | "Aniversário de um amigo, pizza e filme" | No máximo 2 perguntas; plano com 3 blocos | a testar |
| C7 | Interrupção no meio do plano | Corta e ajusta só a diferença | a testar |
| C8 | "Cerveja pra festa" | Recusa com educação | a testar |
| C9 | Silêncio longo | "Ainda está aí?" uma vez | a testar |
| C10 | Item que não existe nos dados | Diz que não tem e oferece o mais próximo | a testar |

## 7. Onde roda o cérebro do agente `[DECIDIR]`

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **A. Agente do ElevenLabs com ferramentas** | O modelo roda na plataforma e chama nossas ferramentas por webhook | Mais rápido de montar; voz e interrupção prontas | A lógica fica dividida entre a plataforma e o código; difícil provar as regras |
| **B. Só STT e TTS** | O nosso orquestrador roda tudo; a ElevenLabs só fala e ouve | Controle total das regras e dos eventos | Mais trabalho: turnos e interrupção são nossos |
| **C. ElevenLabs (voz) + nosso cérebro como "LLM personalizado"** | A plataforma cuida da voz e dos turnos; as respostas vêm do endpoint do Hyago | Voz natural **e** regras no nosso código | Exige endpoint público (túnel) e compatibilidade de formato `[VERIFICAR]` |

**Reconhecimento de fala (achado 9):** quem controla o reconhecimento controla as **hipóteses alternativas**, o vocabulário esperado e a confiança. Isso é uma vantagem de **B** (ou do modo híbrido: reconhecimento nosso, voz e turnos da ElevenLabs); em **A** e **C**, a plataforma reconhece sozinha. **[VERIFICAR]** na aba Advanced do agente se existe opção de reconhecimento com palavras-chave.

### 7.1 ElevenLabs como TTS e STT na nossa demo (testado em 17/10/2026, ~22h)
Com a chave do time (permissões TTS e STT), pela API:
- **TTS:** funciona; primeiro byte em ~250–530 ms e fala completa em ~350–620 ms para frases curtas (modelo `eleven_flash_v2_5`, voz brasileira da conta, saída mp3).
- **STT em lote (`scribe_v1` e `scribe_v2`):** funciona em português (`language_code: por`), ~380–550 ms para 2 a 3 s de áudio. Teste de ida e volta (TTS → STT) acertou "Forno e Cia" e "espetinho". **Limite do teste:** áudio sintético limpo; não prova ruído de sala nem sotaques.
- **STT em tempo real (Scribe v2 Realtime):** segundo a documentação da ElevenLabs, usa WebSocket, entrega transcrição parcial enquanto o usuário fala e confirmada ao fim do trecho, com ~150 ms de latência (sem rede), aceita **palavras-chave** (até 50 no tempo real, 20 caracteres cada) e controle de fim de fala. **Não testei** o tempo real nem o suporte a palavras-chave em português.
- **Conclusão:** dá para operar a demo **só com a ElevenLabs** (voz e reconhecimento). Para conversa fluida, o reconhecimento deve ser o **tempo real**; o lote serve para "segurar para falar". Em qualquer caso a Web Speech API do Chrome continua como reserva gratuita.

**Recomendação:** começar com **reconhecimento em lote + TTS** (já testado, simples, fala curta) para fechar o ciclo da demo; trocar para o **tempo real** na frente de voz quando o fluxo do Hyago estiver estável, e usar as palavras-chave para os nomes de lojas e itens.

**Recomendação:** **C**, com **A** como reserva (já funciona no Preview) e **B** como reserva final. O teste de viabilidade do C é pequeno: um endpoint de eco compatível, ligado ao agente. Se falhar em 1 hora, seguimos com A.

## 8. Quem decide o quê

| Decisão | Dono | Quem precisa ser avisado |
|---|---|---|
| Tom, persona, voz, normalização | Felipe | Hyago |
| Estados, prompts, perguntas, consentimento | Hyago | Felipe, Kenzo |
| Ferramentas, esquemas, dados, aprovação | Kenzo | Hyago, Malveste |
| Mudar um contrato (4.1, 4.2, 4.3) | Quem fornece, **avisando antes** os consumidores | Todos |
| Aceitar a V2 e as regras críticas | Kenzo (integrador) | Todos |

## 9. Próxima hora, por pessoa
- **Felipe:** fechar a persona vocal (voz, Expressive off, estabilidade), rodar C1–C10 no Preview, e testar a viabilidade do C (endpoint de eco).
- **Hyago:** transformar a seção 3 em máquina de estados em código (função pura com testes), com prompts por estado e a detecção de consentimento.
- **Kenzo:** publicar os esquemas das ferramentas da seção 4.2 com dados simulados dos três cenários (restaurante, mercado, presente) e o K-1 (custo confirmado no mock).
