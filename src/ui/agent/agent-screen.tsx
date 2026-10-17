"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Mic, Send } from "lucide-react";
import { Alert } from "@/ui/components/alert";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { Input } from "@/ui/components/input";
import type { OrbState } from "@/ui/components/orb";
import { useAgent } from "./agent-context";
import { OrbStage } from "./orb-stage";

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

export function AgentScreen({ voiceState, onMicClick }: AgentScreenProps) {
  const { msgs, turn, busy, error, send, retry } = useAgent();
  const [input, setInput] = useState("");
  const [showLog, setShowLog] = useState(false);

  const orbState: OrbState = busy ? "thinking" : error ? "error" : voiceState && voiceState !== "idle" ? voiceState : "idle";
  const lastReply = [...msgs].reverse().find((m) => m.from === "agente")?.text;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para o início">
          <Link href="/"><ArrowLeft /></Link>
        </Button>
        <span className="font-display text-lg font-bold">FoodPilot</span>
        <Badge variant="simulated" className="ml-auto">Simulado</Badge>
      </header>

      <div className="agent-bg flex min-h-0 flex-1 flex-col">
      <main className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-6 py-6 text-center">
        <h1 className="font-display text-balance text-3xl font-bold leading-tight">Qual a sua vibe de hoje?</h1>
        <OrbStage state={orbState} />
        <p role="status" aria-live="polite" className="text-sm font-semibold text-muted-foreground">{STATE_LABEL[orbState]}</p>

        {lastReply && <p className="whitespace-pre-wrap text-base leading-snug">{lastReply}</p>}

        {error && (
          <Alert variant="destructive" className="w-full text-left">
            <AlertTriangle aria-hidden="true" />
            <div className="flex-1">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" disabled={busy} onClick={() => void retry()}>
                Tentar de novo
              </Button>
            </div>
          </Alert>
        )}

        {/* Voltando da tela de opções/proposta, o caminho de volta fica à vista. */}
        {turn?.state === "ESCOLHENDO_OPCAO" && turn.options && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/agente/opcoes">Ver as {turn.options.length} {turn.options.length === 1 ? "opção" : "opções"}</Link>
          </Button>
        )}
        {turn?.state === "AGUARDANDO_CONFIRMACAO" && (
          <Button asChild variant="outline" className="w-full"><Link href="/agente/proposta">Ver a proposta</Link></Button>
        )}

        {msgs.length === 0 && (
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Sugestões">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void send(s)}>{s}</Button>
              </li>
            ))}
          </ul>
        )}
      </main>
      </div>

      <footer className="border-t border-border bg-background px-3 pb-3 pt-2">
        {msgs.length > 0 && (
          <>
            <Button variant="ghost" size="sm" aria-expanded={showLog} aria-controls="conversa" onClick={() => setShowLog((v) => !v)}>
              {showLog ? <ChevronDown /> : <ChevronUp />}
              {showLog ? "Esconder conversa" : `Ver conversa (${msgs.length})`}
            </Button>
            {showLog && (
              <ul id="conversa" role="log" aria-label="Conversa" className="mb-2 grid max-h-36 gap-2 overflow-y-auto">
                {msgs.map((m, i) => (
                  <li
                    key={i}
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
