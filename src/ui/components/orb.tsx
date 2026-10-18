import * as React from "react";
import { cn } from "@/ui/lib/utils";

// Orbe do assistente. Puramente visual: o estado (ouvindo, pensando...) entra no PR da tela do agente.
function Orb({ className, pulse = false, ...props }: React.ComponentProps<"span"> & { pulse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("orb relative block rounded-full", pulse && "orb-pulse", className)}
      {...props}
    />
  );
}

export { Orb };
