// Domínio simulado com as mesmas assinaturas do DomainPort. Dados vêm do spike de voz
// (src/voice/agent-prompt.md) e são sempre rotulados "simulado". Substituído pelas
// funções reais do Kenzo (K-3/K-5) sem mudar o orquestrador.
import { randomUUID } from "node:crypto";
import type { BlocoPlano, Criterio, DomainPort, EventoFeedback, Necessidade, Ocasiao, OpcaoPlano, PlanoSnapshot, Vertical } from "../types";

interface Oferta {
  ref: string; vertical: Vertical; loja: string; item: string; termos: string[];
  precoCents: number; freteCents?: number; prazoMin: number; prazo: string; nota?: number;
  pedidoMinimoCents?: number; vezesPedido?: number; contem?: string[]; porcoes?: number;
}

const OFERTAS: Oferta[] = [
  { ref: "praca-xburger", vertical: "RESTAURANT", loja: "Lanchonete da Praça", item: "X-Burger", termos: ["hamburguer", "lanche", "burger", "x-burger"], precoCents: 1690, freteCents: 0, prazoMin: 18, prazo: "18 minutos", nota: 4.3 },
  { ref: "ze-classico", vertical: "RESTAURANT", loja: "Burger do Zé", item: "hambúrguer clássico", termos: ["hamburguer", "lanche", "burger"], precoCents: 2490, freteCents: 499, prazoMin: 30, prazo: "30 minutos", nota: 4.6, vezesPedido: 3 },
  { ref: "smash-duplo", vertical: "RESTAURANT", loja: "Gourmet Smash", item: "smash duplo com cheddar", termos: ["hamburguer", "lanche", "burger", "smash"], precoCents: 4200, freteCents: 890, prazoMin: 45, prazo: "45 minutos", nota: 4.9, contem: ["lactose"] },
  { ref: "nonna-margherita", vertical: "RESTAURANT", loja: "Pizzaria Nonna", item: "pizza margherita grande", termos: ["pizza", "margherita"], precoCents: 4800, freteCents: 650, prazoMin: 40, prazo: "40 minutos", nota: 4.7, contem: ["lactose"], porcoes: 3 },
  { ref: "forno-calabresa", vertical: "RESTAURANT", loja: "Forno e Cia", item: "pizza calabresa grande", termos: ["pizza", "calabresa"], precoCents: 3990, freteCents: 590, prazoMin: 35, prazo: "35 minutos", nota: 4.4, contem: ["lactose"], porcoes: 3 },
  { ref: "central-pipoca", vertical: "GROCERIES", loja: "Mercado Central", item: "pipoca de micro-ondas, pacote com 3", termos: ["pipoca", "filme", "petisco"], precoCents: 890, freteCents: 600, prazoMin: 35, prazo: "35 minutos", pedidoMinimoCents: 3000, porcoes: 3 },
  { ref: "central-refri", vertical: "GROCERIES", loja: "Mercado Central", item: "refrigerante de 2 litros", termos: ["refrigerante", "bebida"], precoCents: 950, freteCents: 600, prazoMin: 35, prazo: "35 minutos", pedidoMinimoCents: 3000, porcoes: 4 },
  { ref: "central-copos", vertical: "GROCERIES", loja: "Mercado Central", item: "50 copos descartáveis", termos: ["copo", "copos", "descartavel"], precoCents: 700, freteCents: 600, prazoMin: 35, prazo: "35 minutos", pedidoMinimoCents: 3000 },
  { ref: "bairro-pipoca", vertical: "GROCERIES", loja: "Mercado do Bairro", item: "pipoca de micro-ondas, pacote com 3", termos: ["pipoca", "filme", "petisco"], precoCents: 990, freteCents: 450, prazoMin: 25, prazo: "25 minutos", pedidoMinimoCents: 2500, porcoes: 3 },
  { ref: "bairro-refri", vertical: "GROCERIES", loja: "Mercado do Bairro", item: "refrigerante de 2 litros", termos: ["refrigerante", "bebida"], precoCents: 890, freteCents: 450, prazoMin: 25, prazo: "25 minutos", pedidoMinimoCents: 2500, porcoes: 4 },
  { ref: "casa-panelas", vertical: "SHOPPING", loja: "Casa e Sabor", item: "kit de panelas antiaderentes", termos: ["presente", "panela", "cozinha"], precoCents: 8990, prazoMin: 1440, prazo: "amanhã", nota: 4.5 },
  { ref: "gamer-fone", vertical: "SHOPPING", loja: "Gamer Center", item: "fone de ouvido bluetooth", termos: ["presente", "fone", "eletronico"], precoCents: 9900, prazoMin: 1440, prazo: "amanhã", nota: 4.6 },
  { ref: "livraria-livro", vertical: "SHOPPING", loja: "Livraria Central", item: "livro de culinária ilustrado", termos: ["presente", "livro", "cozinha"], precoCents: 5990, prazoMin: 2880, prazo: "em dois dias", nota: 4.8 },
];

// Critério padrão por vertical (regra simulada, não aprovada como ranking real).
const PADRAO: Record<Vertical, Exclude<Criterio, "outra">> = { RESTAURANT: "mais_barata", GROCERIES: "mais_rapida", SHOPPING: "melhor_avaliada" };
const ROTULO: Record<Exclude<Criterio, "outra">, [string, string]> = {
  mais_barata: ["mais barata", "menor preço entre as opções"],
  mais_rapida: ["mais rápida", "menor prazo de entrega"],
  melhor_avaliada: ["melhor avaliada", "maior nota entre as opções"],
  favorita: ["seu favorito", "você já pediu aqui antes"],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Só concorre num critério quem tem o dado: sem nota não é "melhor avaliada", sem histórico não é "favorito".
function comDado(ofertas: Oferta[], criterio: Exclude<Criterio, "outra">): Oferta[] {
  if (criterio === "melhor_avaliada") return ofertas.filter((o) => o.nota !== undefined);
  if (criterio === "favorita") return ofertas.filter((o) => (o.vezesPedido ?? 0) > 0);
  return ofertas;
}

function ordenar(ofertas: Oferta[], criterio: Exclude<Criterio, "outra">): Oferta[] {
  const key: Record<typeof criterio, (o: Oferta) => number> = {
    mais_barata: (o) => o.precoCents,
    mais_rapida: (o) => o.prazoMin,
    melhor_avaliada: (o) => -(o.nota ?? 0),
    favorita: (o) => -(o.vezesPedido ?? 0),
  };
  return [...ofertas].sort((a, b) => key[criterio](a) - key[criterio](b) || a.precoCents - b.precoCents);
}

function toOpcao(o: Oferta, criterio: Exclude<Criterio, "outra">): OpcaoPlano {
  const [rotulo, motivo] = ROTULO[criterio];
  return { ref: o.ref, loja: o.loja, item: o.item, precoCents: o.precoCents, freteCents: o.freteCents, prazo: o.prazo, nota: o.nota, rotulo, motivo, origem: "simulado" };
}

export class FakeDomain implements DomainPort {
  private readonly planos = new Map<string, { subjectRef: string; snapshot: PlanoSnapshot; necessidades: Necessidade[]; ocasiao: Ocasiao }>();
  readonly eventos: { subjectRef: string; evento: EventoFeedback }[] = [];

  private candidatos(n: Necessidade, ocasiao: Ocasiao): Oferta[] {
    const cat = norm(n.categoria);
    const restricoes = n.restricoes.map(norm);
    const qtd = quantidade(n, ocasiao);
    return OFERTAS.filter((o) => o.vertical === n.vertical)
      .filter((o) => o.termos.some((t) => cat.includes(t) || t.includes(cat)) || norm(o.item).includes(cat))
      // Filtro rígido: restrição declarada exclui a oferta; nunca é relaxado aqui.
      .filter((o) => !restricoes.some((r) => (o.contem ?? []).some((c) => r.includes(c) || c.includes(r))))
      .filter((o) => n.orcamento?.tipo !== "teto" || o.precoCents * qtd <= Math.round(n.orcamento.max * 100));
  }

  buscarNecessidade(n: Necessidade, ocasiao: Ocasiao): Promise<OpcaoPlano[]> {
    const candidatos = this.candidatos(n, ocasiao);
    const padrao = PADRAO[n.vertical];
    // Sem o dado do critério padrão, cai para o menor preço (sempre presente).
    const criterio = comDado(candidatos, padrao).length > 0 ? padrao : "mais_barata";
    const lista = [...ordenar(comDado(candidatos, criterio), criterio), ...candidatos.filter((o) => !comDado([o], criterio).length)];
    return Promise.resolve(lista.slice(0, 3).map((o, i) => (i === 0 ? toOpcao(o, criterio) : alternativa(o, lista))));
  }

  montarPlano(input: { subjectRef: string; ocasiao: Ocasiao; itens: { necessidade: Necessidade; opcoes: OpcaoPlano[] }[] }): Promise<PlanoSnapshot> {
    const snapshot = construir(randomUUID(), 1, input.ocasiao, input.itens);
    this.planos.set(snapshot.planoId, { subjectRef: input.subjectRef, snapshot, necessidades: input.itens.map((i) => i.necessidade), ocasiao: input.ocasiao });
    if (this.planos.size > 5000) this.planos.delete(this.planos.keys().next().value!);
    return Promise.resolve(structuredClone(snapshot));
  }

  ajustarPlano(input: { subjectRef: string; planoId: string; versao: number; categoria?: string; criterio: Criterio }): Promise<PlanoSnapshot> {
    try {
      return Promise.resolve(this.executarAjuste(input));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private executarAjuste(input: { subjectRef: string; planoId: string; versao: number; categoria?: string; criterio: Criterio }): PlanoSnapshot {
    const atual = this.planos.get(input.planoId);
    if (atual?.subjectRef !== input.subjectRef) throw new Error("PLANO_INEXISTENTE");
    if (atual.snapshot.versao !== input.versao) throw new Error("VERSAO_DESATUALIZADA");
    const alvo = input.categoria ? norm(input.categoria) : undefined;
    const bloco = atual.snapshot.blocos.find((b) => alvo && (norm(b.categoria).includes(alvo) || alvo.includes(norm(b.categoria)))) ?? atual.snapshot.blocos[0];
    if (!bloco) throw new Error("PLANO_VAZIO");
    const itens = atual.necessidades.map((n) => {
      const b = atual.snapshot.blocos.find((x) => x.necessidadeId === n.id);
      if (!b) return { necessidade: n, opcoes: [] };
      if (b !== bloco) return { necessidade: n, opcoes: [b.principal, ...b.alternativas] };
      const candidatos = this.candidatos(n, atual.ocasiao);
      if (input.criterio === "outra") {
        // "Outra opção": próxima da lista atual, sem repetir a principal.
        const resto = [...b.alternativas, b.principal];
        return { necessidade: n, opcoes: resto };
      }
      const criterio = input.criterio;
      const comCampo = comDado(candidatos, criterio);
      if (comCampo.length === 0) throw new Error("SEM_DADO_CRITERIO");
      const lista = [...ordenar(comCampo, criterio), ...candidatos.filter((o) => !comCampo.includes(o))];
      return { necessidade: n, opcoes: lista.slice(0, 3).map((o, i) => (i === 0 ? toOpcao(o, criterio) : alternativa(o, lista))) };
    });
    // Ajuste que não troca nenhuma principal não gera versão nova (não invalida aprovação à toa).
    const mesmas = itens.every((it) => {
      const b = atual.snapshot.blocos.find((x) => x.necessidadeId === it.necessidade.id);
      return !b || b.principal.ref === it.opcoes[0]?.ref;
    });
    if (mesmas) return structuredClone(atual.snapshot);
    const snapshot = construir(atual.snapshot.planoId, atual.snapshot.versao + 1, atual.ocasiao, itens);
    this.planos.set(snapshot.planoId, { ...atual, snapshot });
    return structuredClone(snapshot);
  }

  registrarEvento(subjectRef: string, evento: EventoFeedback): Promise<void> {
    this.eventos.push({ subjectRef, evento });
    if (this.eventos.length > 5000) this.eventos.shift();
    return Promise.resolve();
  }
}

function alternativa(o: Oferta, lista: Oferta[]): OpcaoPlano {
  // Rótulo da alternativa: o critério em que ela é a melhor da lista, se houver.
  for (const c of ["mais_barata", "mais_rapida", "melhor_avaliada", "favorita"] as const) {
    if (comDado([o], c).length === 0) continue;
    if (ordenar(comDado(lista, c), c)[0]?.ref === o.ref) return toOpcao(o, c);
  }
  return { ...toOpcao(o, "mais_barata"), rotulo: "alternativa", motivo: "outra opção compatível" };
}

function quantidade(n: Necessidade, ocasiao: Ocasiao): number {
  const pessoas = ocasiao.pessoas ?? 1;
  const porcoes = OFERTAS.find((o) => o.vertical === n.vertical && o.termos.some((t) => norm(n.categoria).includes(t)))?.porcoes;
  return n.vertical === "SHOPPING" || !porcoes ? 1 : Math.max(1, Math.ceil(pessoas / porcoes));
}

function construir(planoId: string, versao: number, ocasiao: Ocasiao, itens: { necessidade: Necessidade; opcoes: OpcaoPlano[] }[]): PlanoSnapshot {
  const blocos: BlocoPlano[] = [];
  const naoAtendidas: PlanoSnapshot["naoAtendidas"] = [];
  const pendencias: string[] = [];
  for (const { necessidade: n, opcoes } of itens) {
    const [principal, ...alternativas] = opcoes;
    if (!principal) { naoAtendidas.push({ categoria: n.categoria, motivo: "sem opção compatível nos dados simulados" }); continue; }
    const qtd = quantidade(n, ocasiao);
    blocos.push({ necessidadeId: n.id, vertical: n.vertical, categoria: n.categoria, quantidade: qtd, principal, alternativas, ...(n.fonte === "inferido" ? { sugestao: true } : {}) });
    const oferta = OFERTAS.find((o) => o.ref === principal.ref);
    if (oferta?.pedidoMinimoCents && oferta.precoCents * qtd < oferta.pedidoMinimoCents) {
      pendencias.push(`${oferta.loja} tem pedido mínimo de R$ ${(oferta.pedidoMinimoCents / 100).toFixed(2).replace(".", ",")}`);
    }
    if (n.restricoes.length > 0) pendencias.push(`Confirme a composição de ${principal.item} com a loja (restrição: ${n.restricoes.join(", ")})`);
  }
  pendencias.push("Taxas finais confirmadas no iFood");
  return { planoId, versao, blocos, naoAtendidas, pendencias, origem: "simulado" };
}
