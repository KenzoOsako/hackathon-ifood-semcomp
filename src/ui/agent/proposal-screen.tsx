"use client";
import Link from "next/link";
import { Button } from "@/ui/components/button";
import { useAgent } from "./agent-context";
import { ProposalView } from "./proposal-view";

export function ProposalScreen() {
  const { turn, selected, busy, error, approve, cancel, retry } = useAgent();
  const proposal = turn?.proposal;

  // Sem proposta (página recarregada, cancelada ou nova busca): volta ao início da conversa.
  if (!proposal) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-xl font-bold">Nenhuma proposta aberta</p>
        <p className="max-w-64 text-sm text-muted-foreground">Conte o que você quer comer para gerar uma nova.</p>
        <Button asChild><Link href="/agente">Falar com o FoodPilot</Link></Button>
      </div>
    );
  }

  return (
    <ProposalView
      proposal={proposal}
      option={selected}
      busy={busy}
      error={error}
      approvedReply={turn.state === "PROPOSTA_APROVADA" ? turn.reply : undefined}
      onApprove={() => void approve()}
      onCancel={() => void cancel()}
      onRetry={() => void retry()}
    />
  );
}
