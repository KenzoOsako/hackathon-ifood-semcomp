// Mede o backend do agente (/api/converse) na jornada do aniversário: p50/p95 por etapa.
// Uso (servidor de produção já rodando e com login iFood feito no navegador):
//   GUIDE_COOKIE=<valor do cookie foodpilot_visitor> node scripts/medir-agente.mjs
// Opcionais: BASE_URL (http://localhost:8080), RODADAS (5), PAUSA_MS (15000; ~8 chamadas/min ao Gemini).
// A 1ª jornada é aquecimento (conexão MCP, caches) e não entra na conta.
const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const RODADAS = Number(process.env.RODADAS ?? 5);
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 15_000);
const COOKIE = process.env.GUIDE_COOKIE?.trim();
const JORNADA = [
  "Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme.",
  "Umas seis.",
  "Pode escolher.",
  "Quero a pizza mais bem avaliada",
];

if (!COOKIE) {
  console.error("Falta GUIDE_COOKIE: copie o valor do cookie foodpilot_visitor (DevTools > Application > Cookies) depois do login iFood.");
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function turno(texto, reiniciar) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}/api/converse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, "Sec-Fetch-Site": "same-origin", Cookie: `foodpilot_visitor=${COOKIE}` },
    body: JSON.stringify({ texto, origem: "texto", ...(reiniciar ? { reiniciar: true } : {}) }),
  });
  const j = await r.json().catch(() => ({}));
  return { http: r.status, clienteMs: Math.round(performance.now() - t0), ...j };
}

function percentil(valores, p) {
  if (!valores.length) return undefined;
  const ord = [...valores].sort((a, b) => a - b);
  return ord[Math.min(ord.length - 1, Math.ceil((p / 100) * ord.length) - 1)];
}

const amostras = [];
for (let rodada = 0; rodada <= RODADAS; rodada++) {
  for (const [i, texto] of JORNADA.entries()) {
    const r = await turno(texto, i === 0);
    if (r.code === "IFOOD_LOGIN") { console.error("Sem login iFood nesta sessão: faça o login em /api/auth/login no mesmo navegador do cookie."); process.exit(1); }
    if (r.http !== 200) { console.error(`Turno falhou (HTTP ${r.http}, ${r.code ?? "?"}): ${r.reply ?? ""}`); process.exit(1); }
    const linha = { rodada, turno: i + 1, estado: r.estado, llm: r.llm, origem: r.origem, ...r.tempos, clienteMs: r.clienteMs };
    console.log(`${rodada === 0 ? "aquecimento" : `rodada ${rodada}`} · turno ${i + 1} · ${r.estado} · interpretar ${r.tempos.interpretarMs} · domínio ${r.tempos.dominioMs ?? "-"} · responder ${r.tempos.responderMs ?? "-"} · total ${r.tempos.totalMs} · cliente ${r.clienteMs} ms`);
    if (rodada > 0) amostras.push(linha);
    await dormir(PAUSA_MS);
  }
}

const etapas = ["interpretarMs", "dominioMs", "responderMs", "totalMs", "clienteMs"];
console.log(`\nLLM: ${amostras[0]?.llm} · origem: ${amostras[0]?.origem} · ${RODADAS} rodadas, ${amostras.length} turnos (aquecimento fora)`);
console.log("etapa           n    p50    p95    máx");
for (const e of etapas) {
  const v = amostras.map((a) => a[e]).filter((x) => typeof x === "number");
  console.log(`${e.padEnd(14)} ${String(v.length).padStart(3)} ${String(percentil(v, 50) ?? "-").padStart(6)} ${String(percentil(v, 95) ?? "-").padStart(6)} ${String(v.length ? Math.max(...v) : "-").padStart(6)}`);
}
const comBusca = amostras.filter((a) => typeof a.dominioMs === "number" && a.dominioMs > 100).map((a) => a.clienteMs);
console.log(`\nTurnos que buscaram no iFood (domínio > 100 ms): n=${comBusca.length}, p50=${percentil(comBusca, 50) ?? "-"} ms, p95=${percentil(comBusca, 95) ?? "-"} ms`);
