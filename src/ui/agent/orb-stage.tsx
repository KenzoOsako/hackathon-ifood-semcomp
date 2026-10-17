import { Orb, type OrbState } from "@/ui/components/orb";

// Palco decorativo ao redor do orbe. Todo o movimento é CSS (ver globals.css) e respeita
// prefers-reduced-motion; o estado também é dito em texto na tela, então nada aqui é a única indicação.
export function OrbStage({ state }: { state: OrbState }) {
  return (
    <div className="orb-stage" data-state={state} aria-hidden="true">
      <div className="orb-halo" />
      <div className="orb-ring orb-ring-outer" />
      <div className="orb-ring orb-ring-mid" />
      <div className="orb-ripple" />
      <div className="orb-ripple" />
      <div className="orbit">
        <i style={{ left: "97%", top: "67%", width: 10, height: 10, background: "var(--primary)" }} />
        <i style={{ left: "12%", top: "82%", width: 7, height: 7, background: "color-mix(in srgb, var(--brand) 55%, transparent)" }} />
        <i style={{ left: "33%", top: "3%", width: 8, height: 8, background: "var(--background)", border: "2px solid var(--brand)" }} />
      </div>
      <div className="orbit orbit-inner">
        <i style={{ left: "50%", top: "0%", width: 6, height: 6, background: "color-mix(in srgb, var(--primary) 45%, transparent)" }} />
        <i style={{ left: "88%", top: "78%", width: 8, height: 8, background: "var(--accent)", border: "1.5px solid var(--primary)" }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Orb state={state} className="size-40" />
      </div>
    </div>
  );
}
