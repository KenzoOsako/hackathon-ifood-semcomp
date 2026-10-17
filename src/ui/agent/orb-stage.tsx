import { Orb, type OrbState } from "@/ui/components/orb";

// Palco decorativo ao redor do orbe. Todo o movimento é CSS (ver globals.css) e respeita
// prefers-reduced-motion; o estado também é dito em texto na tela, então nada aqui é a única indicação.
export function OrbStage({ state }: { state: OrbState }) {
  return (
    <div className="orb-stage" data-state={state} aria-hidden="true">
      <div className="orb-halo" />
      <div className="orb-blob" />
      <div className="orb-blob" />
      <div className="orb-wave" />
      <div className="orb-wave" />
      <div className="orb-wave" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Orb state={state} className="size-40" />
      </div>
    </div>
  );
}
