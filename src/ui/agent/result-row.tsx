import { BadgeCheck, Clock, Heart, History, MapPin, Sparkles, Star, Tag, Wallet, Zap, type LucideIcon } from "lucide-react";
import type { Option, OptionLabel, Reason } from "@/contracts";
import { fromReais } from "./format";

const LABELS: Record<OptionLabel, { title: string; Icon: LucideIcon }> = {
  MAIS_BARATA: { title: "Mais barata", Icon: Wallet },
  MELHOR_AVALIADA: { title: "Melhor avaliada", Icon: Star },
  MAIS_RAPIDA: { title: "Mais rápida", Icon: Zap },
  SEU_FAVORITO: { title: "Seu favorito", Icon: Heart },
  NOVIDADE_PARA_VOCE: { title: "Novidade para você", Icon: Sparkles },
};

const REASON_ICON: Record<Reason["kind"], LucideIcon> = {
  rating: Star, price: Tag, delivery_time: Clock, distance: MapPin,
  promo: Tag, times_ordered: History, new_for_you: Sparkles, curated: BadgeCheck,
};

// Linha no formato da busca do iFood (logo, nome, nota, tempo, frete), mas o destaque é o produto
// recomendado. Os chips são só os motivos de `reasons`; a UI não inventa nenhum.
export function ResultRow({ option, onSelect, disabled }: { option: Option; onSelect: () => void; disabled: boolean }) {
  const { title, Icon } = LABELS[option.label];
  const c = option.candidate;
  const price = c.promotionalPrice ?? c.price;
  const fee =
    c.deliveryFee === undefined ? <span>Frete não informado</span>
    : c.deliveryFee === 0 ? <span className="font-semibold text-success-foreground">Grátis</span>
    : <span>Frete {fromReais(c.deliveryFee)}</span>;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-label={`${title}: ${c.itemName}, ${c.merchantName}, ${fromReais(price)}. Escolher`}
      className="flex w-full items-start gap-3 py-3 text-left disabled:opacity-60"
    >
      {/* Sem logos reais na demo: a inicial da loja faz o papel da imagem. */}
      <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-accent font-display text-2xl font-bold text-accent-foreground">
        {c.merchantName.charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold leading-tight">{c.merchantName}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          {c.rating !== undefined && (
            <>
              <Star className="size-3.5 fill-current text-warning-foreground" aria-hidden="true" />
              <span>{c.rating.toFixed(1).replace(".", ",")}</span>
              <span aria-hidden="true">•</span>
            </>
          )}
          {c.deliveryTimeMinutes !== undefined && (
            <>
              <span>≈ {c.deliveryTimeMinutes} min</span>
              <span aria-hidden="true">•</span>
            </>
          )}
          {fee}
        </span>
        <span className="mt-1 flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{c.itemName}</span>
          <span className="shrink-0 font-display text-base font-bold">{fromReais(price)}</span>
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            <Icon className="size-3" aria-hidden="true" /> {title}
          </span>
          {option.reasons.slice(0, 2).map((r) => {
            const RIcon = REASON_ICON[r.kind];
            return (
              <span key={r.kind} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                <RIcon className="size-3" aria-hidden="true" /> {r.text}
              </span>
            );
          })}
        </span>
      </span>
    </button>
  );
}
