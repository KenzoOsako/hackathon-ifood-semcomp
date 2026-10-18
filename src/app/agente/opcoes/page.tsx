import type { Metadata } from "next";
import { OptionsScreen } from "@/ui/agent/options-screen";

export const metadata: Metadata = { title: "Opções · FoodPilot" };

export default function OpcoesPage() {
  return <OptionsScreen />;
}
