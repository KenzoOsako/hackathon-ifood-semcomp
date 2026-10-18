import type { Metadata } from "next";
import { AgentScreen } from "@/ui/agent/agent-screen";

export const metadata: Metadata = { title: "Conversa · Mimo" };

export default function AgentePage() {
  return <AgentScreen />;
}
