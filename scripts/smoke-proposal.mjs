// Servidor mock local já iniciado. Não imprime cookies ou conteúdo de sessão.
import assert from "node:assert/strict";

const base = new URL(process.env.FOODPILOT_BASE_URL ?? "http://127.0.0.1:3107");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || base.protocol !== "http:") {
  throw new Error("Este smoke test aceita somente servidor HTTP local com mock.");
}
async function post(path, body, cookie, requestOrigin = base.origin) {
  return fetch(new URL(`/api/${path}`, base), {
    method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  });
}
const first = await post("chat", { message: "fome", sessionId: "shared-client-id" });
assert.equal(first.status, 200);
assert.equal(first.headers.get("cache-control"), "no-store");
const cookie = first.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
assert.equal((await first.json()).state, "ESCOLHENDO_OPCAO");
const second = await post("chat", { message: "fome", sessionId: "shared-client-id" });
assert.equal(second.status, 200);
const otherCookie = second.headers.get("set-cookie")?.split(";")[0];
assert.ok(otherCookie); assert.notEqual(otherCookie, cookie);
const selection = await post("chat", { message: "1" }, cookie);
assert.equal(selection.status, 200);
const selected = await selection.json();
assert.equal(selected.state, "AGUARDANDO_CONFIRMACAO");
assert.equal(selected.proposal.cost.status, "unknown");
assert.equal(selected.cart, undefined); assert.equal(selected.order, undefined);
assert.equal(selected.proposal.subjectRef, undefined);
const approval = { proposalId: selected.proposal.id, version: selected.proposal.version, interactionId: "local-smoke", channel: "button" };
assert.equal((await post("confirm", approval, otherCookie)).status, 403);
assert.equal((await post("confirm", approval, cookie)).status, 400);
assert.equal((await post("confirm", { explicit: true, sessionId: "shared-client-id" }, cookie)).status, 400);
assert.equal((await post("chat", { message: "pizza" }, cookie, "https://foreign.invalid")).status, 403);
assert.equal((await post("chat", { message: "cancelar" }, cookie)).status, 200);
assert.equal((await post("confirm", approval, cookie)).status, 409);
assert.equal((await fetch(new URL("/api/order?orderId=legacy", base))).status, 410);
console.log("PASS: HTTP local — busca, cookie de servidor, isolamento, proposta sem escrita, pendências, CSRF, cancelamento e tracking desativado.");
