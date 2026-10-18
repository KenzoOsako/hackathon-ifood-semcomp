"use client";
import { useState } from "react";
import Link from "next/link";
import { CircleCheck, ClipboardCopy, Info } from "lucide-react";
import type { Option, PublicProposal } from "@/contracts";
import { Alert } from "@/ui/components/alert";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { useFocusOnMount } from "@/ui/lib/use-focus-on-mount";
import { DATA_ORIGIN } from "./agent-context";
import { fromCents, itemLabel } from "./format";

// Resumo copiável para montar o carrinho no iFood. Só reorganiza campos do snapshot aprovado:
// o que o servidor não informou aparece como pendente, nunca como zero.
export function buildSummary(proposal: PublicProposal, option: Option | null, itemNames?: Record<string, string>): string {
  const { cost } = proposal;
  const money = (m: { cents: number } | undefined, missing: string) => (m ? fromCents(m.cents) : missing);
  const items = proposal.items.map((item) => {
    return `${item.quantity}× ${itemLabel(item.ref, option, itemNames)} — ${fromCents(item.unitPrice.cents)}`;
  });
  return [
    DATA_ORIGIN === "mock" ? "Resumo do FoodPilot (dados simulados)" : "Resumo do FoodPilot",
    option ? `Loja: ${option.candidate.merchantName}` : null,
    ...items,
    `Itens: ${fromCents(cost.items.cents)}`,
    `Frete: ${money(cost.delivery, "não informado")}`,
    `Taxas: ${money(cost.fees, "não informadas")}`,
    `Total: ${money(cost.total, "pendente")}`,
    `Proposta ${proposal.id}, versão ${proposal.version}`,
  ].filter((line): line is string => line !== null).join("\n");
}

type Props = { proposal: PublicProposal; option: Option | null; itemNames?: Record<string, string>; embedded?: boolean; onNewSearch: () => void };

export function ContinueView({ proposal, option, itemNames, onNewSearch }: Props) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const summary = buildSummary(proposal, option, itemNames);

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied("ok");
    } catch {
      // Sem permissão de área de transferência: o texto continua selecionável na tela.
      setCopied("fail");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-lg font-bold outline-none">Continue no iFood</h1>
        {DATA_ORIGIN === "mock" && <Badge variant="simulated" className="ml-auto">Simulado</Badge>}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-1 size-6 shrink-0 text-success-foreground" aria-hidden="true" />
          <div>
            <p className="font-display text-2xl font-bold leading-tight">Proposta aprovada</p>
            <p className="mt-1 text-sm text-muted-foreground">Nenhum pedido foi enviado. A compra é finalizada por você no iFood.</p>
          </div>
        </div>

        <ol className="mt-5 grid gap-4 text-sm">
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground" aria-hidden="true">1</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Copie o resumo</p>
              <pre aria-label="Resumo da proposta" className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-muted p-3 font-sans text-sm">{summary}</pre>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void copy()}>
                <ClipboardCopy /> Copiar resumo
              </Button>
              <p role="status" aria-live="polite" className="mt-1 min-h-5 text-xs text-muted-foreground">
                {copied === "ok" && "Resumo copiado."}
                {copied === "fail" && "Não consegui copiar. Selecione o texto acima e copie manualmente."}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground" aria-hidden="true">2</span>
            <div>
              <p className="font-semibold">Monte o carrinho no iFood</p>
              <p className="text-muted-foreground">Abra o app do iFood, procure a loja e adicione os itens do resumo.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground" aria-hidden="true">3</span>
            <div>
              <p className="font-semibold">Confira e finalize lá</p>
              <p className="text-muted-foreground">Endereço, taxas e pagamento são confirmados no iFood.</p>
            </div>
          </li>
        </ol>

        <Alert className="mt-5">
          <Info aria-hidden="true" />
          <p>A transferência automática do carrinho ainda não está disponível nesta demonstração.</p>
        </Alert>
      </main>

      <footer className="grid gap-2 border-t border-border bg-background px-4 pb-4 pt-3">
        <Button onClick={onNewSearch}>Fazer outra busca</Button>
        <Button asChild variant="ghost"><Link href="/">Voltar ao início</Link></Button>
      </footer>
    </div>
  );
}
