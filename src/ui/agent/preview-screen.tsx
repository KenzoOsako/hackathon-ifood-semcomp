"use client";
import { useState } from "react";
import type { Option, PublicProposal } from "@/contracts";
import { Button } from "@/ui/components/button";
import { useNow } from "@/ui/lib/use-now";
import { ContinueView } from "./continue-view";
import { OptionsView } from "./options-screen";
import { ProposalView } from "./proposal-view";

// Prévia de design com dados fixos e inventados (nenhuma loja ou preço é real). O mock do servidor tem
// poucas lojas e toda proposta nasce com pendências, então esta tela é a forma de ver como ficaria com
// mais variedade e com o estado aprovável. Nada daqui chama a API.
const OPTIONS: Option[] = [
  {
    label: "MAIS_BARATA",
    candidate: { merchantId: "m1", merchantName: "Açaí Tropical", itemId: "a1", itemName: "Açaí 500 ml com 3 acompanhamentos", price: 18.9, deliveryFee: 3.99, rating: 4.6, deliveryTimeMinutes: 25, distanceKm: 1.2 },
    reasons: [
      { kind: "price", value: 18.9, text: "R$ 18,90 no item" },
      { kind: "rating", value: 4.6, text: "nota 4,6" },
      { kind: "delivery_time", value: 25, text: "entrega em cerca de 25 min" },
      { kind: "distance", value: 1.2, text: "a 1,2 km de você" },
    ],
  },
  {
    label: "MAIS_RAPIDA",
    candidate: { merchantId: "m2", merchantName: "Burger do Bairro", itemId: "b1", itemName: "Combo smash duplo com batata", price: 32.5, deliveryFee: 2.99, rating: 4.4, deliveryTimeMinutes: 15, distanceKm: 0.8 },
    reasons: [
      { kind: "delivery_time", value: 15, text: "entrega em cerca de 15 min" },
      { kind: "distance", value: 0.8, text: "a 800 m de você" },
      { kind: "times_ordered", value: 3, text: "você já pediu aqui 3 vezes" },
    ],
  },
  {
    label: "MELHOR_AVALIADA",
    candidate: { merchantId: "m3", merchantName: "Sushi Hana", itemId: "s1", itemName: "Combo 20 peças variadas", price: 54.9, promotionalPrice: 49.9, deliveryFee: 5.9, rating: 4.9, deliveryTimeMinutes: 40, distanceKm: 2.6 },
    reasons: [
      { kind: "rating", value: 4.9, text: "nota 4,9" },
      { kind: "promo", value: true, text: "em promoção hoje" },
      { kind: "new_for_you", value: true, text: "você ainda não pediu aqui" },
    ],
  },
];

// Proposta com vários itens da mesma loja; os nomes vêm de um mapa porque o snapshot só traz a referência.
const ITEM_NAMES = { i1: "Pizza calabresa grande", i2: "Refrigerante 2 L", i3: "Brownie com sorvete" };
const BASE: PublicProposal = {
  id: "prévia-1",
  version: 1,
  state: "awaiting_approval",
  items: [
    { ref: "i1", quantity: 1, unitPrice: { currency: "BRL", cents: 3990 } },
    { ref: "i2", quantity: 1, unitPrice: { currency: "BRL", cents: 1200 } },
    { ref: "i3", quantity: 2, unitPrice: { currency: "BRL", cents: 950 } },
  ],
  cost: { items: { currency: "BRL", cents: 7090 }, delivery: { currency: "BRL", cents: 499 }, fees: { currency: "BRL", cents: 150 }, total: { currency: "BRL", cents: 7739 }, status: "confirmed" },
  unresolved: [],
  expiresAt: "",
};
const STORE: Option = {
  label: "SEU_FAVORITO",
  candidate: { merchantId: "m4", merchantName: "Cantina da Praça", itemId: "i1", itemName: ITEM_NAMES.i1, price: 39.9 },
  reasons: [{ kind: "times_ordered", value: 5, text: "você já pediu aqui 5 vezes" }],
};

type Scenario = "opcoes" | "aprovavel" | "pendente" | "expirada" | "aprovada";
const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "opcoes", label: "3 opções" },
  { id: "aprovavel", label: "Proposta" },
  { id: "pendente", label: "Com pendências" },
  { id: "expirada", label: "Expirada" },
  { id: "aprovada", label: "Aprovada" },
];

export function PreviewScreen() {
  const [scenario, setScenario] = useState<Scenario>("opcoes");
  const now = useNow(60_000);
  if (now === null) return null;
  const soon = new Date(now + 5 * 60_000).toISOString();

  const PROPOSALS: Record<Exclude<Scenario, "opcoes">, PublicProposal> = {
    aprovavel: { ...BASE, expiresAt: soon },
    pendente: { ...BASE, expiresAt: soon, cost: { items: BASE.cost.items, status: "unknown" }, unresolved: ["Taxas e total não confirmados", "Frete desconhecido"] },
    expirada: { ...BASE, expiresAt: "2000-01-01T00:00:00.000Z" },
    aprovada: { ...BASE, state: "approved", expiresAt: soon },
  };

  let screen;
  if (scenario === "opcoes") {
    screen = <OptionsView options={OPTIONS} busy={false} error={null} onSelect={() => setScenario("aprovavel")} onRetry={() => {}} />;
  } else if (scenario === "aprovada") {
    screen = <ContinueView proposal={PROPOSALS.aprovada} option={STORE} itemNames={ITEM_NAMES} />;
  } else {
    screen = (
      <ProposalView
        proposal={PROPOSALS[scenario]}
        option={STORE}
        itemNames={ITEM_NAMES}
        busy={false}
        error={null}
        onApprove={() => setScenario("aprovada")}
        onCancel={() => {}}
        onRetry={() => {}}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="group" aria-label="Cenário da prévia" className="flex flex-wrap gap-1.5 bg-muted px-3 py-2">
        {SCENARIOS.map((s) => (
          <Button key={s.id} size="sm" variant={scenario === s.id ? "default" : "outline"} aria-pressed={scenario === s.id} onClick={() => setScenario(s.id)}>
            {s.label}
          </Button>
        ))}
      </div>
      {screen}
    </div>
  );
}
