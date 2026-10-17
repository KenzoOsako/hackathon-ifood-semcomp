"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Mic, Send } from "lucide-react";
import type { AgentTurn } from "@/contracts";
import { Alert } from "@/ui/components/alert";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { Input } from "@/ui/components/input";
import { Orb, type OrbState } from "@/ui/components/orb";

type Msg = { id: string; from: "voce" | "agente"; text: string };

// Estados vindos da voz (Felipe). Enquanto não houver voz, a UI só usa idle/thinking/error.
export type VoiceState = "idle" | "listening" | "speaking" | "error";
type AgentScreenProps = { voiceState?: VoiceState; onMicClick?: () => void };

const STATE_LABEL: Record<OrbState, string> = {
  idle: "Pronto para ouvir você",
  listening: "Ouvindo…",
  thinking: "Pensando…",
  speaking: "Respondendo…",
  error: "Algo deu errado",
};

// Frases fixas de atalho: enviam uma mensagem como se o usuário tivesse digitado.
const SUGGESTIONS = ["Jantar sem gastar muito", "Algo diferente hoje", "Pizza até R$ 45"];

function resolveOrbState(busy: boolean, error: string | null, voiceState?: VoiceState): OrbState {
  if (busy) return "thinking";
  if (error) return "error";
  if (voiceState && voiceState !== "idle") return voiceState;
  return "idle";
}

function findLastAgentReply(msgs: readonly Msg[]): string | undefined {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i].from === "agente") {
      return msgs[i].text;
    }
  }
  return undefined;
}

export function AgentScreen({ voiceState, onMicClick }: AgentScreenProps) {
  const nextMsgId = useRef(1);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [turn, setTurn] = useState<AgentTurn | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const lastMessage = useRef("");

  const orbState = resolveOrbState(busy, error, voiceState);
  const lastReply = findLastAgentReply(msgs);

  async function send(message: string) {
    const text = message.trim();
    if (!text || busy) return;
    lastMessage.current = text;
    setBusy(true);
    setError(null);
    const userMsgId = `msg-${nextMsgId.current++}`;
    setMsgs((m) => [...m, { id: userMsgId, from: "voce", text }]);
    try {
      // O servidor identifica o visitante pelo cookie de sessão; não enviamos sessionId.
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const body = (await r.json()) as AgentTurn;
      if (!r.ok) {
        setError(body.reply || "Não consegui responder agora.");
        return;
      }
      const agentMsgId = `msg-${nextMsgId.current++}`;
      setTurn(body);
      setMsgs((m) => [...m, { id: agentMsgId, from: "agente", text: body.reply }]);
    } catch {
      setError("Sem conexão com o servidor. Confira sua internet e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para o início">
          <Link href="/"><ArrowLeft /></Link>
        </Button>
        <span className="font-bold">FoodPilot</span>
        <Badge variant="simulated" className="ml-auto">Simulado</Badge>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-6 py-6 text-center">
        <h1 className="text-2xl font-bold leading-tight">Qual a sua vibe de hoje?</h1>
        <div className="flex size-44 shrink-0 items-center justify-center">
          <Orb state={orbState} className="size-40" />
        </div>
        <p role="status" aria-live="polite" className="text-sm font-semibold text-muted-foreground">{STATE_LABEL[orbState]}</p>

        {lastReply && <p className="whitespace-pre-wrap text-base leading-snug">{lastReply}</p>}

        {error && (
          <Alert variant="destructive" className="w-full text-left">
            <AlertTriangle aria-hidden="true" />
            <div className="flex-1">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy} onClick={() => { void send(lastMessage.current); }}>
                Tentar de novo
              </Button>
            </div>
          </Alert>
        )}

        {turn?.state === "ESCOLHENDO_OPCAO" && turn.options && (
          <Alert className="w-full items-center text-left">
            <div className="flex-1">Encontrei {turn.options.length} {turn.options.length === 1 ? "opção" : "opções"} para você.</div>
            {/* A tela de opções é o próximo PR. */}
            <Button type="button" size="sm" disabled>Ver opções (em breve)</Button>
          </Alert>
        )}

        {msgs.length === 0 && (
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Sugestões">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { void send(s); }}>{s}</Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="border-t border-border bg-background px-3 pb-3 pt-2">
        {msgs.length > 0 && (
          <>
            <Button type="button" variant="ghost" size="sm" aria-expanded={showLog} aria-controls="conversa" onClick={() => setShowLog((v) => !v)}>
              {showLog ? <ChevronDown /> : <ChevronUp />}
              {showLog ? "Esconder conversa" : `Ver conversa (${msgs.length})`}
            </Button>
            {showLog && (
              <ul id="conversa" aria-label="Conversa" aria-live="polite" className="mb-2 grid max-h-48 gap-2 overflow-y-auto">
                {msgs.map((m) => (
                  <li
                    key={m.id}
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.from === "voce" ? "justify-self-end bg-accent text-accent-foreground" : "justify-self-start bg-secondary text-secondary-foreground"}`}
                  >
                    <span className="sr-only">{m.from === "voce" ? "Você: " : "FoodPilot: "}</span>
                    {m.text}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
            setInput("");
          }}
        >
          {/* Sem onMicClick a voz ainda não existe: o botão fica desabilitado e o texto é o caminho completo. */}
          <Button type="button" variant="secondary" size="icon" disabled={!onMicClick} onClick={onMicClick}
            aria-label={onMicClick ? "Falar" : "Falar (voz em breve)"} title={onMicClick ? undefined : "Voz em breve"}>
            <Mic />
          </Button>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Fale ou digite…" aria-label="Mensagem" maxLength={4000} />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Enviar"><Send /></Button>
        </form>
      </footer>
    </div>
  );
}
