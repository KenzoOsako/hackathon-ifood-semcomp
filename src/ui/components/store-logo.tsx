import type { CSSProperties } from "react";
import Image from "next/image";
import { Utensils, type LucideIcon } from "lucide-react";
import { cn } from "@/ui/lib/utils";

// Sem imagens na demo: a "logo" da loja é um ícone sobre uma cor suave (tokens --cat-N-bg/fg em globals.css).
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
  // Imagem da loja (só o mock tem); sem ela, vale o ícone sobre cor suave.
  imageSrc?: string;
  className?: string;
};

// Logo redonda compartilhada pela home (cenário) e pelos resultados. Quando o contrato trouxer a categoria
// da loja, basta passar o ícone certo; hoje os resultados usam o ícone neutro.
export function StoreLogo({ icon: Icon = Utensils, tone, seed = "", shape = "round", imageSrc, className }: Readonly<Props>) {
  const n = tone ?? toneFromSeed(seed);
  return (
    <span
      aria-hidden="true"
      className={cn("relative flex size-12 shrink-0 items-center justify-center overflow-hidden", shape === "round" ? "rounded-full" : "rounded-2xl border border-border", className)}
      style={{ background: `var(--cat-${n}-bg)`, color: `var(--cat-${n}-fg)` } as CSSProperties}
    >
      {imageSrc ? <Image src={imageSrc} alt="" fill sizes="72px" className="object-cover" /> : <Icon className="size-1/2" />}
    </span>
  );
}
