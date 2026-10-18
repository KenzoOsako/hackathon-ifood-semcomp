import { z } from "zod";
import { limparNome } from "./guardas-fala";
import type { ConfiguracaoItem, GrupoComplemento, OpcaoPlano, PlanoSnapshot } from "./types";

// Adaptador conservador do detalhe Discovery. Formato desconhecido não significa item sem opções.
const id = z.string().min(1).max(200);
const inteiro = z.number().int().min(0).max(99);
const opcaoSchema = z.object({ optionId: id, name: z.string().min(1), additionalPrice: z.number().finite().min(0).max(1_000_000), available: z.boolean().optional(), customizations: z.array(z.unknown()).max(0).optional(), optionGroups: z.array(z.unknown()).max(0).optional() });
const grupoSchema = z.object({ optionGroupId: id, name: z.string().min(1), minSelections: inteiro, maxSelections: inteiro, options: z.array(opcaoSchema).max(100) });
const detalheSchema = z.object({ itemId: id, optionGroups: z.array(grupoSchema).max(30), customizations: z.array(z.unknown()).max(0).optional() });

export function normalizarComplementos(raw: unknown, itemId: string): GrupoComplemento[] {
  const d = detalheSchema.parse(raw);
  if (d.itemId !== itemId) throw new Error("DETALHE_ITEM_DIVERGENTE");
  const ids = new Set<string>();
  return d.optionGroups.map(g => {
    if (ids.has(g.optionGroupId) || g.minSelections > g.maxSelections) throw new Error("GRUPO_INVALIDO");
    ids.add(g.optionGroupId);
    const opcoesIds = new Set<string>();
    const nome = limparNome(g.name, 80);
    if (!nome) throw new Error("NOME_GRUPO_INVALIDO");
    const opcoes = g.options.map(o => {
      const nomeOpcao = limparNome(o.name, 80);
      if (opcoesIds.has(o.optionId) || !nomeOpcao) throw new Error("OPCAO_INVALIDA");
      opcoesIds.add(o.optionId);
      return { id: o.optionId, nome: nomeOpcao, precoCents: Math.round(o.additionalPrice * 100), disponivel: o.available !== false };
    });
    return { id: g.optionGroupId, nome, minimo: g.minSelections, maximo: g.maxSelections, opcoes };
  });
}

export function validarSelecoes(o: OpcaoPlano, selecoes = o.complementos?.selecoes ?? []): string[] {
  const c = o.complementos;
  if (!c || c.status !== "verificado") return ["Complementos ainda não verificados. Tente carregar as opções novamente."];
  const erros: string[] = [];
  if (c.composicaoNaoVerificada && (selecoes.length > 0 || c.grupos.some(g => g.minimo > 0))) return ["A composição dos complementos não foi verificada para suas restrições. Escolha outro item com composição confirmada."];
  const vistos = new Set<string>();
  const quantidades = new Map<string, number>();
  const grupos = new Map(c.grupos.map(g => [g.id, g]));
  for (const s of selecoes) {
    const grupo = grupos.get(s.grupoId);
    const opcao = grupo?.opcoes.find(x => x.id === s.opcaoId);
    const chave = JSON.stringify([s.grupoId, s.opcaoId]);
    if (!opcao?.disponivel || vistos.has(chave) || !Number.isSafeInteger(s.quantidade) || s.quantidade < 1 || s.quantidade > 99) erros.push("Seleção inválida ou indisponível.");
    vistos.add(chave);
    quantidades.set(s.grupoId, (quantidades.get(s.grupoId) ?? 0) + s.quantidade);
  }
  for (const g of c.grupos) {
    const qtd = quantidades.get(g.id) ?? 0;
    if (qtd < g.minimo || qtd > g.maximo) erros.push(`${g.nome}: selecione de ${g.minimo} a ${g.maximo}.`);
  }
  return erros;
}

export function adicionalCents(o: OpcaoPlano): number {
  return (o.complementos?.selecoes ?? []).reduce((total, s) => total + (o.complementos?.grupos.find(g => g.id === s.grupoId)?.opcoes.find(x => x.id === s.opcaoId)?.precoCents ?? 0) * s.quantidade, 0);
}
export const precoConfigurado = (o: OpcaoPlano) => o.precoCents + adicionalCents(o);
export function resumoComplementos(o: OpcaoPlano): string[] {
  return (o.complementos?.selecoes ?? []).map(s => `${s.quantidade}× ${o.complementos?.grupos.find(g => g.id === s.grupoId)?.opcoes.find(x => x.id === s.opcaoId)?.nome ?? "Opção"}`);
}

export function impedimentosPlano(p: PlanoSnapshot): string[] {
  if (!p.blocos.length) return ["O plano está vazio."];
  return p.blocos.flatMap(b => b.principal.complementos || b.principal.origem === "real" ? validarSelecoes(b.principal).map(e => `${b.principal.item}: ${e}`) : []);
}

export function configurarItem(p: PlanoSnapshot, input: ConfiguracaoItem): PlanoSnapshot {
  if (p.planoId !== input.planoId || p.versao !== input.versao) throw new Error("VERSAO_DESATUALIZADA");
  const b = p.blocos.find(b => b.necessidadeId === input.necessidadeId && b.principal.ref === input.ref);
  if (!b) throw new Error("ITEM_FORA_DO_PLANO");
  const erros = validarSelecoes(b.principal, input.selecoes);
  if (erros.length) throw new Error(erros.join(" "));
  const normalizar = (xs: ConfiguracaoItem["selecoes"]) => JSON.stringify([...xs].sort((a,b) => a.grupoId.localeCompare(b.grupoId) || a.opcaoId.localeCompare(b.opcaoId)));
  if (normalizar(b.principal.complementos!.selecoes) === normalizar(input.selecoes)) return p;
  return { ...p, versao: p.versao + 1, blocos: p.blocos.map(x => x !== b ? x : { ...x, principal: { ...x.principal, complementos: { ...x.principal.complementos!, selecoes: structuredClone(input.selecoes) } } }) };
}

export async function detalharPlano(p: PlanoSnapshot, detalhar?: (o: OpcaoPlano) => Promise<OpcaoPlano>): Promise<PlanoSnapshot> {
  if (!detalhar) return p;
  const blocos = await Promise.all(p.blocos.map(async b => ({ ...b, principal: await detalhar(b.principal) })));
  return { ...p, blocos };
}
