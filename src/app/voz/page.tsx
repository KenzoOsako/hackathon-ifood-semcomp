"use client";
// LABORATÓRIO DA VOZ (frente de Felipe). Página de teste do ciclo: falar → reconhecer → agente → ouvir.
// Usa o agente do Hyago (/api/converse) pelo cliente de eventos (converse-client.ts). A interface final é da frente de Malveste; esta rota só valida a voz.
import { useCallback, useState } from "react";
import { converseTurn } from "@/voice/converse-client";
import { useVoice, type Utterance } from "@/voice/use-voice";

interface Line { id: string; from: "voce" | "agente"; text: string }

export default function VozLab() {
  const [lines, setLines] = useState<Line[]>([{ id: "init", from: "agente", text: "Oi! Eu sou o Guide! Em que posso te ajudar hoje?" }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [utterance, setUtterance] = useState<Utterance | null>(null);
  const [terms, setTerms] = useState<string[]>([]); // nomes na tela: ajudam o reconhecimento

  interface Ctl { mark: (m: "request_sent" | "first_chunk") => void; enqueue: (t: string) => void; done: () => void; begin?: () => void; origem?: "voz" | "texto"; sinais?: Utterance["sinais"] }

  // Termos da tela (lojas e itens do plano) para o reconhecimento acertar os nomes. O payload vem do backend: defensivo.
  const termsFromPlan = (plano: unknown): string[] => {
    const blocos = (plano as { blocos?: Array<{ principal?: { loja?: string; item?: string }; alternativas?: Array<{ loja?: string; item?: string }> }> })?.blocos ?? [];
    return blocos.flatMap((b) => [b.principal, ...(b.alternativas ?? [])]).flatMap((o) => [o?.loja, o?.item]).filter((t): t is string => !!t);
  };

  const send = useCallback(async (text: string, ctl: Ctl) => {
    setBusy(true);
    setLines((l) => [...l, { id: `u-${l.length}`, from: "voce", text }]);
    let spoke = false;
    let firstSeen = false;
    try {
      ctl.begin?.();
      ctl.mark("request_sent");
      const said: string[] = [];
      // Eventos na ordem em que o backend os produz (converse-client.ts). Hoje o JSON único vira eventos; com
      // streaming no backend, a voz começa a falar no primeiro `speech` sem mudar nada aqui.
      for await (const ev of converseTurn({ texto: text, origem: ctl.origem ?? "texto", sinais: ctl.sinais })) {
        if (!firstSeen && (ev.type === "ack" || ev.type === "speech" || ev.type === "error")) { firstSeen = true; ctl.mark("first_chunk"); }
        if (ev.type === "ack") { spoke = true; ctl.enqueue(ev.text); }
        else if (ev.type === "speech") { spoke = true; said.push(ev.text); ctl.enqueue(ev.text); }
        else if (ev.type === "error") { spoke = true; said.push(ev.reply); ctl.enqueue(ev.reply); }
        else if (ev.type === "screen") setTerms(termsFromPlan(ev.payload));
      }
      if (said.length) setLines((l) => [...l, { id: `a-${l.length}`, from: "agente", text: said.join(" ") }]);
    } finally {
      if (!spoke) ctl.done(); // sem resposta falada: libera o microfone do modo sem as mãos
      setBusy(false);
    }
  }, []);

  // Fala reconhecida: guarda o diagnóstico, envia ao agente e responde falando.
  const voice = useVoice(
    (u, api) => {
      setUtterance(u);
      void send(u.texto, { mark: api.mark, enqueue: (t) => api.enqueue(t), done: api.turnDone, origem: "voz", sinais: u.sinais });
    },
    { getTerms: () => terms },
  );

  const listening = voice.state === "listening";
  const label = { idle: voice.handsFree ? "Escutando…" : "Falar", listening: voice.handsFree ? "Ouvindo… (toque para encerrar)" : "Parar", transcribing: "Reconhecendo…", speaking: "Falando… (toque para interromper)", error: "Falar" }[voice.state];
  const handleVoiceAction = () => {
    if (listening) {
      voice.stop();
    } else if (voice.state === "speaking") {
      voice.stopSpeaking();
    } else {
      void voice.start();
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#111", minHeight: "100vh", colorScheme: "light" }}>
      <h1 style={{ marginBottom: 4 }}>Guide · laboratório de voz</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Clique em <strong>Falar</strong>, diga algo e clique em <strong>Parar</strong>. Tocar no botão enquanto o Guide fala interrompe a fala. Agente do Hyago (dados simulados).</p>

      <section aria-live="polite" style={{ display: "grid", gap: 8, margin: "16px 0" }}>
        {lines.map((l) => (
          <div key={l.id} style={{ padding: "8px 12px", borderRadius: 12, background: l.from === "voce" ? "#ffe3e5" : "#f1f1f1", color: "#111", justifySelf: l.from === "voce" ? "end" : "start", whiteSpace: "pre-wrap" }}>{l.text}</div>
        ))}
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          type="button"
          onClick={handleVoiceAction}
          disabled={voice.state === "transcribing" || busy}
          aria-pressed={listening}
          style={{ padding: "14px 22px", borderRadius: 999, border: 0, background: listening ? "#222" : "#ea1d2c", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
        >
          {label}
        </button>
        <meter aria-label="Nível do microfone" value={Math.round(voice.level * 100)} min={0} max={100} style={{ flex: 1, height: 16 }} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px", cursor: "pointer" }}>
        <input type="checkbox" checked={voice.handsFree} onChange={(e) => void voice.setHandsFree(e.target.checked)} />
        <span><strong>Modo conversa</strong> (sem as mãos): o Guide escuta, para sozinho quando você cala, responde e escuta de novo. Falar por cima dele interrompe.</span>
      </label>

      {voice.errorMessage && <p role="alert" style={{ color: "#b00020" }}>{voice.errorMessage}</p>}

      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) { void send(input.trim(), { mark: voice.mark, enqueue: (t) => voice.enqueue(t), done: voice.turnDone, begin: voice.beginTurn }); setInput(""); } }} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ou digite aqui (o texto sempre funciona)" aria-label="Mensagem" disabled={busy} style={{ background: "#fff", color: "#111", flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
        <button type="submit" disabled={busy} style={{ padding: "0 18px", borderRadius: 10, border: 0, background: "#222", color: "#fff" }}>Enviar</button>
      </form>

      <details open style={{ marginTop: 12, color: "#444" }}>
        <summary>Diagnóstico do microfone</summary>
        <pre style={{ background: "#f7f7f7", color: "#111", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 13 }}>{JSON.stringify({
          nivel_agora: voice.diag.level?.toFixed(4),
          ruido_de_fundo: voice.diag.floor?.toFixed(4),
          limite_de_voz: voice.diag.threshold?.toFixed(4),
          ultimo_audio_bytes: voice.diag.blobBytes,
          formato: voice.diag.mime,
          medidor_local_ouviu_fala: voice.diag.heardSpeech,
          reconhecimento_http: voice.diag.sttStatus,
          reconhecimento_ms: voice.diag.sttMs,
        }, null, 2)}</pre>
        <small>Fale e veja o <strong>nivel_agora</strong> subir. Se ele ficar em 0, o navegador não está entregando som ao medidor (microfone errado ou contexto de áudio suspenso).</small>
      </details>

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
