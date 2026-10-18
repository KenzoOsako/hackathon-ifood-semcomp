// Cliente MCP real por sujeito: conecta uma vez (~2 s medidos) e reaproveita a conexão.
// O token entra a cada requisição pelo fetch do transporte, então a renovação não exige reconectar.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpTools } from "@/agent/domain-mcp";
import { tokenValido } from "./oauth";

const MCP_URL_PADRAO = "https://consumer-mcp.ifood.com.br/marketplace";
const TIMEOUT_MS = 15_000;
const MAX_CLIENTES = 200;

const g = globalThis as unknown as { __ifoodMcp?: Map<string, Promise<Client>> };
const clientes: Map<string, Promise<Client>> = (g.__ifoodMcp ??= new Map());

async function conectar(subjectRef: string): Promise<Client> {
  const url = new URL(process.env.IFOOD_MCP_URL?.trim() || MCP_URL_PADRAO);
  const transport = new StreamableHTTPClientTransport(url, {
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${await tokenValido(subjectRef)}`);
      return fetch(input, { ...init, headers });
    },
  });
  const client = new Client({ name: "guide-foodpilot", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

function clienteDo(subjectRef: string): Promise<Client> {
  let c = clientes.get(subjectRef);
  if (!c) {
    c = conectar(subjectRef).catch((e) => { clientes.delete(subjectRef); throw e; });
    clientes.set(subjectRef, c);
    if (clientes.size > MAX_CLIENTES) { const [k, v] = clientes.entries().next().value!; clientes.delete(k); void v.then((x) => x.close()).catch(() => undefined); }
  }
  return c;
}

export async function fecharCliente(subjectRef: string) {
  const c = clientes.get(subjectRef); clientes.delete(subjectRef);
  await c?.then((x) => x.close()).catch(() => undefined);
}

export function mcpToolsDo(subjectRef: string): McpTools {
  return {
    async callTool(name, args) {
      const client = await clienteDo(subjectRef);
      const r = await client.callTool({ name, arguments: args }, undefined, { timeout: TIMEOUT_MS });
      if (r.isError) throw new Error(`MCP_TOOL_ERRO:${name}`);
      if (r.structuredContent) return r.structuredContent;
      const texto = Array.isArray(r.content) ? r.content.map((c) => (c.type === "text" ? c.text : "")).join("") : "";
      try { return JSON.parse(texto); } catch { throw new Error(`MCP_RESPOSTA_INVALIDA:${name}`); }
    },
  };
}

// Ferramentas que o MCP ao vivo expõe (tools/list), para conferir a documentação com a realidade. Só nomes e esquema de entrada.
export async function listarFerramentas(subjectRef: string) {
  const client = await clienteDo(subjectRef);
  const r = await client.listTools(undefined, { timeout: TIMEOUT_MS });
  return r.tools.map((t) => {
    const schema = (t.inputSchema ?? {}) as { required?: string[]; properties?: Record<string, { type?: string; enum?: unknown[] }> };
    return {
      name: t.name,
      description: (t.description ?? "").slice(0, 400),
      obrigatorios: schema.required ?? [],
      parametros: Object.fromEntries(Object.entries(schema.properties ?? {}).map(([k, v]) => [k, v.enum ? "enum" : (v.type ?? "?")])),
    };
  });
}
