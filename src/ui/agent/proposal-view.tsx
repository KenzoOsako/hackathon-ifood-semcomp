"use client";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CircleCheck, Hourglass, Info } from "lucide-react";
import type { Option, PublicProposal } from "@/contracts";
import { Alert } from "@/ui/components/alert";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { useFocusOnMount } from "@/ui/lib/use-focus-on-mount";
import { useNow } from "@/ui/lib/use-now";
import { DATA_ORIGIN } from "./agent-context";
import { fromCents, itemLabel } from "./format";

const STATE_LABEL: Record<PublicProposal["state"], string> = {
  draft: "Rascunho",
  awaiting_approval: "Aguardando sua aprovação",
  approved: "Aprovada",
  invalidated: "Substituída por outra versão",
  cancelled: "Cancelada",
  expired: "Expirada",
};

type Props = {
  proposal: PublicProposal;
  option: Option | null;
  itemNames?: Record<string, string>;
  busy: boolean;
  error: string | null;
  embedded?: boolean;
  approvedReply?: string;
  onApprove: () => void;
  onCancel: () => void;
  onEditOrder: () => void;
  onRetry: () => void;
};

// Mostra o snapshot da proposta como veio do servidor. Aprovar, editar e cancelar são ações separadas
// e a UI nunca soma custos: ausência de frete/taxas aparece como pendência, não como zero.
export function ProposalView({ proposal, option, itemNames, busy, error, embedded = false, approvedReply, onApprove, onCancel, onEditOrder, onRetry }: Props) {
  const now = useNow(15_000);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  const expiresAt = Date.parse(proposal.expiresAt);
  const expired = proposal.state === "expired" || (now !== null && now > expiresAt);
  const approved = proposal.state === "approved";
  const open = proposal.state === "awaiting_approval" && !expired;
  const blockers = proposal.cost.status === "unknown" || proposal.unresolved.length > 0;
  const { cost } = proposal;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        {!embedded && (
          <Button asChild variant="ghost" size="icon" aria-label="Voltar para o início">
            <Link href="/"><ArrowLeft /></Link>
          </Button>
        )}
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-lg font-bold outline-none">{approved ? "Proposta aprovada" : "Revise sua proposta"}</h1>
        {DATA_ORIGIN === "mock" && <Badge variant="simulated" className="ml-auto">Simulado</Badge>}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {approved ? <CircleCheck className="size-4 text-success-foreground" aria-hidden="true" /> : <Hourglass className="size-4" aria-hidden="true" />}
          {expired && !approved ? STATE_LABEL.expired : STATE_LABEL[proposal.state]}
          {now !== null && open && (
            <span className="ml-auto font-normal text-muted-foreground">
              válida até {new Date(expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {option && <p className="mt-3 font-display text-2xl font-bold leading-tight">{option.candidate.merchantName}</p>}

        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
          {proposal.items.map((item) => {
            const name = itemLabel(item.ref, option, itemNames);
            return (
              <li key={item.ref} className="flex justify-between gap-3 p-3 text-sm">
                <span>{item.quantity}× {name}</span>
                <span className="font-semibold">{fromCents(item.unitPrice.cents)}{item.quantity > 1 && <span className="font-normal text-muted-foreground"> cada</span>}</span>
              </li>
            );
          })}
        </ul>

        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 text-sm [&>dt]:pr-3">
          <dt className="text-muted-foreground">Itens</dt>
          <dd>{fromCents(cost.items.cents)}</dd>
          <dt className="text-muted-foreground">Frete</dt>
          <dd>{cost.delivery ? fromCents(cost.delivery.cents) : <span className="text-warning-foreground">Não informado</span>}</dd>
          <dt className="text-muted-foreground">Taxas</dt>
          <dd>{cost.fees ? fromCents(cost.fees.cents) : <span className="text-warning-foreground">Não informadas</span>}</dd>
          <dt className="border-t border-border pt-2 font-semibold">Total</dt>
          <dd className="border-t border-border pt-2 font-display text-xl font-bold">
            {cost.total ? fromCents(cost.total.cents) : <span className="text-base text-warning-foreground">Pendente</span>}
          </dd>
        </dl>
        {cost.total && <p className="mt-1 text-right text-xs text-muted-foreground">{cost.status === "confirmed" ? "Valor confirmado" : "Valor estimado"}</p>}

        {!approved && blockers && (
          <Alert variant="warning" className="mt-4">
            <Info aria-hidden="true" />
            <div>
              <p className="font-semibold">Ainda não dá para aprovar</p>
              <ul className="mt-1 list-disc pl-4">{proposal.unresolved.map((u) => <li key={u}>{u}</li>)}</ul>
            </div>
          </Alert>
        )}

        {expired && !approved && (
          <Alert variant="warning" className="mt-4">
            <Hourglass aria-hidden="true" />
            <p>Esta proposta expirou. Faça uma nova busca para gerar outra.</p>
          </Alert>
        )}

        {approved && (
          <Alert className="mt-4">
            <CircleCheck aria-hidden="true" />
            <div>
              <p className="font-semibold">Proposta aprovada. Nenhum pedido foi enviado.</p>
              {approvedReply && <p className="mt-1 whitespace-pre-wrap">{approvedReply}</p>}
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle aria-hidden="true" />
            <div className="flex-1">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" disabled={busy} onClick={onRetry}>Tentar de novo</Button>
            </div>
          </Alert>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          O FoodPilot prepara a proposta; a compra é finalizada no iFood.
        </p>
      </main>

      {!approved && (
        <footer className="grid gap-2 border-t border-border bg-background px-4 pb-4 pt-3">
          <Button disabled={!open || blockers || busy} onClick={onApprove}>Aprovar proposta</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={onEditOrder}>Mudar o pedido</Button>
            <Button variant="ghost" disabled={busy || proposal.state === "cancelled"} onClick={onCancel}>Cancelar proposta</Button>
          </div>
        </footer>
      )}
    </div>
  );
}
