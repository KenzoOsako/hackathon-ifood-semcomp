"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Mic, MicOff, Search, Send } from "lucide-react";
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
import { ResultCard, ResultCardSkeleton } from "./result-card";

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
// Sem resultado, estas frases só preenchem o campo; quem decide enviar é a pessoa.
const EMPTY_HINTS = ["Quero gastar até R$ 60", "Pode ser outra comida"];

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
// e a faixa de baixo é a conversa, com o orbe. Nada aqui chama a API; quem liga os eventos é quem usa a view.
export function AgentView(p: Readonly<AgentViewProps>) {
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [expanded, setExpanded] = useState(0);
  // Primeira busca em andamento: abre a área de resultados com esqueletos.
  const searching = p.busy && p.view === null && p.query !== "";
  const hasView = p.view !== null || searching;

  let orbState: OrbState = p.voiceState ?? "idle";
  if (p.error) orbState = "error";
  if (p.busy) orbState = "thinking";
  const lastReply = [...p.msgs].reverse().find((m) => m.from === "agente")?.text;
  // Parado, mostra a última resposta do agente (no modo texto ela é a "fala"); nos demais estados, o estado.
  const spoken = orbState === "idle" || orbState === "speaking" ? (lastReply ?? STATE_LABEL.idle) : STATE_LABEL[orbState];
  // O selo "Simulado" do cabeçalho já rotula o dado; o prefixo só poluiria a legenda visível.
  const shown = spoken.replace(/^\[Simulado\]\s*/, "");
  // Revisão e continuidade precisam de altura: o orbe vira uma bolinha ao lado da legenda.
  const compact = p.view === "proposal" || p.view === "continue";

  function adjust() {
    inputRef.current?.focus();
  }
  function fillInput(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  const caption = (
    <div className={cn("w-full text-center", compact ? "min-w-0 flex-1 px-0 text-left text-sm" : hasView ? "px-6 pt-2 text-sm" : "px-6 pb-1 text-base")}>
      {/* A legenda visível é curta (2 linhas); o leitor de tela sempre recebe o texto completo. */}
      <p aria-hidden="true" className="line-clamp-2 leading-snug text-[color:var(--agent-voice)]">{shown}</p>
      <p role="status" aria-live="polite" className="sr-only whitespace-pre-wrap">{spoken}</p>
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
      <header className="flex items-center gap-2 px-3 py-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para o início"><Link href="/"><ArrowLeft /></Link></Button>
        <span className="font-display text-lg font-medium">FoodPilot</span>
        {DATA_ORIGIN === "mock" && <Badge variant="simulated" className="ml-auto">Simulado</Badge>}
      </header>

      <section
        aria-label="Resultados"
        aria-busy={searching}
        className={cn("flex min-h-0 flex-col overflow-hidden transition-[flex-grow,opacity] duration-500", hasView ? "grow opacity-100" : "grow-0 basis-0 opacity-0")}
      >
        {(p.view === "options" || p.view === "empty" || searching) && (
          <>
            <div className="flex items-center justify-between gap-2 px-4 pb-2">
              <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm shadow-sm">
                <Search className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{p.query}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {p.view === "options" ? `${p.options.length} ${p.options.length === 1 ? "opção" : "opções"} · total na revisão` : ""}
              </span>
            </div>
            {/* O fim da lista esmaece para indicar que há mais; o espaço extra deixa o último cartão sair da máscara. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 [mask-image:linear-gradient(to_bottom,#000_calc(100%-32px),transparent)]">
              {searching && (
                <div className="grid gap-2.5"><ResultCardSkeleton /><ResultCardSkeleton /><ResultCardSkeleton /></div>
              )}
              {!searching && p.view === "options" && (
                <ul className="grid gap-2.5">
                  {p.options.map((option, i) => (
                    <motion.li
                      key={option.candidate.itemId}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.06 }}
                    >
                      <ResultCard
                        option={option}
                        first={i === 0}
                        expanded={expanded === i}
                        disabled={p.busy}
                        onToggle={() => setExpanded(expanded === i ? -1 : i)}
                        onSelect={() => p.onSelect(i)}
                        onAdjust={adjust}
                      />
                    </motion.li>
                  ))}
                </ul>
              )}
              {!searching && p.view === "empty" && (
                <div className="grid justify-items-center gap-3 py-8 text-center">
                  <p className="font-display text-lg font-medium">Não achei nada nesse limite.</p>
                  <p className="text-sm text-muted-foreground">Quer subir o orçamento?</p>
                  <ul className="flex flex-wrap justify-center gap-2">
                    {EMPTY_HINTS.map((h) => (
                      <li key={h}><Button variant="outline" size="sm" onClick={() => fillInput(h)}>{h}</Button></li>
                    ))}
                  </ul>
                </div>
              )}
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
        <div className={cn("flex min-h-0", compact ? "items-center gap-3 px-4 pt-2" : "flex-col items-center", !hasView && "flex-1 justify-center overflow-y-auto text-center")}>
          {!hasView && <h1 className="px-4 font-display text-balance text-3xl font-medium leading-tight">Qual a sua vibe de hoje?</h1>}
          {hasView && !compact && caption}
          <Orb size={compact ? "mini" : hasView ? "strip" : "hero"} state={orbState} />
          {(compact || !hasView) && caption}
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
            <Button type="button" variant={orbState === "listening" ? "default" : "outline"} size="icon" disabled={!p.onMicClick} onClick={p.onMicClick}
              className="disabled:border-dashed disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100"
              aria-label={p.onMicClick ? "Falar" : "Falar (voz em breve)"} title={p.onMicClick ? undefined : "Voz em breve"}>
              {p.onMicClick ? <Mic /> : <MicOff />}
            </Button>
            <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Refine ou peça outra coisa…" aria-label="Mensagem" maxLength={4000} />
            <Button type="submit" size="icon" disabled={p.busy || !input.trim()} aria-label="Enviar"><Send /></Button>
          </form>
        </footer>
      </section>
    </div>
  );
}
