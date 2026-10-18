"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGuideVoice } from "@/voice/use-guide-voice";
import { lerTela, type GuideTela } from "./plano-tela";

// Tipos do fluxo antigo (/api/chat): ainda usados pela prévia de design e pelas views de proposta.
export type Msg = { id: number; from: "voce" | "agente"; text: string };
export type View = "options" | "empty" | "proposal" | "continue" | null;
// Rótulo das views antigas. Na tela do Guide a origem vem do servidor (`dados` e `origem` do plano).
export const DATA_ORIGIN: "mock" | "real" = "mock";

type AgentContextValue = ReturnType<typeof useGuideVoice> & { tela: GuideTela | null };

const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent precisa estar dentro de AgentProvider");
  return ctx;
}

// Estado da conversa de /agente, agora com o agente V2 (/api/converse) pela voz do Felipe.
// O agente é o maestro: a tela mostrada vem do `tela.tipo` da última resposta; a UI não decide fluxo.
// Fala e texto vão pelo mesmo caminho (`sendText`), e os botões mandam a mesma frase que a pessoa diria.
export function AgentProvider({ children }: Readonly<{ children: ReactNode }>) {
  const guide = useGuideVoice();
  // O hook guarda o último plano recebido. Se o agente voltou a entender ou perguntar (S0–S2), o plano antigo
  // deixou de valer no servidor e não pode continuar na tela com botão de aprovar.
  const estado = [...guide.turns].reverse().find((t) => t.meta)?.meta?.estado;
  const semPlano = estado === "S0" || estado === "S1" || estado === "S2";
  const tela = useMemo(() => (semPlano ? null : lerTela(guide.screen)), [guide.screen, semPlano]);
  const value = useMemo(() => ({ ...guide, tela }), [guide, tela]);
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
