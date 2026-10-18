import { registrarCodigo } from "@/mcp/real/oauth";

// Redirect cadastrado no portal: http://localhost:<IFOOD_CALLBACK_PORT>/callback (app rodando nessa porta).
// Chega por navegação vinda do iFood, então o cookie SameSite=Strict não vem: só guardamos o código e
// seguimos para /api/auth/concluir por navegação da nossa própria página, que já leva o cookie.
const pagina = (corpo: string, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer">${corpo}`, {
  status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
});

export async function GET(req: Request) {
  const u = new URL(req.url);
  const erro = u.searchParams.get("error");
  if (erro) return pagina(`<p>O login iFood não foi concluído (${erro.replace(/[^a-z_]/gi, "")}). Feche esta aba e tente de novo.</p>`, 400);
  const state = u.searchParams.get("state") ?? ""; const code = u.searchParams.get("code") ?? "";
  try { registrarCodigo(state, code); } catch { return pagina("<p>Login expirado ou inválido. Tente conectar de novo.</p>", 400); }
  const destino = `/api/auth/concluir?state=${encodeURIComponent(state)}`;
  return pagina(`<meta http-equiv="refresh" content="0;url=${destino}"><p>Concluindo login… <a href="${destino}">continuar</a></p>`);
}
