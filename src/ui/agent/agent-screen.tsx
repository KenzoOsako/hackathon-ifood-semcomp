"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, LogIn, Mic, Send } from "lucide-react";
import { Alert } from "@/ui/components/alert";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { Input } from "@/ui/components/input";
import { Orb, type OrbState } from "@/ui/components/orb";
import { cn } from "@/ui/lib/utils";
import { useAgent } from "./agent-context";
import { PlanoView, RevisaoView, SacolaView } from "./guide-telas";


// Ocasiões de exemplo (storyboard): enviam a frase como se a pessoa tivesse falado.
const SUGGESTIONS = ["Aniversário de um amigo, pizza em casa e filme", "Meu filho está gripado, quero algo leve", "Churrasco para 8 pessoas"];

// Tela de produto do Guide. Layout do Malveste (resultados em cima, orbe e conversa embaixo); quem decide o que
// aparece em cima é o `tela.tipo` que o agente mandou. Sem tela, só o orbe e a legenda (abertura e perguntas).
export function AgentScreen() {
  const g = useAgent();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [showLog, setShowLog] = useState(false);
  const tela = g.tela;
  const hasView = tela !== null;
  const compact = tela?.tipo === "aguardando_aprovacao" || tela?.tipo === "sacola";
  // Com plano na tela e a conversa aberta, o orbe vira bolinha ao lado da legenda para o plano não ficar sem altura.
  const miniOrb = compact || (hasView && showLog);

  let orbState: OrbState = g.state === "transcribing" ? "thinking" : g.state;
  if (g.busy && g.state !== "speaking") orbState = "thinking";
  const conversou = g.lines.length > 1;
  const lastReply = [...g.lines].reverse().find((l) => l.from === "agente")?.text ?? "";
  const shown = g.unclear ? `Não entendi bem: "${g.unclear}"` : orbState === "thinking" ? "Pensando…" : orbState === "listening" ? "Ouvindo…" : lastReply;
  const simulado = g.dados !== "real";
  const adjust = () => inputRef.current?.focus();

  const caption = (
    <div className={cn("w-full text-center", miniOrb ? "min-w-0 flex-1 text-left text-sm" : hasView ? "px-6 pt-2 text-sm" : "px-6 pb-1 text-base")}>
      <p aria-hidden="true" className="line-clamp-2 leading-snug text-[color:var(--agent-voice)]">{shown}</p>
      <p role="status" aria-live="polite" className="sr-only whitespace-pre-wrap">{lastReply}</p>
    </div>
  );

  return (
    <div className="agent-bg flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-2 px-3 py-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para o início"><Link href="/"><ArrowLeft /></Link></Button>
        <span className="font-display text-lg font-medium">FoodPilot</span>
        {simulado ? <Badge variant="simulated" className="ml-auto">Simulado</Badge> : !g.login && <Badge variant="success" className="ml-auto">iFood real</Badge>}
      </header>

      {g.login && (
        <Alert className="mx-3">
          <LogIn aria-hidden="true" />
          <div className="flex-1">
            <p>Conecte sua conta iFood para eu buscar opções reais.</p>
            {/* Link comum (não fetch): o login do iFood é uma navegação com redirecionamento. */}
            <Button asChild size="sm" className="mt-2"><a href={g.login.url}>Conectar iFood</a></Button>
          </div>
        </Alert>
      )}

      <section aria-label="Resultados" className={cn("flex min-h-0 flex-col overflow-hidden transition-[flex-grow,opacity] duration-500", hasView ? "min-h-[280px] grow opacity-100" : "grow-0 basis-0 opacity-0")}>
        {(tela?.tipo === "mostrar_plano" || tela?.tipo === "plano_atualizado") && (
          <PlanoView key={`${tela.plano.planoId}-${tela.plano.versao}`} plano={tela.plano} atualizado={tela.tipo === "plano_atualizado"} busy={g.busy} onSend={g.sendText} onAdjust={adjust} />
        )}
        {tela?.tipo === "aguardando_aprovacao" && <RevisaoView plano={tela.plano} busy={g.busy} onSend={g.sendText} onAdjust={adjust} />}
        {tela?.tipo === "sacola" && <SacolaView plano={tela.plano} />}
      </section>

      <section aria-label="Assistente" className={cn("relative flex min-h-0 flex-col transition-[flex-grow] duration-500", hasView ? "shrink-0 grow-0" : "grow")}>
        <div className={cn("flex min-h-0", miniOrb ? "items-center gap-3 px-4 pt-2" : "flex-col items-center", !hasView && "flex-1 justify-center overflow-y-auto text-center")}>
          {!hasView && !conversou && <h1 className="px-4 font-display text-balance text-3xl font-medium leading-tight">Qual a sua vibe de hoje?</h1>}
          {hasView && !miniOrb && caption}
          <Orb size={miniOrb ? "mini" : hasView ? "strip" : "hero"} state={orbState} />
          {(miniOrb || !hasView) && caption}
          {!hasView && !conversou && (
            <ul className="flex flex-wrap justify-center gap-2 px-4" aria-label="Sugestões">
              {SUGGESTIONS.map((s) => (
                <li key={s}><Button variant="outline" size="sm" disabled={g.busy} onClick={() => g.sendText(s)}>{s}</Button></li>
              ))}
            </ul>
          )}
        </div>

        <footer className="relative px-3 pb-3">
          {conversou && !compact && (
            <>
              <Button variant="ghost" size="sm" aria-expanded={showLog} aria-controls="conversa" onClick={() => setShowLog((v) => !v)}>
                {showLog ? <ChevronDown /> : <ChevronUp />}
                {showLog ? "Esconder conversa" : `Ver conversa (${g.lines.length})`}
              </Button>
              {showLog && (
                <ul id="conversa" role="log" aria-label="Conversa" className={cn("mb-2 grid gap-2 overflow-y-auto rounded-2xl bg-background/90 p-2", hasView ? "max-h-24" : "max-h-36")}>
                  {g.lines.map((m) => (
                    <li key={m.id} className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm", m.from === "voce" ? "justify-self-end bg-accent text-accent-foreground" : "justify-self-start bg-secondary text-secondary-foreground")}>
                      <span className="sr-only">{m.from === "voce" ? "Você: " : "Guide: "}</span>
                      {m.text}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); g.sendText(input); setInput(""); }}>
            <Button type="button" variant={orbState === "listening" ? "default" : "outline"} size="icon" onClick={g.toggle} aria-label={g.label} title={g.label}>
              <Mic />
            </Button>
            <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Fale ou digite o que precisa…" aria-label="Mensagem" maxLength={4000} />
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Enviar"><Send /></Button>
          </form>
        </footer>
      </section>
    </div>
  );
}
