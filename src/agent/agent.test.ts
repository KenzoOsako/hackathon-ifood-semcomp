import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConversation, handleMessage } from "./agent";
import { createMockMcp } from "@/mcp/mock";

beforeEach(() => { vi.stubEnv("MCP_MODE", "mock"); });
describe("orquestrador somente leitura", () => {
  it("zero endereços não busca; vários exigem seleção explícita", async () => {
    const c = createConversation("s1"); const port = createMockMcp();
    const search = vi.spyOn(port, "searchOffers");
    vi.spyOn(port, "listAddresses").mockResolvedValue([]);
    expect((await handleMessage(c, "pizza", port)).reply).toContain("Nenhum endereço");
    expect(search).not.toHaveBeenCalled();
    vi.mocked(port.listAddresses).mockResolvedValue([{ addressId: "a1", alias: "Um", formatted: "Fictício 1" }, { addressId: "a2", alias: "Dois", formatted: "Fictício 2" }]);
    expect((await handleMessage(c, "pizza", port)).reply).toContain("Escolha um endereço");
    expect(search).not.toHaveBeenCalled();
    await handleMessage(c, "endereço 2", port); await handleMessage(c, "pizza", port);
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ addressId: "a2" }));
  });
  it("refinamento invalida proposta antes de leitura externa que falha", async () => {
    const c = createConversation("s1"); const port = createMockMcp();
    await handleMessage(c, "fome", port); const turn = await handleMessage(c, "1", port);
    vi.spyOn(port, "listAddresses").mockRejectedValue(new Error("indisponível"));
    await expect(handleMessage(c, "pizza", port)).rejects.toThrow();
    expect(c.proposal).toBeUndefined();
    expect(c.proposals.get(turn.proposal!.id, "s1", 1).state).toBe("cancelled");
  });
  it("mudança de endereço não reaproveita opções da região anterior", async () => {
    const c = createConversation("s1"); const port = createMockMcp();
    await handleMessage(c, "fome", port);
    vi.spyOn(port, "listAddresses").mockResolvedValue([{ addressId: "novo", alias: "Novo", formatted: "Fictício" }]);
    await expect(handleMessage(c, "1", port)).rejects.toThrow();
    expect(c.options).toEqual([]);
  });
});
