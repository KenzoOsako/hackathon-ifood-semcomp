import type { Metadata } from "next";
import { ProposalScreen } from "@/ui/agent/proposal-screen";

export const metadata: Metadata = { title: "Revise sua proposta · FoodPilot" };

export default function PropostaPage() {
  return <ProposalScreen />;
}
