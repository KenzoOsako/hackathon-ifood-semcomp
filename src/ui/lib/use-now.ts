"use client";
import { useEffect, useState } from "react";

// Relógio só no cliente: devolve null até montar, para não divergir entre servidor e navegador
// (o prerender do Next não aceita Date.now() no render).
export function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
