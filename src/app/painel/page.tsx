import type { Metadata } from "next";
import { PainelSinais } from "@/ui/painel/painel-sinais";

export const metadata: Metadata = { title: "O que o Mimo aprende" };

export default function PainelPage() {
  return <PainelSinais />;
}
