import type { OrbState } from "@/ui/components/orb";

const WIDTH = 800; // duas repetições de um ciclo de 400
const STEP = 10;

// Seno com `cycles` ciclos por 400 unidades, então o desenho se repete sem emenda a cada 400.
function wavePath(base: number, amp: number, cycles: number, phase: number) {
  let d = "";
  for (let x = 0; x <= WIDTH; x += STEP) {
    const y = base + amp * Math.sin((2 * Math.PI * cycles * x) / 400 + phase);
    d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)} `;
  }
  return d;
}

// Duração (s), sentido e opacidade variam por linha para as ondas não andarem em bloco.
const LINES = [
  { base: 34, amp: 7, cycles: 1, phase: 0, opacity: 0.3, duration: 16, reverse: false },
  { base: 52, amp: 9, cycles: 1, phase: 1.5, opacity: 0.26, duration: 20, reverse: true },
  { base: 70, amp: 7, cycles: 2, phase: 0.7, opacity: 0.38, duration: 12, reverse: false },
  { base: 88, amp: 10, cycles: 1, phase: 3, opacity: 0.3, duration: 18, reverse: true },
  { base: 106, amp: 6, cycles: 2, phase: 2, opacity: 0.45, duration: 10, reverse: false },
];

// Fundo decorativo; o estado do assistente também é dito em texto, então isto nunca é a única indicação.
export function WaveField({ state }: { state: OrbState }) {
  return (
    <div className="wave-field" data-state={state} aria-hidden="true">
      {LINES.map((l) => (
        <svg
          key={l.base}
          className="wave-line"
          viewBox={`0 0 ${WIDTH} 130`}
          preserveAspectRatio="none"
          style={{ animationDuration: `${l.duration}s`, animationDirection: l.reverse ? "reverse" : "normal", opacity: l.opacity }}
        >
          <path d={wavePath(l.base, l.amp, l.cycles, l.phase)} fill="none" stroke="var(--primary)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
      ))}
    </div>
  );
}
