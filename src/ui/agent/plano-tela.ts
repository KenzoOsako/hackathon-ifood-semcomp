// Ponte entre o que o agente manda para a tela (evento `screen` com o plano) e os componentes do Malveste.
// Só lê e formata: nenhuma regra de fluxo, ranking ou soma acontece aqui (docs/PLANO_TELA_GUIDE.md).
import type { OpcaoPlano, PlanoSnapshot, Sacola, TipoTela } from "@/agent/types";
import { chaveLoja } from "@/agent/sacola";
import type { Option, OptionLabel, Reason } from "@/contracts";

import { catalogImage, type CatalogMedia } from "@/ui/lib/catalog-media";
import { mockMediaFor } from "@/ui/lib/mock-media";
import { precoConfigurado } from "@/agent/complementos";

export type PlanoTela = PlanoSnapshot & { sacola?: Sacola };
export type GuideTela = { tipo: TipoTela; plano: PlanoTela };

const TIPOS: readonly TipoTela[] = ["mostrar_plano", "plano_atualizado", "aguardando_aprovacao", "sacola"];

// O evento vem da rede: confere o mínimo antes de desenhar. Evento desconhecido é ignorado.
export function lerTela(screen: { event: string; payload: unknown } | null): GuideTela | null {
  if (!screen || !TIPOS.includes(screen.event as TipoTela)) return null;
  const p = screen.payload as Partial<PlanoTela> | null;
  if (!p || !Array.isArray(p.blocos) || typeof p.versao !== "number") return null;
  return { tipo: screen.event as TipoTela, plano: p as PlanoTela };
}

// Rótulo e motivo vêm do ranking do domínio; aqui só escolhemos o ícone e a tag equivalentes do cartão.
const LABEL: Record<string, [OptionLabel, Reason["kind"]]> = {
  "mais barata": ["MAIS_BARATA", "price"],
  "mais rápida": ["MAIS_RAPIDA", "delivery_time"],
  "melhor avaliada": ["MELHOR_AVALIADA", "rating"],
  "seu favorito": ["SEU_FAVORITO", "times_ordered"],
};

const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// O cartão mostra o preço de uma unidade; a quantidade fica no título do bloco para não parecer total.
export function paraOption(o: OpcaoPlano): { option: Option; tag: string; media: CatalogMedia } {
  const [label, kind] = LABEL[o.rotulo] ?? ["MAIS_BARATA", "curated"];
  const minutos = o.prazo?.match(/^\d+/)?.[0];
  return {
    tag: capitalizar(o.rotulo || "opção"),
    media: o.origem === "simulado" ? (mockMediaFor(chaveLoja(o)) ?? {}) : { photo: catalogImage(o.imagemUrl), logo: catalogImage(o.logoUrl) },
    option: {
      label,
      candidate: {
        merchantId: chaveLoja(o),
        merchantName: o.loja,
        itemId: o.ref,
        itemName: o.item,
        price: precoConfigurado(o) / 100,
        ...(o.freteCents !== undefined ? { deliveryFee: o.freteCents / 100 } : {}),
        ...(o.nota !== undefined ? { rating: o.nota } : {}),
        ...(minutos ? { deliveryTimeMinutes: Number(minutos) } : {}),
      },
      reasons: o.motivo ? [{ kind, value: o.motivo, text: o.motivo }] : [],
    },
  };
}

// Revisão por loja: só agrupa os itens já escolhidos; valores continuam por item, como vieram.
export function porLoja(plano: PlanoSnapshot) {
  const lojas = new Map<string, { lojaId: string; loja: string; freteCents?: number; itens: { bloco: PlanoSnapshot["blocos"][number] }[] }>();
  for (const b of plano.blocos) {
    const id = chaveLoja(b.principal);
    const l = lojas.get(id) ?? { lojaId: id, loja: b.principal.loja, itens: [] };
    if (l.freteCents === undefined) l.freteCents = b.principal.freteCents;
    l.itens.push({ bloco: b });
    lojas.set(id, l);
  }
  return [...lojas.values()];
}
