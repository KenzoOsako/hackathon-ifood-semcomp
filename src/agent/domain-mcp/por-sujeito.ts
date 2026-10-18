// Um McpDomain por sujeito conectado, com a localização resolvida uma vez.
import { mcpToolsDo } from "@/mcp/real/client";
import type { EventoFeedback } from "../types";
import { McpDomain, type Localizacao, type McpTools, type PlanosStore } from ".";

// Local público da demo (USP São Carlos) quando a conta não tem endereço salvo; não é dado pessoal.
const LOCAL_PADRAO = { latitude: -22.0069, longitude: -47.8946 };

const g = globalThis as unknown as { __guideMcpDomains?: Map<string, Promise<McpDomain>>; __guideMcpPlanos?: PlanosStore; __guideMcpEventos?: { subjectRef: string; evento: EventoFeedback }[] };
const dominios = (g.__guideMcpDomains ??= new Map());
const planos = (g.__guideMcpPlanos ??= new Map());
export const eventosReais = (g.__guideMcpEventos ??= []);

export async function resolverLocal(tools: McpTools, env: NodeJS.ProcessEnv = process.env): Promise<Localizacao> {
  try {
    const r = (await tools.callTool("listAddresses", {})) as { results?: Record<string, unknown>[] };
    for (const a of r?.results ?? []) {
      const c = (a.coordinates ?? a.location ?? a) as { latitude?: unknown; longitude?: unknown };
      if (typeof c.latitude === "number" && typeof c.longitude === "number") return { latitude: c.latitude, longitude: c.longitude, fonte: "endereco" };
    }
  } catch { /* sem endereço: segue para o local fixo */ }
  const lat = Number(env.IFOOD_DEMO_LAT); const lng = Number(env.IFOOD_DEMO_LNG);
  return Number.isFinite(lat) && Number.isFinite(lng) && env.IFOOD_DEMO_LAT && env.IFOOD_DEMO_LNG
    ? { latitude: lat, longitude: lng, fonte: "fixa" }
    : { ...LOCAL_PADRAO, fonte: "fixa" };
}

export function dominioRealDo(subjectRef: string): Promise<McpDomain> {
  let d = dominios.get(subjectRef);
  if (!d) {
    const tools = mcpToolsDo(subjectRef);
    d = resolverLocal(tools).then((local) => new McpDomain(tools, local, planos, (s, evento) => {
      eventosReais.push({ subjectRef: s, evento });
      if (eventosReais.length > 5000) eventosReais.shift();
    }));
    d.catch(() => dominios.delete(subjectRef));
    dominios.set(subjectRef, d);
    if (dominios.size > 200) dominios.delete(dominios.keys().next().value!);
  }
  return d;
}

export function esquecerDominio(subjectRef: string) { dominios.delete(subjectRef); }
