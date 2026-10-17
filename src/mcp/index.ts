// Escolhe o cliente MCP pelo ambiente. MCP_MODE=mock (padrão) | real.
import { createMockMcp } from "./mock";
import type { McpClient } from "./types";

const g = globalThis as unknown as { __mcp?: McpClient };

export function getMcp(): McpClient {
  if (g.__mcp) return g.__mcp;
  const mode = process.env.MCP_MODE ?? "mock";
  if (mode === "real") {
    // TODO (frente Agente e MCP): OAuth + PKCE, tokens por usuário, adaptador por domínio.
    throw new Error("MCP_MODE=real ainda não implementado. Use MCP_MODE=mock.");
  }
  g.__mcp = createMockMcp();
  return g.__mcp;
}
