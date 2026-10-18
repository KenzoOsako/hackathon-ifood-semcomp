const WIDTH = 800; // duas repetições de um ciclo de 400
const STEP = 10;

// Seno com `cycles` ciclos por 400 unidades, então o desenho se repete sem emenda a cada 400.
function wavePath(amp: number, cycles: number, phase: number) {
  let d = "";
  for (let x = 0; x <= WIDTH; x += STEP) {
    const y = 50 + amp * Math.sin((2 * Math.PI * cycles * x) / 400 + phase);
    d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)} `;
  }
  return d;
}

// Cor, espessura, opacidade e duração (7, 10 e 13 s) variam por linha para as ondas não andarem em bloco.
const LINES = [
  { color: "var(--orb-wave-1)", width: 1.6, opacity: 0.55, duration: 7, amp: 26, cycles: 1, phase: 0 },
  { color: "var(--orb-wave-2)", width: 1.2, opacity: 0.45, duration: 10, amp: 20, cycles: 2, phase: 1.3 },
  { color: "var(--orb-wave-3)", width: 1, opacity: 0.4, duration: 13, amp: 30, cycles: 1, phase: 2.6 },
];

// Decorativo: o estado do assistente é dito em texto, então isto nunca é a única indicação.
export function OrbWaves() {
  return (
    <span className="orb-waves" aria-hidden="true">
      {LINES.map((l) => (
        <svg key={l.color} className="orb-wave" viewBox={`0 0 ${WIDTH} 100`} preserveAspectRatio="none" style={{ animationDuration: `${l.duration}s`, opacity: l.opacity }}>
          <path d={wavePath(l.amp, l.cycles, l.phase)} fill="none" stroke={l.color} strokeWidth={l.width} vectorEffect="non-scaling-stroke" />
        </svg>
      ))}
    </span>
  );
}
