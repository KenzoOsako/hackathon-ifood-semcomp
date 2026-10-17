> **OBSOLETO como orientação de produto em 17/10/2026.** Rascunho histórico preservado. A [proposta final aprovada](PROPOSTA_DE_NEGOCIO_FOODPILOT.md) o substitui. Metas numéricas, checkout interno, modelo fixo e atribuições abaixo não devem ser usados como decisões atuais. Consulte a [auditoria](AUDITORIA-ALINHAMENTO-2026-10-17.md).

# FoodPilot — Produto V1 (rascunho para decisão do time)

> Nome provisório. Status: **rascunho de 17/10/2026, ~15h**. Cruza a ideia do grupo com `docs/mcp-ifood-referencia.md` (guia do Kenzo, baseado na documentação, **ainda não validado com `tools/list` real**). Pontos marcados `[DECIDIR]` e `[VERIFICAR]` precisam de resposta antes de virar código. Regras de negócio só entram em `contexto/regras-de-negocio.md` por PR humano.

## 1. Resumo executivo

**O que é:** um copiloto de voz dentro do app que, ao abrir, já sabe quem você é (rotina, endereço, gostos) e resolve o pedido conversando: você fala, ele propõe 3 opções **com o motivo de cada uma**, você ajusta por voz e confirma. Meta: o usuário **não pensa, não procura, não clica**.

**Por que pode ganhar:** combina os 5 pilares da banca com uma tese própria: *voz + personalização + recomendação explicada, tudo executando de verdade no MCP do iFood*. Voz sozinha é commodity; o diferencial é **explicar a recomendação com dados reais** e **agir com segurança**.

**Principais achados do cruzamento com o MCP:**
1. **Dá para fazer o fio completo** (endereço → recomendação → carrinho → pedido → rastreio) com as 24 tools documentadas.
2. **Alguns rótulos que imaginamos não têm dado**: "muito pedido nos últimos meses", "restaurante novo" e "gourmet" **não aparecem** no MCP documentado. Precisam virar rótulos honestos (seção 3).
3. **O MCP é bom para personalização do usuário** (`RECENT_ORDERS`, favoritos, melhores ofertas, rotina por dia e turno em `listAddresses`, descrição comportamental em `getUser`), mas **a memória entre conversas é nossa**.
4. **No sandbox o histórico é vazio.** Solução: gerar histórico com pedidos de teste reais antes da demo.
5. **Dois riscos de plataforma:** (a) o app precisa ser o **cliente MCP com OAuth** (não só o Claude Code), então o **redirect URL deve ser decidido pelo runtime final**; (b) os termos restringem **compartilhar credenciais** entre os 4 — confirmar com a organização.

## 2. O produto

### 2.1 Princípio
> O usuário entra com fome e sai com o pedido feito. O agente faz as perguntas (no máximo **uma** de esclarecimento por pedido), não o usuário.

### 2.2 Entrada
Bolha flutuante no canto inferior direito, sempre disponível. Toque → fala. Voz como entrada principal, **cartões na tela** para mostrar as opções (listas em voz não funcionam).

### 2.3 Três tipos de pedido que o agente reconhece
1. **Indeciso** — "estou com fome": usa contexto e histórico.
2. **Específico** — "hambúrguer artesanal até R$ 40": traduz em busca + filtros.
3. **Por objetivo** — "quero fazer um bolo": vira lista (Onda 2, mercado).

### 2.4 Regra de proveniência (decisão de arquitetura proposta)
Todo motivo que o agente fala precisa vir de um **campo real**. O ranking é feito por código determinístico, que devolve `reasons[]` estruturados (ex.: `{tipo: "nota", valor: 4.8}`); o modelo **só verbaliza** esses motivos e **não pode acrescentar outros**. Isso evita alucinação e dá uma história técnica forte à banca.

## 3. O que o MCP permite (rótulos de recomendação)

| Rótulo que o agente fala | Dado que sustenta | Situação |
|---|---|---|
| "Mais bem avaliada" | avaliação do estabelecimento (lista MERCHANT) | ✅ |
| "Mais barata / custo-benefício" | preço do item + taxa de entrega; `sort: PRICE`; nota | ✅ (custo total exato só após carrinho) |
| "Mais rápida" | tempo de entrega; `sort: DELIVERY_TIME` | ✅ |
| "Mais perto" | distância (linha reta) | ✅ |
| "Em promoção" | `getRecommendations(BEST_DEALS)`; vouchers no carrinho | ✅ |
| "Você já pediu X vezes" / "seu favorito" | `RECENT_ORDERS` (`timesOrdered`, `lastOrderedAt`), `FAVORITE_MERCHANTS` | ✅ (precisa histórico) |
| "Novo para você" (anti-repetição) | itens ausentes de `RECENT_ORDERS` | ✅ |
| "Curado pelo iFood perto de você" | `RECOMMENDED`, `FEATURED_LOCAL` | ✅ |
| "Muito pedido nos últimos meses" | popularidade global | 🔴 **não documentada** |
| "Restaurante novo" | data de abertura | 🔴 **não documentada** |
| "Gourmet / refinado" | faixa de preço/categoria | 🟡 proxy declarado: nota alta + preço acima da mediana dos resultados `[DECIDIR]` |
| "Sem lactose / proteico / calorias" | dados nutricionais | 🔴 só `VEGETARIAN`, `VEGAN`, `GLUTEN_FREE`; sem garantia de alergênico |

Regra: se o dado não existe, o rótulo não existe. Para "em alta" usamos "curado pelo iFood", que é verdadeiro.

## 4. As 44 funcionalidades, cruzadas com o MCP

Legenda: ✅ o MCP entrega · 🟡 parcial ou por proxy · ⚙️ é nosso (não depende do MCP) · 🔴 sem dado ou fora de alcance.

| Status | Itens |
|---|---|
| ✅ | 3 endereços (rotina por endereço), 4 perfil comportamental, 9, 10, 11, 13, 14, 15, 16, 24, 25, 29, 40 |
| 🟡 | 1 rotina, 2 padrões, 5 contextual, 12 SmartBudget, 19 explicação (só motivos com dado), 32–33 mercado que tem tudo, 36 preço por unidade, 43 painel |
| ⚙️ | 6 memória, 7 aprendizado, 8 transparência, 17 planejamento, 20, 21, 22, 23, 26, 27, 28, 30, 31, 34, 35, 37, 38, 39, 41 |
| 🔴 | 18 proativo (exige push/permissão), 42 calendário (outro OAuth), 44 orçamento recorrente (sem dado financeiro) |

**Cuidados importantes:**
- `createCart` **não é idempotente** e exige ≥1 item: não use o carrinho para "comparar preços" de várias lojas. Compare por preço de item + taxa da lista; custo total só no carrinho final.
- Não há tool de cancelar/reembolsar, então **confirmação humana antes de `submitOrder` é obrigatória** (`userConsent: true` nunca preenchido pelo modelo).
- "O de sempre" é viável: `RECENT_ORDERS` retorna `lastOrderId`, e `createCart(orderId)` reordena (revisar preço e disponibilidade).

## 5. Escopo da V1

**Núcleo (A–F completos, em 3 camadas — sempre com algo funcionando de ponta a ponta):**

| Camada | Entrega | Itens principais |
|---|---|---|
| **1. Fio completo** | Falar → entender → buscar no MCP → 3 opções com motivo → carrinho → confirmar → pedido → rastrear | 9, 10, 11, 19, 20, 21, 24, 25, 29 |
| **2. Personalização** | Endereço e horário, rotina, histórico, memória básica, modos (econômico, surpresa), anti-repetição | 1–7, 13–16, 22 |
| **3. Refinamento** | Interrupção por voz, controle da tela por voz, aprendizado contínuo, transparência da memória, alternar voz/texto | 8, 23, 26–28 |

**Se der tempo (Onda 2):** G Mercado (30–40), H Extras (17, 18, 41, 43).
**Visão / pitch:** 42, 44.

## 6. Arquitetura proposta (`[DECIDIR]` stack no D-002)

```
Navegador (PWA)  ── voz (Web Speech API) + cartões ──┐
                                                       ▼
Backend (Next.js/Node) ── agente (Claude, tool use)
   ├─ Adaptador MCP por domínio (User, Discovery, Cart, Order) + OAuth/PKCE (secret só aqui)
   ├─ Motor de recomendação (determinístico) → reasons[]
   ├─ Memória (Postgres/SQLite): preferências, eventos, feedback, consentimento
   └─ Máquina de estados do pedido + trava de confirmação
```

- **Voz v1:** Web Speech API do navegador (reconhecimento pt-BR + síntese), com texto como reserva. Upgrade se sobrar tempo: STT/TTS em streaming. `[VERIFICAR]` qualidade e latência na sala.
- **Cliente MCP no app:** o app precisa falar OAuth com o iFood (PKCE, tokens por usuário, refresh sem corrida). `[VERIFICAR]` suporte do SDK MCP escolhido.
- **Estados do pedido** (do guia): aguardando login → escolhendo endereço → descobrindo → configurando itens → revisando carrinho → aguardando confirmação → submetendo → confirmado → falha/incerto.
- **Modo simulado:** servidor falso com respostas realistas (baseadas no guia) para as 3 frentes trabalharem em paralelo **agora**, sem depender do portal.

## 7. Experiência (exemplo de diálogo)

> **Usuário:** "Tô com fome, algo bom e barato."
> **Agente:** "Achei 3 perto de você. **A Hamburgueria X**: a mais barata, R$ 28 no combo, nota 4,6. **Y**: a mais bem avaliada, 4,9, mas R$ 46. **Z**: você já pediu lá 3 vezes, chega em 20 minutos. Qual?"
> **Usuário:** "A primeira, sem cebola."
> **Agente:** "Combo da X sem cebola, R$ 31,90 com entrega, Pix. Confirmo o pedido?"
> **Usuário:** "Confirma."

Princípios: respostas curtas; voz fala as 2–3 opções, a tela mostra os detalhes; **uma** pergunta de esclarecimento no máximo; confirmação final explícita (frase ou toque) mostrando itens, endereço, total.

## 8. Como vamos validar

**8.1 Validação técnica (primeiras horas) — Gate 1**
- [ ] Agente aprovado; `tools/list` real comparado às 24 tools documentadas.
- [ ] Um pedido de teste de ponta a ponta pelo Claude Code, sem pagar Pix.
- [ ] Checar nos dados reais: o que `getRecommendations` e a lista MERCHANT devolvem (nota, taxa, tempo, preço)? `userBehaviorDescription` traz algo útil? Cobertura de catálogo no endereço da demo?

**8.2 Validação de produto**
- Teste cronometrado com 5 pessoas: **mesmo pedido no app normal versus com o agente** (tempo, toques, trocas de fala). É o dado central do pitch.
- Teste cego de recomendação: as 3 opções fazem sentido? As explicações são verdadeiras? Meta: zero motivo sem dado.

**8.3 Validação da demo**
- 10 execuções seguidas do roteiro; meta ≥ 9 sem falha. Vídeo de reserva gravado após a camada 1.

**Métricas**

| Dimensão | Métrica | Meta V1 |
|---|---|---|
| Norte | Tempo da fome ao pedido confirmado | < 60 s por voz |
| Experiência | Toques até o pedido | ≤ 2 |
| Experiência | Perguntas de esclarecimento | ≤ 1 |
| Recomendação | Opção 1 aceita sem "outra" | ≥ 60% nos testes |
| Honestidade | Motivos sem dado real | **0** |
| Voz | Latência até começar a responder | < 2 s |
| Voz | Erro de reconhecimento em pratos | medir (sem meta) |
| MCP | Chamadas bem-sucedidas / IDs inventados | ≥ 95% / **0** |
| Custo | Custo médio por pedido simulado | medir |
| Demo | Execuções OK em 10 | ≥ 9 |

## 9. Plano e divisão (do sábado ~15h ao domingo 12h30)

| Janela | Foco |
|---|---|
| Sáb 15h–17h | Decisões abertas (seção 11); modo simulado e contratos; esqueleto + deploy; conexão ao MCP real assim que o portal liberar |
| Sáb 17h–23h | **Camada 1** funcionando de ponta a ponta (com voz e confirmação) |
| Sáb 23h–Dom 4h | **Camada 2** (memória, rotina, modos); gerar histórico com pedidos de teste; revezar descanso |
| Dom 4h–9h | **Camada 3**; testes com pessoas; entregáveis 01–05 em paralelo |
| Dom 9h–11h | Congelar funcionalidades; vídeo de reserva; 10 execuções da demo |
| Dom 11h–12h30 | Ensaio do pitch, submissão, feedback do MCP (06) |

**Divisão:** (1) agente e MCP: adaptador, OAuth, motor de recomendação, estados; (2) voz e interface; (3) memória e dados (personalização, histórico, entregáveis); integrador (Kenzo): esqueleto, deploy, contratos, revisão, plano B e pitch.

## 10. Riscos e plano B

| Risco | Plano B |
|---|---|
| Portal/homologação atrasa | Modo simulado desde o início; demo com fixtures; vídeo |
| OAuth no app mais difícil que no Claude Code | Camada 1 no Claude Code/CLI primeiro; app depois |
| Redirect URL fixo (um só) conflita com o dev | Decidir runtime antes de cadastrar; confirmar se aceita mais de um |
| Credenciais compartilhadas vs termos (§6.1, §9) | Confirmar com a organização; cada dev com sessão própria |
| Voz ruim em sala barulhenta | Modo texto; microfone próprio; gravar vídeo |
| Histórico vazio no sandbox | Pedidos de teste reais antes da demo + memória semeada |
| Catálogo fraco no endereço da demo | Escolher endereço com boa cobertura cedo |
| Pix real não reembolsado; `document` no checkout incerto | Nunca pagar; perguntar ao mentor sobre CPF |
| Escopo (44 itens) | Camadas + cortes explícitos (seção 5) |

## 11. Decisões pendentes (com recomendação)

1. **Stack e runtime** (D-002) → recomendo web/PWA mobile-first em TypeScript, com backend próprio para segurar o secret. `[DECIDIR]`
2. **Redirect URL do agente** → deve ser o callback do runtime final, **não** o `localhost:8765` pensado para o Claude Code. Decidir antes de cadastrar; perguntar se aceita mais de um. `[DECIDIR]`
3. **Credenciais:** um agente para o time ou um por pessoa? → perguntar à organização (termos restringem compartilhamento). `[VERIFICAR]`
4. **Proxy de "gourmet"** (nota alta + preço acima da mediana) → aprovar ou retirar o rótulo. `[DECIDIR]`
5. **Endereço e vertical da demo** (restaurante; mercado só na Onda 2). `[DECIDIR]`
6. **Usuário-alvo do pitch** (ex.: mãos ocupadas, acessibilidade, indecisos). `[DECIDIR]`
7. **Nome do produto.** `[DECIDIR]`

## 12. Primeiras ações (próximas 2 horas)

1. Responder as decisões 1 e 2 (stack e redirect) — **bloqueiam o cadastro do agente**.
2. Ao aprovar o agente: `tools/list` real e um pedido de teste (Gate 1).
3. Em paralelo, sem esperar o portal: montar o **modo simulado** e os contratos de dados.
4. Perguntar aos mentores: credenciais por pessoa, `document` no checkout, e se um app próprio pode ser cliente MCP com OAuth.
5. Transformar as seções 5, 8 e 9 em cards no Trello.
