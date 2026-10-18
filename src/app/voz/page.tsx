"use client";
// LABORATÓRIO DA VOZ (frente de Felipe). Página de teste do ciclo: falar → reconhecer → agente → ouvir.
// Usa o hook único da voz (use-guide-voice.ts), o mesmo que a interface final deve usar. Aqui só se desenha o laboratório.
import { useState } from "react";
import { LATENCY_TARGETS, type LatencySummary } from "@/voice/latency";
import { useGuideVoice, type GuideStats } from "@/voice/use-guide-voice";

const METRICS = ["sttMs", "firstSoundMs", "backendFirstChunkMs", "ttsFirstByteMs", "timeToFirstAudioMs"] as const;
const cell = { padding: "4px 8px", borderBottom: "1px solid #eee" } as const;
const smallButton = { padding: "6px 12px", borderRadius: 8, border: "1px solid #bbb", background: "#fff", color: "#222", cursor: "pointer" } as const;

// Copia as rodadas e as estatísticas para a área de transferência (cola direto no chat ou numa planilha).
async function exportRounds(rounds: LatencySummary[], stats: GuideStats, skipFirst: boolean) {
  const payload = { geradoEm: new Date().toISOString(), descartouPrimeira: skipFirst, metas: LATENCY_TARGETS, rodadas: rounds, estatisticas: stats };
  try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); } catch { /* sem permissão da área de transferência: a tabela continua na tela */ }
}

export default function VozLab() {
  const g = useGuideVoice();
  const [input, setInput] = useState("");

  return (
    <main style={{ boxSizing: "border-box", width: "100%", height: "100%", overflowY: "auto", overflowX: "hidden", padding: 16, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#111", colorScheme: "light" }}>
      <h1 style={{ marginBottom: 4 }}>Guide · laboratório de voz</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Clique em <strong>Falar</strong>, diga algo e clique em <strong>Parar</strong>. <strong>Esc</strong> ou <strong>Cancelar</strong> descarta a gravação. Tocar no botão enquanto o Guide fala interrompe a fala. Agente do Hyago.</p>

      <section aria-live="polite" style={{ display: "grid", gap: 8, margin: "16px 0" }}>
        {g.lines.map((l) => (
          <div key={l.id} style={{ padding: "8px 12px", borderRadius: 12, background: l.from === "voce" ? "#ffe3e5" : "#f1f1f1", color: "#111", justifySelf: l.from === "voce" ? "end" : "start", whiteSpace: "pre-wrap" }}>{l.text}</div>
        ))}
      </section>

      {g.login && (
        <p style={{ margin: "8px 0" }}>
          <a href={g.login.url} style={{ display: "inline-block", padding: "10px 18px", borderRadius: 999, background: "#ea1d2c", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Conectar iFood</a>
        </p>
      )}
      {g.unclear && <p role="status" style={{ color: "#7a5b00", margin: "8px 0" }}>Não entendi bem: &ldquo;{g.unclear}&rdquo;. Pode repetir?</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          type="button"
          onClick={g.toggle}
          disabled={g.state === "transcribing" || g.busy}
          aria-pressed={g.listening}
          style={{ padding: "14px 22px", borderRadius: 999, border: 0, background: g.listening ? "#222" : "#ea1d2c", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
        >
          {g.label}
        </button>
        {g.listening && (
          <button type="button" onClick={g.cancel} style={{ padding: "14px 18px", borderRadius: 999, border: "1px solid #bbb", background: "#fff", color: "#222", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Cancelar</button>
        )}
        <meter aria-label="Nível do microfone" value={Math.round(g.level * 100)} min={0} max={100} style={{ flex: 1, height: 16 }} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px", cursor: "pointer" }}>
        <input type="checkbox" checked={g.handsFree} onChange={(e) => void g.setHandsFree(e.target.checked)} />
        <span><strong>Modo conversa</strong> (sem as mãos): o Guide escuta, para sozinho quando você cala, responde e escuta de novo. Falar por cima dele interrompe.</span>
      </label>

      {g.errorMessage && <p role="alert" style={{ color: "#b00020" }}>{g.errorMessage}</p>}

      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) { g.sendText(input); setInput(""); } }} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ou digite aqui (o texto sempre funciona)" aria-label="Mensagem" disabled={g.busy} style={{ background: "#fff", color: "#111", flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
        <button type="submit" disabled={g.busy} style={{ padding: "0 18px", borderRadius: 10, border: 0, background: "#222", color: "#fff" }}>Enviar</button>
      </form>

      <details open style={{ marginTop: 12, color: "#444" }}>
        <summary>Diagnóstico do microfone</summary>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f7f7f7", color: "#111", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 13 }}>{JSON.stringify({
          nivel_agora: g.diag.level?.toFixed(4),
          ruido_de_fundo: g.diag.floor?.toFixed(4),
          limite_de_voz: g.diag.threshold?.toFixed(4),
          ultimo_audio_bytes: g.diag.blobBytes,
          formato: g.diag.mime,
          medidor_local_ouviu_fala: g.diag.heardSpeech,
          reconhecimento_http: g.diag.sttStatus,
          reconhecimento_ms: g.diag.sttMs,
        }, null, 2)}</pre>
        <small>Fale e veja o <strong>nivel_agora</strong> subir. Se ele ficar em 0, o navegador não está entregando som ao medidor (microfone errado ou contexto de áudio suspenso).</small>
      </details>

      {g.rounds.length > 0 && (
        <details open style={{ marginTop: 16, color: "#444" }}>
          <summary>Latência por rodada (ms)</summary>
          <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", margin: "8px 0", fontSize: 13, width: "100%" }}>
            <thead>
              <tr>{["#", "reconhecimento", "1º som (espera conta)", "backend (1º pedaço)", "voz (1º byte)", "1ª palavra útil"].map((h) => <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #ddd" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {g.rounds.map((r, i) => (
                <tr key={`r-${i}`} style={{ color: i === 0 && g.skipFirstRound ? "#999" : "#111" }}>
                  <td style={cell}>{i + 1}{i === 0 && g.skipFirstRound ? " (descartada)" : ""}</td>
                  {METRICS.map((m) => <td key={m} style={{ ...cell, color: (r[m] ?? 0) > LATENCY_TARGETS[m] ? "#b00020" : undefined }}>{r[m] ?? "-"}</td>)}
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td style={cell}>p50</td>{METRICS.map((m) => <td key={m} style={cell}>{g.stats[m]?.p50 ?? "-"}</td>)}
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={cell}>p95</td>{METRICS.map((m) => <td key={m} style={cell}>{g.stats[m]?.p95 ?? "-"}</td>)}
              </tr>
              <tr style={{ color: "#666" }}>
                <td style={cell}>meta</td>{METRICS.map((m) => <td key={m} style={cell}>{LATENCY_TARGETS[m]}</td>)}
              </tr>
            </tbody>
          </table>
          </div>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center", marginRight: 12 }}>
            <input type="checkbox" checked={g.skipFirstRound} onChange={(e) => g.setSkipFirstRound(e.target.checked)} /> descartar a 1ª rodada (aquecimento)
          </label>
          <button type="button" onClick={() => void exportRounds(g.rounds, g.stats, g.skipFirstRound)} style={smallButton}>Copiar JSON</button>{" "}
          <button type="button" onClick={g.clearRounds} style={smallButton}>Limpar</button>
          <div><small>Vermelho = acima da meta. Com menos de 5 rodadas o p95 é só indicativo.</small></div>
        </details>
      )}

      {g.utterance && (
        <details open style={{ marginTop: 16, color: "#444" }}>
          <summary>Última fala (diagnóstico)</summary>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f7f7f7", color: "#111", padding: 12, borderRadius: 8, overflow: "auto" }}>{JSON.stringify({ texto: g.utterance.texto, confianca: g.utterance.confianca, sinais: g.utterance.sinais, redacoes: g.utterance.redacoes, injecao: g.utterance.injecao }, null, 2)}</pre>
        </details>
      )}
    </main>
  );
}
