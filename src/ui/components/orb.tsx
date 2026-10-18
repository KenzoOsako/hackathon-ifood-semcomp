import type { CSSProperties } from "react";
import { cn } from "@/ui/lib/utils";
import { OrbWaves } from "./orb-waves";

// Estados que a voz (Felipe) e o agente acionam. Sempre acompanhados de texto na tela.
export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";
// fab: botão flutuante da home (só o núcleo) · hero: abertura do agente · strip: faixa dos resultados
// · mini: faixa compacta da revisão (só o núcleo).
export type OrbSize = "fab" | "hero" | "strip" | "mini";

const DIAMETER: Record<OrbSize, string> = { fab: "4rem", hero: "9.5rem", strip: "4rem", mini: "2.5rem" };

type OrbProps = { size?: OrbSize; state?: OrbState; className?: string };

// Um só orbe para as três telas. O tamanho anima por CSS (--orb-d) quando a tela troca de hero para strip.
export function Orb({ size = "hero", state = "idle", className }: Readonly<OrbProps>) {
  const full = size === "hero" || size === "strip";
  return (
    <span
      aria-hidden="true"
      className={cn("orb-scene", className)}
      data-size={size}
      data-state={state}
      style={{ "--orb-d": DIAMETER[size] } as CSSProperties}
    >
      {full && <OrbWaves />}
      {full && (
        <>
          <span className="orb-ring" />
          <span className="orb-ring" />
          <span className="orb-ring" />
        </>
      )}
      <span className="orb-core" />
    </span>
  );
}
