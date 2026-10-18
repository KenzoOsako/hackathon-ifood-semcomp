import { CatalogImage } from "@/ui/components/catalog-image";
import { catalogImage, type CatalogMedia } from "@/ui/lib/catalog-media";
import { BadgeCheck, Clock, Heart, History, MapPin, Sparkles, Star, Tag, Wallet, Zap, type LucideIcon } from "lucide-react";
import type { Option, OptionLabel, Reason } from "@/contracts";
import { Button } from "@/ui/components/button";
import { StoreLogo } from "@/ui/components/store-logo";
import { mockMediaFor } from "@/ui/lib/mock-media";
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

// Como os cupons do iFood: preço/promoção em verde e os demais motivos em roxo suave.
const CHIP_TONE: Partial<Record<Reason["kind"], string>> = {
  price: "bg-success text-success-foreground",
  promo: "bg-success text-success-foreground",
};
const CHIP_DEFAULT = "bg-[var(--cat-5-bg)] text-[color:var(--cat-5-fg)]";

type Props = {
  option: Option;
  media?: CatalogMedia;
  tag?: string; // rótulo vindo do servidor (plano do Guide); sem ele, o do `label`
  first: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onSelect?: () => void; // sem ele, o painel só tem "Ajustar"
  onAdjust: () => void;
};

// Linha no formato da busca do iFood: tag acima do nome, logo quadrado, nome, "★ nota • tempo • frete", o
// produto recomendado com o preço e chips. Só a linha tocada expande; selecionar e aprovar são eventos
// diferentes (aprovar só existe na revisão da proposta).
export function ResultCard({ option, tag, media: suppliedMedia, expanded, disabled, onToggle, onSelect, onAdjust }: Readonly<Props>) {
  const title = tag ?? LABELS[option.label].title;
  const c = option.candidate;
  const price = c.promotionalPrice ?? c.price;
  const panelId = `acoes-${c.itemId}`;
  const free = c.deliveryFee === 0;
  const rating = c.rating?.toFixed(1).replace(".", ",");
  const mock = mockMediaFor(c.merchantId);
  const media = suppliedMedia ? {
    photo: catalogImage(suppliedMedia.photo) ?? (suppliedMedia.photo === mock?.photo ? mock?.photo : undefined),
    logo: catalogImage(suppliedMedia.logo) ?? (suppliedMedia.logo === mock?.logo ? mock?.logo : undefined),
  } : mock;

  return (
    <div className={cn("min-w-0 rounded-2xl transition-colors", expanded && "bg-accent/40")}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${title}: ${c.itemName}, ${c.merchantName}, ${fromReais(price)}`}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left"
      >
        {/* Mídia validada do plano; ausência usa o ícone neutro da loja. */}
        <StoreLogo seed={c.merchantId} shape="square" imageSrc={media?.logo} className="size-[72px]" />
        <span className="min-w-0 flex-1">
          {/* A tag vem do rótulo da opção (como "Mais Pedido" no iFood). */}
          <span className="mb-1 inline-block rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">{title}</span>
          <span className="block truncate font-display text-[17px] font-semibold leading-tight">{c.merchantName}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[15px] text-muted-foreground">
            {rating !== undefined && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-foreground">
                <Star className="size-3.5 fill-current" aria-hidden="true" />{rating}
              </span>
            )}
            {c.deliveryTimeMinutes !== undefined && <span className="whitespace-nowrap">• {c.deliveryTimeMinutes} min</span>}
            {/* No iFood a taxa aparece só como valor ou "Grátis"; o rótulo "frete" fica para o leitor de tela. */}
            <span className={cn("whitespace-nowrap", free && "font-semibold text-success-foreground")}>
              • <span className="sr-only">Frete </span>
              {c.deliveryFee === undefined ? "Frete não informado" : free ? "Grátis" : fromReais(c.deliveryFee)}
            </span>
          </span>
          <span className="mt-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-medium">{c.itemName}</span>
            <span className="shrink-0 font-display text-base font-semibold">{fromReais(price)}</span>
          </span>
          {/* Chips: só os motivos que o servidor enviou; a UI não acrescenta nenhum. */}
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {option.reasons.slice(0, 2).map((r) => {
              const RIcon = REASON_ICON[r.kind];
              return (
                <span key={r.kind} className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium", CHIP_TONE[r.kind] ?? CHIP_DEFAULT)}>
                  <RIcon className="size-3.5" aria-hidden="true" /> {r.text}
                </span>
              );
            })}
          </span>
        </span>
        {/* A foto pertence à opção exibida. Sem mídia, o ícone é decorativo. */}
        {media?.photo ? (
          <span aria-hidden="true" className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border">
            <CatalogImage key={media.photo} src={media.photo} alt="" />
          </span>
        ) : (
          <Heart className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div id={panelId} className={cn("grid gap-2 px-2 pb-3", onSelect && "grid-cols-2")}>
          <Button variant="outline" onClick={onAdjust}>Ajustar</Button>
          {onSelect && <Button disabled={disabled} onClick={onSelect}>Selecionar</Button>}
        </div>
      )}
    </div>
  );
}

export function ResultCardSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 px-2 py-3 motion-reduce:animate-none" aria-hidden="true">
      <span className="size-[72px] shrink-0 rounded-2xl bg-secondary" />
      <span className="grid flex-1 gap-2">
        <span className="h-3 w-16 rounded bg-secondary" />
        <span className="h-4 w-1/2 rounded bg-secondary" />
        <span className="h-3 w-3/4 rounded bg-secondary" />
      </span>
    </div>
  );
}
