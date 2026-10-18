"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AgentTurn, Option } from "@/contracts";

export type Msg = { id: number; from: "voce" | "agente"; text: string };

// O servidor ainda só devolve dados do mock. Quando o contrato informar a origem de cada
// dado, este valor passa a vir dele; até lá, todo dado exibido é rotulado como simulado.
export const DATA_ORIGIN: "mock" | "real" = "mock";

type AgentContextValue = {
  msgs: Msg[];
  turn: AgentTurn | null;
  selected: Option | null;
  busy: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  select: (index: number) => Promise<void>;
  approve: () => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
};

const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent precisa estar dentro de AgentProvider");
  return ctx;
}

// Estado da conversa compartilhado entre as telas de /agente. O servidor guarda a sessão por cookie;
// aqui só guardamos o que a tela precisa mostrar. Recarregar a página reinicia a conversa.
export function AgentProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [turn, setTurn] = useState<AgentTurn | null>(null);
  const [selected, setSelected] = useState<Option | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAction = useRef<() => Promise<void>>(async () => {});

  const nextId = useRef(0);
  const addMsg = useCallback((from: Msg["from"], text: string) => {
    setMsgs((m) => [...m, { id: nextId.current++, from, text }]);
  }, []);

  // Quem decide a tela é o estado devolvido pelo servidor, nunca a UI.
  const goTo = useCallback((t: AgentTurn) => {
    let target = "/agente";
    if (t.state === "ESCOLHENDO_OPCAO") target = "/agente/opcoes";
    else if (t.state === "AGUARDANDO_CONFIRMACAO" || t.state === "PROPOSTA_APROVADA") target = "/agente/proposta";
    if (target !== pathname) router.push(target);
  }, [pathname, router]);

  const call = useCallback(async (url: string, body: object, shown?: string) => {
    setBusy(true);
    setError(null);
    if (shown) addMsg("voce", shown);
    try {
      // O visitante é identificado pelo cookie de sessão; não enviamos sessionId.
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const t = (await r.json()) as AgentTurn;
      if (!r.ok) {
        setError(t.reply || "Não consegui concluir agora.");
        return;
      }
      setTurn(t);
      addMsg("agente", t.reply);
      goTo(t);
    } catch {
      setError("Sem conexão com o servidor. Confira sua internet e tente de novo.");
    } finally {
      setBusy(false);
    }
  }, [goTo, addMsg]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    lastAction.current = () => call("/api/chat", { message });
    await call("/api/chat", { message }, message);
  }, [busy, call]);

  const select = useCallback(async (index: number) => {
    const option = turn?.options?.[index];
    if (!option || busy) return;
    setSelected(option);
    lastAction.current = () => call("/api/chat", { message: String(index + 1) });
    await call("/api/chat", { message: String(index + 1) }, `Quero a opção ${option.candidate.merchantName}`);
  }, [turn, busy, call]);

  // Aprovar manda a versão exibida; o servidor revalida tudo. Texto não aprova: só este botão ou a frase explícita.
  const approve = useCallback(async () => {
    const proposal = turn?.proposal;
    if (!proposal || busy) return;
    const body = { proposalId: proposal.id, version: proposal.version, interactionId: crypto.randomUUID(), channel: "button" };
    lastAction.current = () => call("/api/confirm", { ...body, interactionId: crypto.randomUUID() });
    await call("/api/confirm", body);
  }, [turn, busy, call]);

  const cancel = useCallback(async () => {
    if (busy) return;
    lastAction.current = () => call("/api/chat", { message: "cancelar" });
    await call("/api/chat", { message: "cancelar" }, "Cancelar proposta");
  }, [busy, call]);

  const retry = useCallback(() => lastAction.current(), []);

  return (
    <AgentContext.Provider value={{ msgs, turn, selected, busy, error, send, select, approve, cancel, retry }}>
      {children}
    </AgentContext.Provider>
  );
}
