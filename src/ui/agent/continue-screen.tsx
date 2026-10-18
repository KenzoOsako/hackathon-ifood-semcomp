"use client";
import Link from "next/link";
import { Button } from "@/ui/components/button";
import { useAgent } from "./agent-context";
import { ContinueView } from "./continue-view";

export function ContinueScreen() {
  const { turn, selected } = useAgent();
  const proposal = turn?.proposal;

  // Só mostra esta tela com proposta aprovada pelo servidor; recarregar a página reinicia a conversa.
  if (turn?.state !== "PROPOSTA_APROVADA" || !proposal) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-xl font-bold">Nenhuma proposta aprovada</p>
        <p className="max-w-64 text-sm text-muted-foreground">Aprove uma proposta para ver como continuar no iFood.</p>
        <Button asChild><Link href="/agente">Falar com o FoodPilot</Link></Button>
      </div>
    );
  }

  return <ContinueView proposal={proposal} option={selected} />;
}
