import type { Metadata } from "next";
import { PreviewScreen } from "@/ui/agent/preview-screen";

export const metadata: Metadata = { title: "Prévia de design · FoodPilot" };

export default function PreviaPage() {
  return <PreviewScreen />;
}
