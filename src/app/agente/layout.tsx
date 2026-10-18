import { AgentProvider } from "@/ui/agent/agent-context";

export default function AgenteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AgentProvider>{children}</AgentProvider>;
}
