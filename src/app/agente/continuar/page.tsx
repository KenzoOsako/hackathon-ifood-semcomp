import type { Metadata } from "next";
import { ContinueScreen } from "@/ui/agent/continue-screen";

export const metadata: Metadata = { title: "Continue no iFood · FoodPilot" };

export default function ContinuarPage() {
  return <ContinueScreen />;
}
