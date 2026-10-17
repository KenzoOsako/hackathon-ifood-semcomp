# Contexto completo — Hackathon SEMCOMP × iFood 2026

> Página única para todo mundo (e todo agente) começar do mesmo ponto. Leia inteira antes de codar.
> Não contém segredos. Credenciais ficam no `.env` de cada pessoa. Última atualização: 17/10/2026.

## 1. O evento
- **Tema:** "Vendendo com Agentes". Construir um agente de IA que **faz pedidos de verdade usando o MCP do iFood**, da escolha do restaurante ao fechamento do carrinho.
- **Onde:** SEMCOMP 29, USP São Carlos. 80 participantes, 20 grupos de 4. Alojamento oferecido; ~13 mentores (iFood e outras empresas) passam nas mesas durante todo o evento.
- **Por que existe:** o iFood quer **validar o protocolo MCP** com quem constrói e receber feedback honesto (item 06 da entrega). Outros apps já vendem iFood de forma conversacional (Zappia, Toque), úteis como inspiração.
- **Sem restrição temática.** Criatividade e inovação são incentivadas. A organização avisou que o catálogo de ofertas ainda não é muito abrangente em algumas verticais (ex.: shopping/roupa).
- Uso de IA para programar é permitido e esperado.

## 2. Cronograma
| Quando | O quê |
|---|---|
| Sáb 17/10, 12h30 | Abertura e início do desenvolvimento |
| Sáb, primeira hora | Brainstorm livre; mentores passam depois. **Não é preciso conectar o MCP agora**, mas peça o acesso cedo |
| Sáb 13h → Dom 12h30 | Desenvolvimento contínuo (jantar e café da manhã inclusos) |
| **Dom 18/10, 12h30** | **Fim do desenvolvimento e submissão** |
| Dom 13h → 16h | Pitches: **5 min + 3 min de perguntas** por grupo |
| Dom 16h30 | Consolidação da banca |
| Dom 17h | Resultado, premiação, encerramento |

## 3. Como seremos avaliados (5 pilares)
1. **Visão e originalidade:** solução original, uso criativo de agentes para pedidos.
2. **Arquitetura e engenharia:** qualidade do código, **uso correto do MCP do iFood**, robustez do agente.
3. **Design e experiência:** fluidez da interação, clareza para quem faz o pedido.
4. **Impacto:** resolve um problema real e é viável na prática.
5. **Comunicação e pitch:** clareza da demo, storytelling, respostas à banca.

## 4. Entregáveis obrigatórios (6)
01 Proposta de negócio · 02 Desenho de solução · 03 Racional da experiência (UX) · 04 Interface visual · 05 Documento técnico resumido · 06 **Feedback sobre os MCPs** (dores reais; vai no `contexto/feedback-mcp.md`, anotar na hora).
Cada um é um card no Trello.

## 5. Premiação
1º R$ 4.000 · 2º R$ 2.000 · 3º R$ 1.000, para o grupo todo (divisão proporcional entre os membros). Pago em cartão iFood nominal, saldo livre, cerca de uma semana depois (a organização pede os nomes).

## 6. O MCP do iFood
- **URL do MCP:** `https://consumer-mcp.ifood.com.br/marketplace` (abrir no navegador dá "Method Not Allowed": é normal, ele só atende clientes MCP).
- **Documentação (pública):** https://mcp-developer.ifood.com.br/pt-BR/docs/guides
- **Autenticação:** OAuth 2.1 com escopos. Cada pessoa autentica com um **usuário de teste**.
- **Tools (segundo a apresentação):** usuário (sessão, endereços), descoberta de ofertas (busca, restaurantes), carrinho, checkout/pedidos e rastreio de pedido. Confirmar a lista exata na documentação.
- **Fluxo básico demonstrado:** cadastrar endereço → buscar (ex.: pizza) → adicionar ao carrinho → finalizar com **Pix** → rastrear.
- **Sandbox:** pedidos de teste **não chegam ao restaurante**. **Não pague o Pix** gerado.
- **Dicas dos mentores:** use um modelo recente (o MCP trabalha com muitos IDs, e modelos fracos se confundem). A lista de tools vem da URL remota; se listar, a autenticação funcionou.

### Como conectar (resumo)
1. **Uma pessoa** cria o agente no MCP Portal (perfil Estudante): logo, nome, descrição, **Redirect URL `http://localhost:8765/callback`**, links genéricos de termos e privacidade, **todos os escopos** (não dá para mudar depois). Vai para **homologação manual** do iFood.
2. Aprovado, o portal mostra **Client ID** e **Client Secret** (o secret aparece **uma única vez**). Compartilhar por mensagem direta, nunca no repo, Trello ou grupo.
3. Criar **usuários de teste** (máx. 10 por conta; um por pessoa).
4. Cada pessoa conecta no Claude Code (a confirmar o comando assim que houver credenciais):
   `claude mcp add --transport http --client-id <CLIENT_ID> --client-secret --callback-port 8765 ifood https://consumer-mcp.ifood.com.br/marketplace`
   depois `/mcp` → autenticar. Login com o e-mail do usuário de teste; os **códigos de verificação são gerados no portal** (valem uma vez; nada chega ao celular de verdade).
5. Validar: pedir ao agente "liste as tools do MCP do iFood" e rodar o fluxo básico.
- OpenCode (vídeo 2) usa a mesma Redirect URL no `opencode.json`. Se o Codex não aceitar client id/secret fixos, usar o fluxo do vídeo.
- **Chaves serão revogadas na segunda-feira. Não vazar.**
- Vídeos: cadastro de agente https://youtu.be/o8uafjBqYRk · config no OpenCode https://youtu.be/0C3PYyIjhTM

## 7. Estado atual e bloqueios
- **Portal:** cadastro com erro "Falha ao enviar o código" (SMS). A organização avisou que está resolvendo. Aprovação do agente é manual e não é instantânea.
- **Stack e agente a construir:** ainda não definidos (ver `decisoes.md`, D-002).
- Enquanto o portal não libera: brainstorm, escolher o problema, preparar um **modo simulado do MCP** (respostas fixas) para UI e pitch não dependerem do portal.

## 8. Ideias candidatas (a decidir)
1. **Pedido em grupo:** coordena o almoço de 4 a 10 pessoas (preferências e restrições de cada uma, um restaurante que atenda a todas, carrinho, valor por pessoa, confirmação única). Demo ao vivo com a banca.
2. **Agente de rotina:** aprende hábitos e propõe o pedido ("quinta você costuma pedir X, repito?"). Depende de histórico (no sandbox é vazio; exige dados semeados).
3. **Pedido com restrições fortes** (orçamento, sem lactose, proteico). Depende de o catálogo ter esses dados.

Critério de escolha: dá para fazer o fluxo completo só com as tools que existem? Resolve uma dor real de um usuário definido?

## 9. Como trabalhamos
- **Time:** Felipe (`Felipe-Coelho-Terossi`), Arthur (`arthurMalveste`), Hyago (`HyagoAlv3s`), Kenzo (`KenzoOsako`, **integrador**: único que faz merge). 3 construtores + 1 integrador.
- **GitHub:** branch `feat/<nome>-<assunto>` → PR pequeno → review do Kenzo (Code Owner) → merge. `main` protegida. Nunca push direto, nunca `--force` em branch alheia.
- **Trello** (quadro HACKATHON IFOOD): `A Desenvolver → Desenvolvendo → Em Revisão → Pronto`. **Um card por PR**, checklist de 3 a 6 itens, 1 card em andamento por pessoa. Padrão completo no `AGENTS.md`.
- **Pasta `contexto/`:** `regras-de-negocio.md` só humanos editam (PR próprio); `decisoes.md`, `erros-aprendidos.md` e `feedback-mcp.md` só acrescentam no fim; `estado-atual.md` todo PR atualiza.

## 10. Regras de segurança do agente (propostas; viram regras de negócio quando humanos aprovarem)
- **Nunca finalizar um pedido sem confirmação explícita do usuário**, mostrando itens, endereço e total.
- Nunca inventar IDs: usar só o que o MCP retornou.
- Nunca registrar segredos em logs, commits, cards ou prints da demo.

## 11. Plano B da demo
Gravar um vídeo do fluxo funcionando assim que existir uma versão estável; usar o modo simulado se o MCP falhar ao vivo.

## 12. Links
- Repo: https://github.com/KenzoOsako/hackathon-ifood-semcomp
- Trello: https://trello.com/b/ZcLDfKqU/hackathon-ifood
- Portal de docs: https://mcp-developer.ifood.com.br/pt-BR/docs/guides

## 13. Referência técnica do MCP — 17/10/2026
- Ler [docs/mcp-ifood-referencia.md](../docs/mcp-ifood-referencia.md) antes de implementar integrações; síntese das páginas oficiais dos quatro domínios, autenticação, escopos, erros e casos de uso.
- As 24 ferramentas são documentadas, não uma comprovação de tools/list autenticado do time. Divergências de contrato e limites estão identificados no guia.
- Distribuição de credenciais ao time requer confirmação expressa da organização conforme termos do portal; contas de teste distintas não autorizam, por si só, compartilhar secret ou login administrador.
