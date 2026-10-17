"use client";
// Interface do esqueleto: texto + cartões + confirmação + status. A frente "Voz e interface"
// adiciona microfone/ElevenLabs, interrupção e o visual final. Não mudar os contratos sem PR.
import { useEffect, useRef, useState } from "react";
import type { AgentTurn, OrderStatus } from "@/contracts";

type Msg = { from: "voce" | "agente"; text: string };
const LABELS: Record<string, string> = {
  MAIS_BARATA: "Mais barata",
  MELHOR_AVALIADA: "Melhor avaliada",
  MAIS_RAPIDA: "Mais rápida",
  SEU_FAVORITO: "Seu favorito",
  NOVIDADE_PARA_VOCE: "Novidade para você",
};

export default function Home() {
  const sessionRef = useRef(""); // criado no primeiro envio (o Next 16 não aceita aleatório no prerender)
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "agente", text: "Oi! O que você quer comer hoje?" }]);
  const [turn, setTurn] = useState<AgentTurn | null>(null);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, turn, status]);

  // Acompanhamento do pedido: respeita pollingStop.
  useEffect(() => {
    if (!status || status.pollingStop) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/order?orderId=${status.orderId}`);
      if (r.ok) setStatus(await r.json());
    }, 3000);
    return () => clearTimeout(t);
  }, [status]);

  async function call(url: string, body: object, shown?: string) {
    if (!sessionRef.current) sessionRef.current = crypto.randomUUID();
    const sessionId = sessionRef.current;
    setBusy(true);
    if (shown) setMsgs((m) => [...m, { from: "voce", text: shown }]);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, ...body }) });
      const t: AgentTurn = await r.json();
      setTurn(t);
      setMsgs((m) => [...m, { from: "agente", text: t.reply }]);
      if (t.order) setStatus(t.order);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 4 }}>FoodPilot</h1>
      <p style={{ marginTop: 0, color: "#666" }}>Esqueleto da demo (dados simulados). Tente: “estou com fome”, “pizza até 45”.</p>

      <section aria-live="polite" style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap", padding: "8px 12px", borderRadius: 12, background: m.from === "voce" ? "#ffe3e5" : "#f1f1f1", justifySelf: m.from === "voce" ? "end" : "start" }}>
            {m.text}
          </div>
        ))}
      </section>

      {turn?.state === "ESCOLHENDO_OPCAO" && turn.options && (
        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: 16 }}>
          {turn.options.map((o, i) => (
            <button key={o.candidate.merchantId} disabled={busy} onClick={() => call("/api/chat", { message: String(i + 1) }, `Quero a ${i + 1}`)}
              style={{ textAlign: "left", padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "#fff", cursor: "pointer" }}>
              <strong style={{ color: "#ea1d2c" }}>{LABELS[o.label]}</strong>
              <div>{o.candidate.merchantName}</div>
              <div style={{ color: "#555" }}>{o.candidate.itemName}</div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#444", fontSize: 14 }}>
                {o.reasons.map((r) => <li key={r.kind}>{r.text}</li>)}
              </ul>
            </button>
          ))}
        </section>
      )}

      {turn?.state === "AGUARDANDO_CONFIRMACAO" && turn.cart && (
        <section style={{ border: "2px solid #ea1d2c", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <strong>Revise seu pedido</strong>
          <p style={{ margin: "8px 0" }}>{turn.cart.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} — {turn.cart.merchantName}</p>
          <p style={{ margin: "8px 0" }}>Entrega: {turn.cart.addressFormatted} · {turn.cart.paymentLabel}</p>
          <p style={{ margin: "8px 0" }}><strong>Total R$ {turn.cart.total.toFixed(2).replace(".", ",")}</strong></p>
          <button disabled={busy || !turn.cart.canProceedToCheckout} onClick={() => call("/api/confirm", { explicit: true }, "Confirmo o pedido")}
            style={{ padding: "10px 18px", borderRadius: 10, border: 0, background: "#ea1d2c", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Confirmar pedido
          </button>
        </section>
      )}

      {status && (
        <section style={{ background: "#eef8ee", borderRadius: 12, padding: 12, marginBottom: 16 }}>
          Pedido {status.orderId}: <strong>{status.description}</strong> {status.pollingStop ? "✓" : "…"}
        </section>
      )}

      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) { call("/api/chat", { message: input }, input); setInput(""); } }} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Fale ou digite…" aria-label="Mensagem" disabled={busy}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
        <button disabled={busy} style={{ padding: "0 18px", borderRadius: 10, border: 0, background: "#222", color: "#fff" }}>Enviar</button>
      </form>
      <div ref={bottom} />
    </main>
  );
}
