import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as chat } from "@/app/api/chat/route";
import { POST as confirm } from "@/app/api/confirm/route";
import { GET as order } from "@/app/api/order/route";
import { getMcp } from "@/mcp";
import { createMockMcp } from "@/mcp/mock";
import { visitorSessions } from "./visitor-session";
import type { McpClient } from "@/mcp/types";

vi.mock("@/mcp", () => ({ getMcp: vi.fn() }));
const origin = "http://localhost:3000";
function req(path: string, body: unknown, cookie?: string) {
  return new Request(`${origin}/api/${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}
const cookieOf = (response: Response) => response.headers.get("set-cookie")!.split(";")[0];
let client: McpClient;
beforeEach(() => {
  vi.stubEnv("MCP_MODE", "mock");
  client = createMockMcp(); vi.mocked(getMcp).mockReturnValue(client);
  vi.spyOn(client, "createCart"); vi.spyOn(client, "submitOrder"); vi.spyOn(client, "trackOrder");
});
async function conversation() {
  const response = await chat(req("chat", { message: "fome", sessionId: "legacy-shared" }));
  expect(response.status).toBe(200);
  return cookieOf(response);
}

describe("rotas seguras do fluxo mock", () => {
  it("busca, seleciona e cancela sem criar carrinho/pedido; total desconhecido impede aprovação", async () => {
    const cookie = await conversation();
    const selected = await chat(req("chat", { message: "1" }, cookie));
    const turn = await selected.json();
    expect(turn.proposal).toMatchObject({ state: "awaiting_approval", cost: { status: "unknown" } });
    expect(turn.proposal.cost.total).toBeUndefined(); expect(turn.cart).toBeUndefined(); expect(turn.order).toBeUndefined();
    expect(turn.reply).toContain("Nenhum carrinho remoto");
    const denied = await confirm(req("confirm", { proposalId: turn.proposal.id, version: 1, interactionId: "i1", channel: "button" }, cookie));
    expect(denied.status).toBe(400);
    expect((await chat(req("chat", { message: "cancelar" }, cookie))).status).toBe(200);
    expect((await confirm(req("confirm", { proposalId: turn.proposal.id, version: 1, interactionId: "i2", channel: "button" }, cookie))).status).toBe(409);
    expect(client.createCart).not.toHaveBeenCalled(); expect(client.submitOrder).not.toHaveBeenCalled(); expect(client.trackOrder).not.toHaveBeenCalled();
  });
  it("ignora sessionId compartilhado e nega proposta de outro visitante", async () => {
    const a = await conversation(); const b = await conversation(); expect(a).not.toBe(b);
    const turn = await (await chat(req("chat", { message: "1" }, a))).json();
    expect((await confirm(req("confirm", { proposalId: turn.proposal.id, version: 1, interactionId: "i1", channel: "button" }, b))).status).toBe(403);
    expect((await chat(req("chat", { message: "1", sessionId: "legacy-shared" }, b))).status).toBe(200);
  });
  it("rejeita consentimento legado, identidade injetada e aprovação sem cookie", async () => {
    const cookie = await conversation();
    expect((await confirm(req("confirm", { sessionId: "legacy-shared", explicit: true }, cookie))).status).toBe(400);
    const request = { proposalId: "p1", version: 1, interactionId: "i1", channel: "button" };
    expect((await confirm(req("confirm", { ...request, subjectRef: "outro" }, cookie))).status).toBe(400);
    expect((await confirm(req("confirm", request))).status).toBe(403);
  });
  it("aprova snapshot completo uma vez e retorna apenas resumo local público", async () => {
    const cookie = await conversation();
    // Fixture criada no servidor: nunca aceitar custo/identidade enviados no body.
    const { visitor } = visitorSessions.resolve(req("chat", {}, cookie), false);
    const money = { currency: "BRL" as const, cents: 1000 };
    const p = visitor.conversation.proposals.create(visitor.conversation.subjectRef, {
      merchantRef: "m1", addressRef: "a1", items: [{ ref: "i1", quantity: 1, unitPrice: money }],
      cost: { items: money, delivery: { ...money, cents: 0 }, fees: { ...money, cents: 0 }, total: money, status: "confirmed" },
      unresolved: [], expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    visitor.conversation.proposals.review(p.id, visitor.conversation.subjectRef, 1);
    visitor.conversation.proposal = { id: p.id, version: 1 };
    const request = { proposalId: p.id, version: 1, interactionId: "click", channel: "button" };
    const approved = await confirm(req("confirm", request, cookie)); expect(approved.status).toBe(200);
    const result = await approved.json(); expect(result.state).toBe("PROPOSTA_APROVADA");
    expect(result.reply).toContain("Nenhum item foi adicionado");
    expect(result.proposal.subjectRef).toBeUndefined(); expect(result.proposal.addressRef).toBeUndefined(); expect(result.order).toBeUndefined();
    expect((await confirm(req("confirm", { ...request, interactionId: "another" }, cookie))).status).toBe(409);
    expect(client.createCart).not.toHaveBeenCalled(); expect(client.submitOrder).not.toHaveBeenCalled();
  });
  it("conclui fluxo de busca, seleção e aprovação via /api/confirm quando o candidato possui encargos confirmados", async () => {
    const searchRes = await chat(req("chat", { message: "pizza" }));
    expect(searchRes.status).toBe(200);
    const cookie = cookieOf(searchRes);
    const selectedRes = await chat(req("chat", { message: "1" }, cookie));
    expect(selectedRes.status).toBe(200);
    const selectedTurn = await selectedRes.json();
    expect(selectedTurn.proposal).toMatchObject({
      state: "awaiting_approval",
      cost: { status: "confirmed", total: { currency: "BRL", cents: 4580 } },
      unresolved: [],
    });
    const confirmRes = await confirm(
      req("confirm", { proposalId: selectedTurn.proposal.id, version: selectedTurn.proposal.version, interactionId: "btn-pizza-1", channel: "button" }, cookie),
    );
    expect(confirmRes.status).toBe(200);
    const approvedTurn = await confirmRes.json();
    expect(approvedTurn.state).toBe("PROPOSTA_APROVADA");
    expect(approvedTurn.proposal.state).toBe("approved");
    expect(approvedTurn.reply).toContain("RESUMO MANUAL DO PEDIDO");
    expect(approvedTurn.reply).toContain("Forno & Cia");
    expect(client.createCart).not.toHaveBeenCalled();
    expect(client.submitOrder).not.toHaveBeenCalled();
  });
  it("nega origem cruzada/ausente, payload malformado e corpo excessivo", async () => {
    const foreign = req("chat", { message: "fome" }); foreign.headers.set("origin", "https://evil.invalid");
    expect((await chat(foreign)).status).toBe(403);
    const noOrigin = req("chat", { message: "fome" }); noOrigin.headers.delete("origin");
    expect((await chat(noOrigin)).status).toBe(403);
    expect((await chat(new Request(`${origin}/api/chat`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{" }))).status).toBe(400);
    expect((await chat(req("chat", { message: "a".repeat(17_000) }))).status).toBe(400);
  });
  it("serializa requisições da mesma sessão sem duplicar I/O", async () => {
    const cookie = await conversation();
    let release!: (value: Awaited<ReturnType<McpClient["listAddresses"]>>) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    vi.spyOn(client, "listAddresses").mockImplementationOnce(() => { entered(); return new Promise((resolve) => { release = resolve; }); });
    const first = chat(req("chat", { message: "pizza" }, cookie)); await started;
    const duplicate = await chat(req("chat", { message: "pizza" }, cookie));
    expect(duplicate.status).toBe(409);
    release([{ addressId: "a1", alias: "Teste", formatted: "Endereço fictício" }]);
    expect((await first).status).toBe(200);
  });
  it("compara Origin com Host recebido quando Next normaliza a URL interna", async () => {
    const localAlias = req("chat", { message: "fome" });
    localAlias.headers.set("host", "127.0.0.1:3000"); localAlias.headers.set("origin", "http://127.0.0.1:3000");
    expect((await chat(localAlias)).status).toBe(200);
    const spoof = req("chat", { message: "fome" }); spoof.headers.set("host", "localhost:3000");
    spoof.headers.set("origin", "https://foreign.invalid"); spoof.headers.set("x-forwarded-host", "foreign.invalid");
    expect((await chat(spoof)).status).toBe(403);
  });
  it("não ecoa mensagem interna nem permite modo real ou tracking legado", async () => {
    vi.spyOn(client, "listAddresses").mockRejectedValue(new Error("SYNTHETIC_PRIVATE_TOKEN"));
    const error = await chat(req("chat", { message: "fome" }));
    expect(error.status).toBe(503); expect(await error.text()).not.toContain("SYNTHETIC_PRIVATE_TOKEN");
    vi.stubEnv("MCP_MODE", "real"); expect((await chat(req("chat", { message: "fome" }))).status).toBe(503);
    expect((await order()).status).toBe(410); expect(client.trackOrder).not.toHaveBeenCalled();
  });
});
