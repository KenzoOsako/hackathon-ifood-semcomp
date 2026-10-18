"use client";
import { useAgent } from "./agent-context";
import { AgentView, type VoiceState } from "./agent-view";

export type { VoiceState };
type AgentScreenProps = { voiceState?: VoiceState; onMicClick?: () => void };

// Liga a tela ao estado da conversa. A voz (Felipe) entra pelas props voiceState e onMicClick.
export function AgentScreen({ voiceState, onMicClick }: AgentScreenProps) {
  const a = useAgent();
  return (
    <AgentView
      view={a.view}
      options={a.options}
      proposal={a.turn?.proposal}
      selected={a.selected}
      msgs={a.msgs}
      query={a.query}
      busy={a.busy}
      error={a.error}
      voiceState={voiceState}
      onMicClick={onMicClick}
      onSend={(t) => void a.send(t)}
      onSelect={(i) => void a.select(i)}
      onApprove={() => void a.approve()}
      onCancel={() => void a.cancel()}
      onEditOrder={a.showOptions}
      onRetry={() => void a.retry()}
      onNewSearch={a.newSearch}
    />
  );
}
