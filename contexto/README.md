# Pasta `contexto/`

Memória compartilhada do time e dos agentes, para ninguém alucinar nem repetir erro.

| Arquivo | Quem edita | Como |
|---|---|---|
| `regras-de-negocio.md` | **Só humanos** | PR exclusivo, aprovado por mais 1 pessoa. Agentes nunca editam; propõem na descrição do PR ou no chat. |
| `decisoes.md` | Humanos e agentes | Só acrescentar no fim (data, contexto, opções, decisão). Mudou de ideia? Nova entrada que referencia a antiga. |
| `erros-aprendidos.md` | Humanos e agentes | Só acrescentar no fim (sintoma, causa, correção). |
| `estado-atual.md` | Humanos e agentes | Todo PR atualiza: o que funciona, o que está em andamento, o que está quebrado, quem faz o quê. |

## Regras gerais
- Conflito entre arquivos: `regras-de-negocio.md` vence sempre.
- Não apagar histórico. Se algo está obsoleto, marcar como `[OBSOLETO em <data>]`.
- Não colocar segredos aqui.
