# Guide — Voz: plano de qualidade ("a voz tem que funcionar perfeitamente")

> Dono: **Felipe (Conversação e Voz)**. 17/10/2026. Foco único desta frente: **a voz funcionar de ponta a ponta, em todos os aspectos**. Cada aspecto tem um critério de "perfeito", uma forma de **verificar** e um estado honesto. Estados: ✅ verificado · 🟡 implementado, falta verificar · 🔴 falta fazer · ⚠️ depende de teste humano. Complementa `docs/ROADMAP.md` e `docs/AGENTE_CONVERSA_E_FLUXO.md`.

## 1. Papel da ElevenLabs e do backend (alinhado)
A ElevenLabs só leva o áudio (voz → texto, texto → voz). **O motor é o backend**: contexto, MCP, análise e o que falar. A voz recebe a resposta **em pedaços** e a fala flui sem pausa. O agente do painel da ElevenLabs é **laboratório e plano B**, e precisa estar configurado com segurança (seção 4).

## 2. Matriz de qualidade

| # | Aspecto | "Perfeito" significa | Como verificar | Estado |
|---|---|---|---|---|
| 1 | **Entender o que a pessoa diz** | Nomes de lojas e itens reconhecidos; erro baixo em português do Brasil | Bateria de frases em várias vozes (`scripts/voice-eval.mjs`) + palavras-chave | 🟡 |
| 2 | **Vocabulário do contexto** | O reconhecimento é ajudado pelo que está na tela (lojas, itens, opções) | Teste com e sem palavras-chave; palavras dinâmicas por sessão | 🟡 |
| 3 | **Falar natural e claro** | Voz brasileira agradável, sem tags faladas, valores por extenso, nomes certos | Escuta humana de amostras + testes de texto falado | ⚠️ |
| 4 | **Pronúncia** ("Guide", "iFood", nomes de lojas) | Soa certo para ouvido brasileiro | Escuta humana; mapa de pronúncia | ⚠️ |
| 5 | **Latência (sem pausa chata)** | 1ª palavra do Guide ≤ 1,8 s; backend ≤ 700 ms | `LatencyTrace` em cada turno; medida em `/voz` | 🟡 |
| 6 | **Fluidez da conversa** | Fala em pedaços, sem silêncio entre eles, entonação contínua | Player com fila e busca antecipada; testes | ✅ (lógica) ⚠️ (ouvido) |
| 7 | **Interrupção** | Falar por cima corta o Guide na hora e processa a nova fala | Player testado; precisa de microfone real | 🟡 ⚠️ |
| 8 | **Fim de fala automático** | Para de gravar sozinho após um silêncio; sem cortar a pessoa no meio | Detector de fim de fala com testes; teste humano | 🔴 |
| 9 | **Eco** (o Guide se ouvir) | O microfone não confunde a voz do Guide com a da pessoa | Teste humano com caixa de som e com fone | ⚠️ |
| 10 | **Falhas** | Microfone negado, sem rede, provedor fora, 429, áudio vazio: sempre há um caminho em texto | Testes de rota e de player | ✅ |
| 11 | **Segurança e abuso** | Ninguém gasta nossos créditos; chave nunca no navegador; dado sensível mascarado | Limite por visitante, limite global, guardas; testes | 🟡 |
| 12 | **Configuração do painel ElevenLabs** | Agente protegido (autenticação, hosts), retenção mínima, voz e idioma certos | Checklist da seção 4 | 🔴 |
| 13 | **Privacidade** | Sem gravar áudio por padrão; texto sem CPF/cartão; consentimento claro | Guardas + painel + aviso na tela | 🟡 |
| 14 | **Acessibilidade** | Funciona por teclado e leitor de tela; legendas sempre; texto equivalente | Revisão com a interface final | 🟡 |
| 15 | **Custo** | Limites por pessoa e global; nada em laço | Medidores de TTS e STT | ✅ |

## 3. Ordem de trabalho (cada item termina com prova)
1. **Medir o reconhecimento** em português com o nosso vocabulário (bateria de frases, várias vozes), com e sem palavras-chave.
2. **Palavras-chave no reconhecimento** (fixas e por sessão, vindas das opções na tela).
3. **Segurança e abuso**: limite por visitante e global nas rotas de voz.
4. **Pronúncia e voz**: mapa de pronúncia e uma página para **ouvir** as vozes candidatas com as mesmas frases.
5. **Fim de fala automático** e conversa sem as mãos, com interrupção por voz.
6. **Painel da ElevenLabs** configurado com segurança (checklist).
7. **Teste humano completo** (roteiro na seção 5).

## 4. Checklist do painel da ElevenLabs (agente de laboratório / plano B)
Marcar só depois de conferir na tela.
- [ ] **Segurança → Autenticação**: ligada (hoje o agente é público: qualquer pessoa com o ID usa nossos créditos).
- [ ] **Segurança → Allowlist de hosts**: só os domínios da demo.
- [ ] **Avançado → Duração máxima da conversa** e **tempo de silêncio** curtos (evita conversa aberta gastando minutos).
- [ ] **Voz**: Amanda Kelly (ou a escolhida por escuta), **Expressive mode desligado**, estabilidade ~65–70%.
- [ ] **Idioma**: Português (Brasil).
- [ ] **Reconhecimento (ASR)**: conferir provedor e se há **palavras-chave**; cadastrar lojas e itens.
- [ ] **Retenção de dados**: o mínimo possível; **não guardar áudio** se a opção existir (LGPD).
- [ ] **Guardrails**: ligar o que houver (injeção de prompt, conteúdo) e anotar o que cada opção faz.
- [ ] **Análise / webhooks / integrações**: desligados.
- [ ] **Chave de API**: permissões mínimas, limite de créditos, validade curta; **rotacionar** ao fim do evento.

## 5. Roteiro de teste humano (Chrome, microfone real)
1. Abrir `/voz`. **Falar** "quero uma pizza calabresa grande" → texto correto?
2. Falar **baixo**, **rápido** e **com ruído de fundo** → o que muda?
3. Dizer um nome de loja: "Forno e Cia", "Pizzaria Nonna", "Mercado do Bairro".
4. Dizer um **CPF** → deve aparecer "[dado removido]".
5. **Interromper** o Guide no meio da fala.
6. Falar com **fone** e com **caixa de som**: o Guide se ouve?
7. Bloquear o microfone → mensagem clara e texto funcionando.
8. Desligar a internet no meio → queda para texto sem travar.
9. Ouvir 3 vozes candidatas e escolher a do Guide.
10. Fazer uma conversa de 5 turnos sem tocar no mouse (quando o modo sem as mãos existir).

## 6. Estado atual das provas
Atualizado a cada rodada abaixo.

### Rodada 1 · reconhecimento com o nosso vocabulário (17/10)
Bateria `scripts/voice-eval.mjs`: **28 frases do produto × 4 vozes brasileiras** (1 feminina, 3 masculinas) = 112 falas, modelo `scribe_v2`, **com e sem palavras-chave**. Recálculo justo (números em dígitos e contrações coloquiais não contam como erro): `scripts/voice-eval-adjusted.mjs`.

| Medida | Sem palavras-chave | Com palavras-chave |
|---|---|---|
| Erro por palavra (estrito) | 6,1% | **4,3%** |
| Erro por palavra (ajustado) | 3,3% | **1,9%** |
| Acerto das palavras do domínio (lojas, itens) | 89,1% | **96,8%** |
| Frases 100% certas (ajustado) | 92 de 112 | **104 de 112** |

**O que a bateria revelou e já foi corrigido:**
1. **Uma fala saiu vazia só com palavras-chave** (a mesma fala saiu certa sem elas). Agora, resposta vazia com palavras-chave tem **uma nova tentativa sem elas**.
2. **"Aprovo" foi reconhecido como "Aprova" em todas as 4 vozes.** O detector de aprovação só entendia "aprovo"; agora aceita as variantes (e continua exigindo plano, proposta ou versão, e confirmação explícita).
3. O reconhecimento escreve **"R$ 100"** para "cem reais" e **"pras"** para "para as": o backend precisa tratar números em dígitos e fala coloquial.
4. Pequenas variações de verbo ("Escolha" em vez de "Escolhe") e hesitações ("por, por mim"): o fluxo do agente deve ser tolerante.

**Limites desta prova:** a voz sintética é limpa e uniforme. **Não mede ruído de sala, sotaques reais, fala baixa ou rápida.** Serve para comparar configurações; a prova final é o roteiro humano (seção 5).

### Rodada 2 · segurança e abuso
Limite por visitante (cookie anônimo `guide_voice`, HttpOnly, SameSite=Strict) e global; teto de identidades novas por minuto (limpar o cookie não dá cota nova); limite de caracteres de síntese; `429` com `Retry-After`; a tela cai para texto. **Verificado por testes** (143 no total). **Não coberto:** várias instâncias do servidor (os contadores são por processo) e abuso por IP; antes de publicar, trocar por armazenamento compartilhado e limitar por IP no provedor de hospedagem.
