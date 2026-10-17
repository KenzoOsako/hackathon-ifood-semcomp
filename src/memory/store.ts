// Memória do usuário (camada 2). Em memória no esqueleto; a frente "Recomendação, memória e dados"
// troca por armazenamento persistente. Só grava com consentimento (flag `consent`).
import type { MemoryEvent } from "@/contracts";

const g = globalThis as unknown as { __memory?: Map<string, { consent: boolean; events: MemoryEvent[] }> };
const store = (g.__memory ??= new Map());

export function getMemory(userId: string) {
  return store.get(userId) ?? { consent: false, events: [] };
}

export function setConsent(userId: string, consent: boolean) {
  const m = getMemory(userId);
  store.set(userId, { ...m, consent });
}

export function remember(userId: string, event: Omit<MemoryEvent, "at">) {
  const m = getMemory(userId);
  if (!m.consent) return false;
  store.set(userId, { ...m, events: [...m.events, { ...event, at: new Date().toISOString() }] });
  return true;
}

// Transparência: o usuário vê e apaga o que o agente aprendeu.
export function forget(userId: string) {
  store.delete(userId);
}
