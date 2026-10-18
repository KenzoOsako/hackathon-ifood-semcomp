import { BadgeCheck, Clock, Heart, History, MapPin, Sparkles, Star, Tag, Wallet, Zap, type LucideIcon } from "lucide-react";
import type { Option, OptionLabel, Reason } from "@/contracts";
import { Button } from "@/ui/components/button";
import { cn } from "@/ui/lib/utils";
import { StoreLogo } from "@/ui/components/store-logo";
import { fromReais } from "./format";

const LABELS: Record<OptionLabel, { title: string; Icon: LucideIcon }> = {
  MAIS_BARATA: { title: "Mais barata", Icon: Wallet },
  MELHOR_AVALIADA: { title: "Melhor avaliada", Icon: Star },
  MAIS_RAPIDA: { title: "Mais rápida", Icon: Zap },
  SEU_FAVORITO: { title: "Seu favorito", Icon: Heart },
  NOVIDADE_PARA_VOCE: { title: "Novidade para você", Icon: Sparkles },
};

// Ícones só decoram o selo; o motivo em si é o texto que veio em `reasons`.
export const REASON_ICON: Record<Reason["kind"], LucideIcon> = {
  rating: Star, price: Tag, delivery_time: Clock, distance: MapPin,
  promo: Tag, times_ordered: History, new_for_you: Sparkles, curated: BadgeCheck,
};

// Uma frase com os motivos que o servidor enviou; a UI não acrescenta nenhum.
function reasonSentence(reasons: Reason[]) {
  const parts = reasons.slice(0, 3).map((r) => r.text);
  if (parts.length === 0) return "";
  const text = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

type Props = {
  option: Option;
  first: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onAdjust: () => void;
};

// Cartão compacto no formato da busca do iFood. Só o cartão tocado expande; selecionar e aprovar são
// eventos diferentes (aprovar só existe na revisão da proposta).
export function ResultCard({ option, first, expanded, disabled, onToggle, onSelect, onAdjust }: Readonly<Props>) {
  const { title, Icon } = LABELS[option.label];
  const c = option.candidate;
  const price = c.promotionalPrice ?? c.price;
  const panelId = `motivo-${c.itemId}`;

  const fee = c.deliveryFee === undefined ? "Frete não informado" : c.deliveryFee === 0 ? "Frete grátis" : `Frete ${fromReais(c.deliveryFee)}`;
  const rating = c.rating?.toFixed(1).replace(".", ",");

  return (
    <div className={cn("rounded-[20px] border bg-card shadow-sm transition-colors", expanded ? "border-[1.5px] border-brand" : "border-transparent")}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${title}: ${c.itemName}, ${c.merchantName}, ${fromReais(price)}`}
        onClick={onToggle}
        className="flex w-full items-start gap-3 rounded-[20px] p-3 text-left"
      >
        {/* Sem logos reais na demo: ícone neutro com cor estável por loja (o contrato ainda não traz a categoria). */}
        <StoreLogo seed={c.merchantId} className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-medium leading-tight">{c.merchantName}</span>
          {/* Cada trecho não quebra por dentro; a linha só quebra entre eles. */}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] text-muted-foreground">
            {rating !== undefined && (
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap"><Star className="size-3" aria-hidden="true" />{rating}</span>
            )}
            {c.deliveryTimeMinutes !== undefined && <span className="whitespace-nowrap">· {c.deliveryTimeMinutes} min</span>}
            <span className={cn("whitespace-nowrap", c.deliveryFee === 0 && "font-semibold text-success-foreground")}>· {fee}</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-lg font-medium leading-tight">{fromReais(price)}</span>
          <span className="block max-w-20 truncate text-xs text-muted-foreground">{c.itemName}</span>
        </span>
      </button>

      <div className="px-3 pb-3">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", first ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
          <Icon className="size-3.5" aria-hidden="true" /> {title}
        </span>
      </div>

      {expanded && (
        <div id={panelId} className="px-3 pb-3">
          <p className="text-sm leading-snug text-[color:var(--agent-voice)]">{reasonSentence(option.reasons)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onAdjust}>Ajustar</Button>
            <Button disabled={disabled} onClick={onSelect}>Selecionar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResultCardSkeleton() {
  return (
    <div className="flex animate-pulse items-start gap-3 rounded-[20px] bg-card p-3 shadow-sm motion-reduce:animate-none" aria-hidden="true">
      <span className="size-11 shrink-0 rounded-xl bg-secondary" />
      <span className="grid flex-1 gap-2">
        <span className="h-4 w-1/2 rounded bg-secondary" />
        <span className="h-3 w-3/4 rounded bg-secondary" />
        <span className="h-5 w-24 rounded-full bg-secondary" />
      </span>
    </div>
  );
}
