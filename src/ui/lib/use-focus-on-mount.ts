"use client";
import { useEffect, useRef } from "react";

// Ao trocar de tela o foco volta ao topo do documento; levamos o foco ao título para que leitor de tela
// e teclado saibam em que tela estão. O elemento precisa de tabIndex={-1}.
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
