import type { CSSProperties } from "react";
import { Orb, type OrbState } from "@/ui/components/orb";

// Palco decorativo ao redor do orbe. Todo o movimento é CSS (ver globals.css) e respeita
// prefers-reduced-motion; o estado também é dito em texto na tela, então nada aqui é a única indicação.
// A ordem dos filhos importa: o CSS usa nth-of-type (halo, 4 contornos, 3 ondas).
// `compact` encolhe o palco (o tamanho anima por CSS) quando o orbe desce para o painel da conversa.
export function OrbStage({ state, compact = false }: { state: OrbState; compact?: boolean }) {
  return (
    <div className="orb-stage" data-state={state} aria-hidden="true" style={{ "--stage": compact ? "8.5rem" : "18rem" } as CSSProperties}>
      <div className="orb-halo" />
      <div className="orb-contour" />
      <div className="orb-contour" />
      <div className="orb-contour" />
      <div className="orb-contour" />
      <div className="orb-wave" />
      <div className="orb-wave" />
      <div className="orb-wave" />
      <div className="!rounded-none inset-0 flex items-center justify-center">
        <Orb state={state} className="size-[56%]" />
      </div>
    </div>
  );
}
