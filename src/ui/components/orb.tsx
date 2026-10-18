"use client";
import * as React from "react";
import { motion, useReducedMotion, type MotionProps } from "motion/react";
import { cn } from "@/ui/lib/utils";

// Estados que a voz (Felipe) e o agente vão acionar. Sempre acompanhados de texto na tela:
// o orbe sozinho não pode ser a única indicação do estado.
export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

const MOTION: Record<OrbState, MotionProps> = {
  idle: { animate: { scale: [1, 1.04, 1] }, transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } },
  listening: { animate: { scale: [1, 1.12, 1] }, transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } },
  // O brilho do gradiente gira junto com o elemento, o que lê como "processando".
  thinking: { animate: { rotate: 360 }, transition: { duration: 1.6, repeat: Infinity, ease: "linear" } },
  speaking: { animate: { scale: [1, 1.09, 0.98, 1.06, 1] }, transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" } },
  error: { animate: { x: [0, -6, 6, -4, 4, 0] }, transition: { duration: 0.4 } },
};

type OrbProps = { className?: string; pulse?: boolean; state?: OrbState };

// Sem `state`, é um orbe decorativo (a bolinha da home); com `state`, anima conforme o estado.
function Orb({ className, pulse = false, state }: Readonly<OrbProps>) {
  const reduceMotion = useReducedMotion();
  const classes = cn("orb", pulse && "orb-pulse", state === "error" && "opacity-60 grayscale", className);
  if (!state || reduceMotion) return <span aria-hidden="true" className={classes} />;
  return <motion.span key={state} aria-hidden="true" className={classes} {...MOTION[state]} />;
}

export { Orb };
