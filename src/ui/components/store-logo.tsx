import type { CSSProperties } from "react";
import { CatalogImage } from "./catalog-image";
import { catalogImage } from "@/ui/lib/catalog-media";
import { Utensils, type LucideIcon } from "lucide-react";
import { cn } from "@/ui/lib/utils";

// Ausência de mídia usa um ícone com cor estável por loja.
const TONES = 6;

function toneFromSeed(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return (hash % TONES) + 1;
}

type Props = {
  icon?: LucideIcon;
  // Tom explícito (1 a 6) ou semente estável (ex.: merchantId), para a mesma loja ter sempre a mesma cor.
  tone?: number;
  seed?: string;
  // round: círculo (home) · square: quadrado arredondado com borda, como o logo das lojas no iFood.
  shape?: "round" | "square";
  // Logo do catálogo ou asset de demonstração; sem ele, vale o ícone neutro.
  imageSrc?: string;
  className?: string;
};

// Logo redonda compartilhada pela home (cenário) e pelos resultados. Quando o contrato trouxer a categoria
// da loja, basta passar o ícone certo; hoje os resultados usam o ícone neutro.
export function StoreLogo({ icon: Icon = Utensils, tone, seed = "", shape = "round", imageSrc, className }: Readonly<Props>) {
  const n = tone ?? toneFromSeed(seed);
  const safeSrc = imageSrc?.startsWith("/exemplos/") ? imageSrc : catalogImage(imageSrc);
  return (
    <span
      aria-hidden="true"
      className={cn("relative flex size-12 shrink-0 items-center justify-center overflow-hidden", shape === "round" ? "rounded-full" : "rounded-2xl border border-border", className)}
      style={{ background: `var(--cat-${n}-bg)`, color: `var(--cat-${n}-fg)` } as CSSProperties}
    >
      {safeSrc ? <CatalogImage key={safeSrc} src={safeSrc} alt="" sizes="72px" /> : <Icon className="size-1/2" />}
    </span>
  );
}
