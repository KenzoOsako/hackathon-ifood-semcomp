// Nomes que aparecem no plano (lojas e itens) para o reconhecimento acertá-los na próxima fala.
// O payload vem do backend: lido de forma defensiva, sem assumir o formato.
export function termsFromPlan(plano: unknown): string[] {
  const blocos = (plano as { blocos?: Array<{ principal?: { loja?: string; item?: string }; alternativas?: Array<{ loja?: string; item?: string }> }> } | null)?.blocos;
  if (!Array.isArray(blocos)) return [];
  const out = blocos
    .flatMap((b) => [b?.principal, ...(Array.isArray(b?.alternativas) ? b.alternativas : [])])
    .flatMap((o) => [o?.loja, o?.item])
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  return [...new Set(out)];
}
