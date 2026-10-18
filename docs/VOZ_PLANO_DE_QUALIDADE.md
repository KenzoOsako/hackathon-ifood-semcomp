# Guide — Voz: plano de qualidade ("a voz tem que funcionar perfeitamente")

> Dono: **Felipe (Conversação e Voz)**. 17/10/2026. Foco único desta frente: **a voz funcionar de ponta a ponta, em todos os aspectos**. Cada aspecto tem um critério de "perfeito", uma forma de **verificar** e um estado honesto. Estados: ✅ verificado · 🟡 implementado, falta verificar · 🔴 falta fazer · ⚠️ depende de teste humano. Complementa `docs/ROADMAP.md` e `docs/AGENTE_CONVERSA_E_FLUXO.md`.

## 1. Papel da ElevenLabs e do backend (alinhado)
A ElevenLabs só leva o áudio (voz → texto, texto → voz). **O motor é o backend**: contexto, MCP, análise e o que falar. A voz recebe a resposta **em pedaços** e a fala flui sem pausa. O agente do painel da ElevenLabs é **laboratório e plano B**, e precisa estar configurado com segurança (seção 4).

## 2. Matriz de qualidade

| # | Aspecto | "Perfeito" significa | Como verificar | Estado |
|---|---|---|---|---|
| 1 | **Entender o que a pessoa diz** | Nomes de lojas e itens reconhecidos; erro baixo em português do Brasil | Bateria de frases em várias vozes (`scripts/voice-eval.mjs`) + palavras-chave | ✅ (voz sintética) ⚠️ (voz real) |
| 2 | **Vocabulário do contexto** | O reconhecimento é ajudado pelo que está na tela (lojas, itens, opções) | Teste com e sem palavras-chave (erro 3,3% → 1,9%); palavras da tela enviadas a cada fala | ✅ |
| 3 | **Falar natural e claro** | Voz brasileira agradável, sem tags faladas, valores por extenso, nomes certos | Escuta humana de amostras + testes de texto falado | ⚠️ |
| 4 | **Pronúncia** ("Guide", "iFood", nomes de lojas) | Soa certo para ouvido brasileiro | Escuta humana; mapa de pronúncia | ⚠️ |
| 5 | **Latência (sem pausa chata)** | 1ª palavra do Guide ≤ 1,8 s; backend ≤ 700 ms | `LatencyTrace` em cada turno; medida em `/voz` | 🟡 |
| 6 | **Fluidez da conversa** | Fala em pedaços, sem silêncio entre eles, entonação contínua | Player com fila e busca antecipada; testes | ✅ (lógica) ⚠️ (ouvido) |
| 7 | **Interrupção** | Falar por cima corta o Guide na hora e processa a nova fala | Player e sessão testados com peças falsas (voz sustentada interrompe, estalo não); precisa de microfone real | 🟡 ⚠️ |
| 8 | **Fim de fala automático** | Para de gravar sozinho após um silêncio; sem cortar a pessoa no meio | Detector com testes (fala curta 900 ms, normal 1,3 s, pausa curta não corta); teste humano para ajustar os tempos | 🟡 ⚠️ |
| 9 | **Eco** (o Guide se ouvir) | O microfone não confunde a voz do Guide com a da pessoa | Teste humano com caixa de som e com fone | ⚠️ |
| 10 | **Falhas** | Microfone negado, sem rede, provedor fora, 429, áudio vazio: sempre há um caminho em texto | Testes de rota e de player | ✅ |
| 11 | **Segurança e abuso** | Ninguém gasta nossos créditos; chave nunca no navegador; dado sensível mascarado | Limite por visitante, limite global, guardas; testes | ✅ (1 processo) |
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
- [x] **Segurança → Autenticação**: ligada (hoje o agente é público: qualquer pessoa com o ID usa nossos créditos).
- [x] **Segurança → Allowlist de hosts** (domínio de fachada `guide.invalid`: o painel não aceita `localhost`; a autenticação é a proteção real): só os domínios da demo.
- [x] **Avançado → Duração máxima da conversa** (180 s) e **tempo de silêncio** (20 s) (evita conversa aberta gastando minutos).
- [~] **Voz**: Amanda Kelly (em uso; falta a audição comparativa) (ou a escolhida por escuta), **Expressive mode desligado**, estabilidade ~65–70%.
- [x] **Idioma**: Português (Brasil).
- [x] **Reconhecimento (ASR)** (20 palavras-chave cadastradas; o limite é 20 caracteres por palavra): conferir provedor e se há **palavras-chave**; cadastrar lojas e itens.
- [x] **Retenção de dados** (7 dias, áudio não armazenado, Zero Retention desligado de propósito para poder depurar): o mínimo possível; **não guardar áudio** se a opção existir (LGPD).
- [x] **Overrides (aba Segurança)**: todos desligados, inclusive *Text only* (17/10, conferido na tela e publicado). Ninguém que conecta troca prompt, LLM, voz, tools ou base de conhecimento.
- [ ] **Guardrails**: ligar o que houver (injeção de prompt, conteúdo) e anotar o que cada opção faz.
- [~] **Análise / webhooks / integrações**: no workspace não há webhook, secret nem conexão de autenticação cadastrados (conferido em 17/10); falta conferir as abas Analysis e Tools do agente.
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

### Rodada 3 · conversa sem as mãos (fim de fala, interrupção, espera da resposta)
Lógica separada do React em `src/voice/session.ts` (máquina de estados) e `endpoint.ts` (detectores), testada com **microfone, gravador, relógio e player falsos** (20 cenários): fluxo manual; para sozinho no silêncio; fala curta termina mais rápido; pausa curta no meio da frase não corta; estalo não vira fala; voz sustentada por cima do Guide interrompe e marca a interrupção; estalo durante a fala do Guide não interrompe; ninguém fala (3 tentativas e desliga); `429` pausa o modo sem laço; desligar libera o microfone; destruir para tudo.

**Defeito de desenho achado pelos testes e corrigido:** no modo sem as mãos o microfone **reabria assim que a fala era entregue, enquanto o agente ainda pensava**. Agora ele só reabre depois que o Guide termina de falar (mais uma folga de 0,5 s contra eco), quando a resposta termina sem fala (`turnDone`) ou após 15 s sem resposta.

**NÃO verificado (precisa de teste humano em Chrome com microfone):** os tempos de silêncio (900 ms e 1,3 s) e os níveis de voz (0,02 para fala, 0,06 para interromper) são **pontos de partida**; o eco com caixa de som; o comportamento com ruído de fundo; microfones de fone e de notebook. O código que liga o navegador (`browser-deps.ts`) só foi verificado por tipo, lint e build.

### Rodada 4 · "não reconhece mesmo falando alto" (teste humano, 17/10)
**Causa provável (defeito meu):** o medidor local usava um limite **fixo** de volume (0,02) para decidir se "alguém falou", e **não enviava o áudio** ao reconhecimento quando achava que não. Microfones de notebook ficam abaixo disso mesmo com a pessoa falando alto.
**Correções:** (1) no modo **manual o áudio sempre vai** ao reconhecimento; quem decide se há fala é ele; (2) **limite adaptativo** pelo ruído de fundo (percentil 20 dos últimos ~3 s, de 0,006 a 0,04; para interromper, de 0,03 a 0,12); (3) o contexto de áudio do navegador é **retomado** se nascer suspenso (suspenso, o medidor devolve zero); (4) **painel de diagnóstico** em `/voz`: nível agora, ruído de fundo, limite, tamanho do áudio, formato, se o medidor ouviu fala e o status HTTP do reconhecimento. Cobertos por testes (microfone fraco a 0,012, sala barulhenta a 0,015 com voz a 0,08).
**Ainda não confirmado:** que essa era a causa no seu computador. O painel de diagnóstico serve para confirmar (ou apontar outra causa) com um teste de 30 segundos.
