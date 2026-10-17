"use client";
import { useState } from "react";
import type { Option, PublicProposal } from "@/contracts";
import { Button } from "@/ui/components/button";
import { useNow } from "@/ui/lib/use-now";
import { ProposalView } from "./proposal-view";

// Prévia de design com dados fixos. O mock do servidor ainda não gera proposta com total confirmado
// (toda proposta nasce com pendências), então esta tela é a única forma de ver o estado aprovável.
// Nada daqui chama a API; é só para revisar o visual dos estados.
const OPTION: Option = {
  label: "MAIS_BARATA",
  candidate: { merchantId: "m1", merchantName: "Cantina da Praça", itemId: "i1", itemName: "Pizza calabresa grande", price: 39.9 },
  reasons: [{ kind: "price", value: 39.9, text: "Dentro do orçamento informado" }],
};

const BASE: PublicProposal = {
  id: "prévia-1",
  version: 1,
  state: "awaiting_approval",
  items: [{ ref: "i1", quantity: 1, unitPrice: { currency: "BRL", cents: 3990 } }],
  cost: { items: { currency: "BRL", cents: 3990 }, delivery: { currency: "BRL", cents: 499 }, fees: { currency: "BRL", cents: 150 }, total: { currency: "BRL", cents: 5639 }, status: "confirmed" },
  unresolved: [],
  expiresAt: "",
};

type Scenario = "aprovavel" | "pendente" | "expirada" | "aprovada";
const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "aprovavel", label: "Aprovável" },
  { id: "pendente", label: "Com pendências" },
  { id: "expirada", label: "Expirada" },
  { id: "aprovada", label: "Aprovada" },
];

export function PreviewScreen() {
  const [scenario, setScenario] = useState<Scenario>("aprovavel");
  const now = useNow(60_000);
  if (now === null) return null;
  const soon = new Date(now + 5 * 60_000).toISOString();

  const proposal: PublicProposal =
    scenario === "pendente"
      ? { ...BASE, expiresAt: soon, cost: { items: BASE.cost.items, status: "unknown" }, unresolved: ["Taxas e total não confirmados", "Frete desconhecido"] }
      : scenario === "expirada" ? { ...BASE, expiresAt: "2000-01-01T00:00:00.000Z" }
      : scenario === "aprovada" ? { ...BASE, state: "approved", expiresAt: soon }
      : { ...BASE, expiresAt: soon };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="group" aria-label="Cenário da prévia" className="flex flex-wrap gap-1.5 bg-muted px-3 py-2">
        {SCENARIOS.map((s) => (
          <Button key={s.id} size="sm" variant={scenario === s.id ? "default" : "outline"} aria-pressed={scenario === s.id} onClick={() => setScenario(s.id)}>
            {s.label}
          </Button>
        ))}
      </div>
      <ProposalView
        proposal={proposal}
        option={OPTION}
        busy={false}
        error={null}
        approvedReply="Confira os itens e finalize a compra no iFood."
        onApprove={() => setScenario("aprovada")}
        onCancel={() => {}}
        onRetry={() => {}}
      />
    </div>
  );
}
