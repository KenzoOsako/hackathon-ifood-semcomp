"use client";
// LABORATÓRIO DA VOZ (frente de Felipe). Página de teste do ciclo: falar → reconhecer → agente → ouvir.
// Usa o agente de texto atual (/api/chat). A interface final é da frente de Malveste; esta rota só valida a voz.
import { useCallback, useState } from "react";
import { useVoice, type Utterance } from "@/voice/use-voice";

interface Line { from: "voce" | "agente"; text: string }

export default function VozLab() {
  const [lines, setLines] = useState<Line[]>([{ from: "agente", text: "Oi! Eu sou o Guide! Em que posso te ajudar hoje?" }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [utterance, setUtterance] = useState<Utterance | null>(null);
  const [terms, setTerms] = useState<string[]>([]); // nomes na tela: ajudam o reconhecimento

  interface Ctl { mark: (m: "request_sent" | "first_chunk") => void; speak: (t: string) => unknown; begin?: () => void }

  const send = useCallback(async (text: string, ctl: Ctl) => {
    setBusy(true);
    setLines((l) => [...l, { from: "voce", text }]);
    try {
      ctl.begin?.();
      ctl.mark("request_sent");
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const t = (await r.json()) as { reply: string; options?: Array<{ candidate: { merchantName: string; itemName: string } }> };
      if (t.options) setTerms(t.options.flatMap((o) => [o.candidate.merchantName, o.candidate.itemName]));
      ctl.mark("first_chunk"); // o backend de hoje devolve tudo de uma vez; no fluxo real, este é o 1º pedaço
      setLines((l) => [...l, { from: "agente", text: t.reply }]);
      ctl.speak(t.reply); // divide em pedaços, busca o áudio de todos em paralelo e toca em ordem
    } finally {
      setBusy(false);
    }
  }, []);

  // Fala reconhecida: guarda o diagnóstico, envia ao agente e responde falando.
  const voice = useVoice(
    (u, api) => {
      setUtterance(u);
      void send(u.texto, { mark: api.mark, speak: api.speak });
    },
    { getTerms: () => terms },
  );

  const listening = voice.state === "listening";
  const label = { idle: "Falar", listening: "Parar", transcribing: "Reconhecendo…", speaking: "Falando… (toque para interromper)", error: "Falar" }[voice.state];

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#111", minHeight: "100vh", colorScheme: "light" }}>
      <h1 style={{ marginBottom: 4 }}>Guide · laboratório de voz</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Clique em <strong>Falar</strong>, diga algo e clique em <strong>Parar</strong>. Tocar no botão enquanto o Guide fala interrompe a fala. Agente de texto simulado.</p>

      <section aria-live="polite" style={{ display: "grid", gap: 8, margin: "16px 0" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ padding: "8px 12px", borderRadius: 12, background: l.from === "voce" ? "#ffe3e5" : "#f1f1f1", color: "#111", justifySelf: l.from === "voce" ? "end" : "start", whiteSpace: "pre-wrap" }}>{l.text}</div>
        ))}
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          onClick={() => (listening ? voice.stop() : void voice.start())}
          disabled={voice.state === "transcribing" || busy}
          aria-pressed={listening}
          style={{ padding: "14px 22px", borderRadius: 999, border: 0, background: listening ? "#222" : "#ea1d2c", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
        >
          {label}
        </button>
        <div role="meter" aria-label="Nível do microfone" aria-valuenow={Math.round(voice.level * 100)} aria-valuemin={0} aria-valuemax={100} style={{ flex: 1, height: 10, background: "#eee", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ width: `${voice.level * 100}%`, height: "100%", background: "#ea1d2c", transition: "width 60ms linear" }} />
        </div>
      </div>

      {voice.errorMessage && <p role="alert" style={{ color: "#b00020" }}>{voice.errorMessage}</p>}

      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) { void send(input.trim(), { mark: voice.mark, speak: voice.speak, begin: voice.beginTurn }); setInput(""); } }} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ou digite aqui (o texto sempre funciona)" aria-label="Mensagem" disabled={busy} style={{ background: "#fff", color: "#111", flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
        <button disabled={busy} style={{ padding: "0 18px", borderRadius: 10, border: 0, background: "#222", color: "#fff" }}>Enviar</button>
      </form>

      {voice.latency && (
        <details open style={{ marginTop: 16, color: "#444" }}>
          <summary>Latência do último turno (ms)</summary>
          <pre style={{ background: "#f7f7f7", color: "#111", padding: 12, borderRadius: 8, overflow: "auto" }}>{JSON.stringify(voice.latency, null, 2)}</pre>
          <small>Metas: reconhecimento 600 · primeiro pedaço do backend 700 · primeiro byte de voz 450 · até a primeira palavra 1800.</small>
        </details>
      )}

      {utterance && (
        <details open style={{ marginTop: 16, color: "#444" }}>
          <summary>Última fala (diagnóstico)</summary>
          <pre style={{ background: "#f7f7f7", color: "#111", padding: 12, borderRadius: 8, overflow: "auto" }}>{JSON.stringify({ texto: utterance.texto, confianca: utterance.confianca, sinais: utterance.sinais, redacoes: utterance.redacoes, injecao: utterance.injecao }, null, 2)}</pre>
        </details>
      )}
    </main>
  );
}
