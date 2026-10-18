import { BadgeCheck, Clock, Heart, History, MapPin, Sparkles, Star, Tag, Wallet, Zap, type LucideIcon } from "lucide-react";
import type { Option, OptionLabel, Reason } from "@/contracts";
import { Button } from "@/ui/components/button";
import { StoreLogo } from "@/ui/components/store-logo";
import { cn } from "@/ui/lib/utils";
import { fromReais } from "./format";

const LABELS: Record<OptionLabel, { title: string; Icon: LucideIcon }> = {
  MAIS_BARATA: { title: "Mais barata", Icon: Wallet },
  MELHOR_AVALIADA: { title: "Melhor avaliada", Icon: Star },
  MAIS_RAPIDA: { title: "Mais rápida", Icon: Zap },
  SEU_FAVORITO: { title: "Seu favorito", Icon: Heart },
  NOVIDADE_PARA_VOCE: { title: "Novidade para você", Icon: Sparkles },
};

// Ícones só decoram o chip; o motivo em si é o texto que veio em `reasons`.
export const REASON_ICON: Record<Reason["kind"], LucideIcon> = {
  rating: Star, price: Tag, delivery_time: Clock, distance: MapPin,
  promo: Tag, times_ordered: History, new_for_you: Sparkles, curated: BadgeCheck,
};

// Como no iFood, motivos de preço/promoção ganham o chip verde; os demais são neutros.
const CHIP_TONE: Partial<Record<Reason["kind"], string>> = {
  price: "bg-success text-success-foreground",
  promo: "bg-success text-success-foreground",
};

type Props = {
  option: Option;
  first: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onAdjust: () => void;
};

// Linha no formato da busca do iFood: logo, nome, "nota • tempo • frete", o produto recomendado com o preço
// e chips. Só a linha tocada expande; selecionar e aprovar são eventos diferentes (aprovar só existe na revisão).
export function ResultCard({ option, first, expanded, disabled, onToggle, onSelect, onAdjust }: Readonly<Props>) {
  const { title, Icon } = LABELS[option.label];
  const c = option.candidate;
  const price = c.promotionalPrice ?? c.price;
  const panelId = `acoes-${c.itemId}`;
  const free = c.deliveryFee === 0;
  const fee = c.deliveryFee === undefined ? "Frete não informado" : free ? "Frete grátis" : `Frete ${fromReais(c.deliveryFee)}`;
  const rating = c.rating?.toFixed(1).replace(".", ",");

  return (
    <div className={cn("transition-colors", expanded && "bg-accent/40")}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${title}: ${c.itemName}, ${c.merchantName}, ${fromReais(price)}`}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        {/* Sem logos reais na demo: ícone neutro com cor estável por loja (o contrato ainda não traz a categoria). */}
        <StoreLogo seed={c.merchantId} className="size-14" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-medium leading-tight">{c.merchantName}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            {rating !== undefined && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-foreground">
                <Star className="size-3.5 fill-current" aria-hidden="true" />{rating}
              </span>
            )}
            {c.deliveryTimeMinutes !== undefined && <span className="whitespace-nowrap">• {c.deliveryTimeMinutes} min</span>}
            <span className={cn("whitespace-nowrap", free && "font-semibold text-success-foreground")}>• {fee}</span>
          </span>
          <span className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{c.itemName}</span>
            <span className="shrink-0 font-display text-base font-medium">{fromReais(price)}</span>
          </span>
          {/* Chips: o rótulo da opção e os motivos que o servidor enviou; a UI não acrescenta nenhum. */}
          <span className="mt-2 flex flex-wrap gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", first ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
              <Icon className="size-3" aria-hidden="true" /> {title}
            </span>
            {option.reasons.slice(0, 2).map((r) => {
              const RIcon = REASON_ICON[r.kind];
              return (
                <span key={r.kind} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", CHIP_TONE[r.kind] ?? "bg-secondary text-secondary-foreground")}>
                  <RIcon className="size-3" aria-hidden="true" /> {r.text}
                </span>
              );
            })}
          </span>
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="grid grid-cols-2 gap-2 px-4 pb-3">
          <Button variant="outline" onClick={onAdjust}>Ajustar</Button>
          <Button disabled={disabled} onClick={onSelect}>Selecionar</Button>
        </div>
      )}
    </div>
  );
}

export function ResultCardSkeleton() {
  return (
    <div className="flex animate-pulse items-start gap-3 px-4 py-3 motion-reduce:animate-none" aria-hidden="true">
      <span className="size-14 shrink-0 rounded-full bg-secondary" />
      <span className="grid flex-1 gap-2">
        <span className="h-4 w-1/2 rounded bg-secondary" />
        <span className="h-3 w-3/4 rounded bg-secondary" />
        <span className="h-5 w-24 rounded-full bg-secondary" />
      </span>
    </div>
  );
}
