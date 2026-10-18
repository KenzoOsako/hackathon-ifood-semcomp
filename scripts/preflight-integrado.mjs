// Verificação ANTES do teste integrado (voz + agente + MCP). Testa as chaves de verdade, uma chamada barata cada, e
// diz o que falta. Nunca imprime valor de chave. Uso:  node scripts/preflight-integrado.mjs
import { readFileSync, existsSync } from "node:fs";
import net from "node:net";

function lerEnv(path = ".env") {
  if (!existsSync(path)) return {};
  const out = {};
  for (const linha of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...lerEnv(), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(MCP_MODE|LLM_|GOOGLE_|ELEVENLABS_|IFOOD_)/.test(k))) };
const resultados = [];
const marca = (nivel, item, detalhe) => resultados.push({ nivel, item, detalhe });

async function comTempo(fn) {
  const t0 = performance.now();
  const r = await fn();
  return { r, ms: Math.round(performance.now() - t0) };
}

// ---------- ElevenLabs (voz) ----------
async function elevenlabs() {
  if (!env.ELEVENLABS_API_KEY) return marca("FALHA", "ElevenLabs", "ELEVENLABS_API_KEY ausente");
  if (!env.ELEVENLABS_VOICE_ID) marca("FALHA", "ElevenLabs voz", "ELEVENLABS_VOICE_ID ausente");
  try {
    const { r, ms } = await comTempo(() => fetch("https://api.elevenlabs.io/v1/models", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } }));
    marca(r.ok ? "OK" : "FALHA", "ElevenLabs chave", r.ok ? `válida (${ms} ms)` : `recusada (HTTP ${r.status})`);
  } catch {
    marca("FALHA", "ElevenLabs chave", "sem rede até api.elevenlabs.io");
  }
}

// ---------- Gemini (agente) ----------
async function gemini() {
  const provedor = env.LLM_PROVIDER;
  const modelo = env.LLM_MODEL;
  if (!provedor || !modelo) return marca("FALHA", "Agente (LLM)", "LLM_PROVIDER e LLM_MODEL vazios: o agente cairia no MODO REGRAS (sem LLM) e o teste não avaliaria a conversa");
  if (provedor !== "google") return marca("AVISO", "Agente (LLM)", `provedor "${provedor}": este verificador só testa o Gemini (google)`);
  if (!env.GOOGLE_API_KEY) return marca("FALHA", "Gemini chave", "GOOGLE_API_KEY ausente ou vazia no .env");
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
    const { r, ms } = await comTempo(() => fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": env.GOOGLE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Responda só: ok" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
    }));
    if (r.ok) return marca("OK", `Gemini ${modelo}`, `respondeu (${ms} ms)`);
    const dica = { 400: "chave inválida ou pedido recusado", 403: "chave sem permissão para este modelo", 404: "modelo não existe para esta chave", 429: "cota estourada (plano gratuito: ~15 chamadas/min; ative o faturamento)" }[r.status] ?? "erro do provedor";
    marca("FALHA", `Gemini ${modelo}`, `HTTP ${r.status}: ${dica}`);
  } catch {
    marca("FALHA", "Gemini", "sem rede até generativelanguage.googleapis.com");
  }
}

// ---------- iFood MCP (dados reais) ----------
function ifood() {
  const modo = env.MCP_MODE ?? "mock";
  marca("OK", "Dados do agente", modo === "real" ? "MCP_MODE=real (dados reais do iFood; exige login em /api/auth/login)" : "MCP_MODE=mock (dados simulados)");
  if (modo !== "real") return;
  for (const k of ["IFOOD_CLIENT_ID", "IFOOD_CLIENT_SECRET"]) if (!env[k]) marca("FALHA", "iFood", `${k} ausente`);
  const porta = env.IFOOD_CALLBACK_PORT ?? "8080";
  const redirect = env.IFOOD_REDIRECT_URI;
  if (!redirect) return marca(porta === "8080" ? "OK" : "AVISO", "iFood redirect", `http://localhost:${porta}/callback (padrão do app; tem que ser o cadastrado no portal)`);
  // Override: o app roda na 8080 e a rota de retorno é /callback. Valor antigo (outra porta ou /api/auth/callback) quebra o login.
  try {
    const u = new URL(redirect);
    const porta8080 = u.port === "8080";
    const caminho = u.pathname === "/callback";
    marca(porta8080 && caminho ? "OK" : "FALHA", "iFood redirect", `${u.origin}${u.pathname}${porta8080 && caminho ? "" : " — o app roda na porta 8080 e volta em /callback; apague a linha IFOOD_REDIRECT_URI do .env para valer o padrão"}`);
  } catch {
    marca("FALHA", "iFood redirect", "IFOOD_REDIRECT_URI não é uma URL válida");
  }
}

// ---------- Porta 8080 livre ----------
function porta8080() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => { marca("FALHA", "Porta 8080", "ocupada: pare o servidor que está nela (o login do iFood depende desta porta)"); resolve(); });
    s.once("listening", () => { s.close(); marca("OK", "Porta 8080", "livre"); resolve(); });
    s.listen(8080, "0.0.0.0");
  });
}

await Promise.all([elevenlabs(), gemini(), porta8080()]);
ifood();

const icone = { OK: "[ok]    ", AVISO: "[aviso] ", FALHA: "[FALHA] " };
console.log("\nPré-teste integrado\n");
for (const x of resultados) console.log(`${icone[x.nivel]}${x.item}: ${x.detalhe}`);
const falhas = resultados.filter((x) => x.nivel === "FALHA").length;
console.log(falhas ? `\n${falhas} item(ns) a corrigir antes do teste.` : "\nTudo pronto para o teste integrado.");
// exitCode (e não process.exit): no Windows o Node aborta com conexões ainda fechando.
process.exitCode = falhas ? 1 : 0;
