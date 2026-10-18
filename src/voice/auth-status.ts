// Resposta de GET /api/auth/status (rota do Hyago): { modo: "real" | "mock", conectado: boolean }.
// Só no modo real, e sem conta conectada, a tela precisa do botão "Conectar iFood".
export const LOGIN_PATH = "/api/auth/login";

export function needsLogin(status: unknown): boolean {
  const s = status as { modo?: unknown; conectado?: unknown } | null;
  return s?.modo === "real" && s.conectado === false;
}
