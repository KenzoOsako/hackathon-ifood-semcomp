"use client";
import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Mic, Search, Send } from "lucide-react";
import type { Option, PublicProposal } from "@/contracts";
import { Alert } from "@/ui/components/alert";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { Input } from "@/ui/components/input";
import { Orb, type OrbState } from "@/ui/components/orb";
import { cn } from "@/ui/lib/utils";
import { DATA_ORIGIN, type Msg, type View } from "./agent-context";
import { ContinueView } from "./continue-view";
import { ProposalView } from "./proposal-view";
import { ResultRow } from "./result-row";

// Estados vindos da voz (Felipe). Enquanto não houver voz, a UI só usa idle/thinking/error.
export type VoiceState = "idle" | "listening" | "speaking" | "error";

const STATE_LABEL: Record<OrbState, string> = {
  idle: "Pronto para ouvir você",
  listening: "Ouvindo…",
  thinking: "Pensando…",
  speaking: "Respondendo…",
  error: "Algo deu errado",
};

// Frases fixas de atalho: enviam uma mensagem como se o usuário tivesse digitado.
const SUGGESTIONS = ["Jantar sem gastar muito", "Algo diferente hoje", "Pizza até R$ 45"];
// Abas só de cenário, como na home: imitam a busca do iFood e não fazem nada.
const TABS = ["Todo o iFood", "Restaurantes", "Mercados", "Farmácias"];

export type AgentViewProps = {
  view: View;
  options: Option[];
  proposal?: PublicProposal;
  selected: Option | null;
  itemNames?: Record<string, string>;
  msgs: Msg[];
  query: string;
  busy: boolean;
  error: string | null;
  voiceState?: VoiceState;
  onMicClick?: () => void;
  onSend: (text: string) => void;
  onSelect: (index: number) => void;
  onApprove: () => void;
  onCancel: () => void;
  onEditOrder: () => void;
  onRetry: () => void;
  onNewSearch: () => void;
};

// Tela única e linear: a área de cima mostra o que o agente encontrou (lista, proposta ou continuidade)
// e o painel de baixo é a conversa, com o orbe. Nada aqui chama a API; quem liga os eventos é quem usa a view.
export function AgentView(p: AgentViewProps) {
  const reduceMotion = useReducedMotion();
  const [input, setInput] = useState("");
  const [showLog, setShowLog] = useState(false);
  const hasView = p.view !== null;

  let orbState: OrbState = p.voiceState ?? "idle";
  if (p.error) orbState = "error";
  if (p.busy) orbState = "thinking";
  const lastReply = [...p.msgs].reverse().find((m) => m.from === "agente")?.text;
  // Parado, mostra a última resposta do agente (no modo texto ela é a "fala"); nos demais estados, o estado.
  const spoken = orbState === "idle" || orbState === "speaking" ? (lastReply ?? STATE_LABEL.idle) : STATE_LABEL[orbState];
  const caption = (
    <div className={cn("w-full px-6 text-center", hasView ? "max-h-24 overflow-y-auto pt-2 text-sm" : "pb-1 text-base")}>
      <p role="status" aria-live="polite" className="whitespace-pre-wrap leading-snug text-[color:var(--agent-voice)]">{spoken}</p>
      {p.error && (
        <Alert variant="destructive" className="mt-2 text-left">
          <AlertTriangle aria-hidden="true" />
          <div className="flex-1">
            <p>{p.error}</p>
            <Button variant="outline" size="sm" className="mt-2" disabled={p.busy} onClick={p.onRetry}>Tentar de novo</Button>
          </div>
        </Alert>
      )}
    </div>
  );

  return (
    <div className="agent-bg flex min-h-0 flex-1 flex-col">
      <section
        aria-label="Resultados"
        className={cn("flex min-h-0 flex-col overflow-hidden transition-[flex-grow,opacity] duration-500", hasView ? "grow opacity-100" : "grow-0 basis-0 opacity-0")}
      >
        {p.view === "options" && (
          <>
            <header className="px-3 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="icon" aria-label="Voltar para o início"><Link href="/"><ArrowLeft /></Link></Button>
                <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border px-4 text-base">
                  <Search className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{p.query}</span>
                </div>
              </div>
              <div aria-hidden="true" className="mt-3 flex gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map((tab) => (
                  <span key={tab} className={cn("shrink-0 rounded-full px-3 py-1.5", tab === "Restaurantes" ? "border border-border font-semibold shadow-sm" : "text-muted-foreground")}>{tab}</span>
                ))}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                {DATA_ORIGIN === "mock" && <Badge variant="simulated">Simulado</Badge>}
                <span>O total com frete e taxas só aparece na revisão, quando estiver confirmado.</span>
              </div>
              <ul className="divide-y divide-border">
                {p.options.map((option, i) => (
                  <motion.li
                    key={option.candidate.itemId}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                  >
                    <ResultRow option={option} disabled={p.busy} onSelect={() => p.onSelect(i)} />
                  </motion.li>
                ))}
              </ul>
              <p className="py-3 text-center text-sm text-muted-foreground">Quer mudar algo? Continue a conversa aqui embaixo.</p>
            </div>
          </>
        )}
        {p.view === "proposal" && p.proposal && (
          <ProposalView embedded proposal={p.proposal} option={p.selected} itemNames={p.itemNames} busy={p.busy} error={null}
            onApprove={p.onApprove} onCancel={p.onCancel} onEditOrder={p.onEditOrder} onRetry={p.onRetry} />
        )}
        {p.view === "continue" && p.proposal && (
          <ContinueView embedded proposal={p.proposal} option={p.selected} itemNames={p.itemNames} onNewSearch={p.onNewSearch} />
        )}
      </section>

      <section aria-label="Assistente" className={cn("relative flex min-h-0 flex-col transition-[flex-grow] duration-500", hasView ? "grow-0" : "grow")}>
        {!hasView && (
          <header className="flex items-center gap-2 px-3 py-2">
            <Button asChild variant="ghost" size="icon" aria-label="Voltar para o início"><Link href="/"><ArrowLeft /></Link></Button>
            <span className="font-display text-lg font-medium">FoodPilot</span>
            <Badge variant="simulated" className="ml-auto">Simulado</Badge>
          </header>
        )}

        <div className={cn("flex min-h-0 flex-col items-center", hasView ? "" : "flex-1 justify-center overflow-y-auto text-center")}>
          {!hasView && <h1 className="px-4 font-display text-balance text-3xl font-medium leading-tight">Qual a sua vibe de hoje?</h1>}
          {hasView && caption}
          <Orb size={hasView ? "strip" : "hero"} state={orbState} />
          {!hasView && caption}
          {!hasView && p.msgs.length === 0 && (
            <ul className="flex flex-wrap justify-center gap-2 px-4" aria-label="Sugestões">
              {SUGGESTIONS.map((s) => (
                <li key={s}><Button variant="outline" size="sm" disabled={p.busy} onClick={() => p.onSend(s)}>{s}</Button></li>
              ))}
            </ul>
          )}
        </div>

        <footer className="relative px-3 pb-3">
          {p.msgs.length > 0 && (
            <>
              <Button variant="ghost" size="sm" aria-expanded={showLog} aria-controls="conversa" onClick={() => setShowLog((v) => !v)}>
                {showLog ? <ChevronDown /> : <ChevronUp />}
                {showLog ? "Esconder conversa" : `Ver conversa (${p.msgs.length})`}
              </Button>
              {showLog && (
                <ul id="conversa" role="log" aria-label="Conversa" className="mb-2 grid max-h-36 gap-2 overflow-y-auto rounded-2xl bg-background/90 p-2">
                  {p.msgs.map((m) => (
                    <li
                      key={m.id}
                      className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm", m.from === "voce" ? "justify-self-end bg-accent text-accent-foreground" : "justify-self-start bg-secondary text-secondary-foreground")}
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
              p.onSend(input);
              setInput("");
            }}
          >
            {/* Sem onMicClick a voz ainda não existe: o botão fica desabilitado e o texto é o caminho completo. */}
            <Button type="button" variant={orbState === "listening" ? "default" : "secondary"} size="icon" disabled={!p.onMicClick} onClick={p.onMicClick}
              aria-label={p.onMicClick ? "Falar" : "Falar (voz em breve)"} title={p.onMicClick ? undefined : "Voz em breve"}>
              <Mic />
            </Button>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Refine ou peça outra coisa…" aria-label="Mensagem" maxLength={4000} />
            <Button type="submit" size="icon" disabled={p.busy || !input.trim()} aria-label="Enviar"><Send /></Button>
          </form>
        </footer>
      </section>
    </div>
  );
}
