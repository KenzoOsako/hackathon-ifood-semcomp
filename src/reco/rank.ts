// Motor de recomendação determinístico. Devolve 3 opções com motivos montados SÓ a partir de dados reais.
// O modelo de linguagem apenas verbaliza `reasons`; nunca acrescenta motivo próprio.
import type { Candidate, HistoryEntry, Option, OptionLabel, Reason } from "@/contracts";

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const effectivePrice = (c: Candidate) => c.promotionalPrice ?? c.price;
const total = (c: Candidate) => effectivePrice(c) + (c.deliveryFee ?? 0);

function reasonsFor(c: Candidate, all: Candidate[], hist?: HistoryEntry): Reason[] {
  const r: Reason[] = [];
  const cheapest = Math.min(...all.map(effectivePrice));
  if (effectivePrice(c) === cheapest && all.length > 1) {
    r.push({ kind: "price", value: effectivePrice(c), text: `${brl(effectivePrice(c))} no item, o mais barato entre os encontrados` });
  } else {
    r.push({ kind: "price", value: effectivePrice(c), text: `${brl(effectivePrice(c))} no item` });
  }
  if (c.promotionalPrice !== undefined) {
    r.push({ kind: "promo", value: c.promotionalPrice, text: `em promoção (de ${brl(c.price)} por ${brl(c.promotionalPrice)})` });
  }
  if (c.rating !== undefined) r.push({ kind: "rating", value: c.rating, text: `nota ${c.rating.toFixed(1).replace(".", ",")}` });
  if (c.deliveryTimeMinutes !== undefined) {
    r.push({ kind: "delivery_time", value: c.deliveryTimeMinutes, text: `entrega em cerca de ${c.deliveryTimeMinutes} min` });
  }
  if (c.distanceKm !== undefined) r.push({ kind: "distance", value: c.distanceKm, text: `a ${c.distanceKm.toFixed(1).replace(".", ",")} km de você` });
  if (hist && hist.timesOrdered > 0) {
    r.push({ kind: "times_ordered", value: hist.timesOrdered, text: `você já pediu aqui ${hist.timesOrdered} ${hist.timesOrdered === 1 ? "vez" : "vezes"}` });
  } else if (hist === undefined) {
    r.push({ kind: "new_for_you", value: true, text: "você ainda não pediu aqui" });
  }
  if (c.curated) r.push({ kind: "curated", value: true, text: "curado pelo iFood perto de você" });
  return r;
}

export function rank(candidates: Candidate[], history: HistoryEntry[], limit = 3): Option[] {
  if (candidates.length === 0) return [];
  const histBy = new Map(history.map((h) => [h.merchantId, h]));
  const chosen = new Map<string, OptionLabel>(); // merchantId -> label
  const pick = (label: OptionLabel, sorted: Candidate[]) => {
    const c = sorted.find((x) => !chosen.has(x.merchantId));
    if (c) chosen.set(c.merchantId, label);
  };

  pick("MAIS_BARATA", [...candidates].sort((a, b) => total(a) - total(b)));
  pick("MELHOR_AVALIADA", [...candidates].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || total(a) - total(b)));
  const favorites = candidates
    .filter((c) => (histBy.get(c.merchantId)?.timesOrdered ?? 0) > 0)
    .sort((a, b) => histBy.get(b.merchantId)!.timesOrdered - histBy.get(a.merchantId)!.timesOrdered);
  if (favorites.length > 0) pick("SEU_FAVORITO", favorites);
  pick("MAIS_RAPIDA", [...candidates].sort((a, b) => (a.deliveryTimeMinutes ?? 999) - (b.deliveryTimeMinutes ?? 999)));
  pick("NOVIDADE_PARA_VOCE", candidates.filter((c) => !histBy.has(c.merchantId)));

  return [...chosen.entries()].slice(0, limit).map(([merchantId, label]) => {
    const candidate = candidates.find((c) => c.merchantId === merchantId)!;
    return { label, candidate, reasons: reasonsFor(candidate, candidates, histBy.get(merchantId)) };
  });
}
