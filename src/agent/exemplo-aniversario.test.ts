import { describe, expect, it } from "vitest";
import { createMockMcp } from "@/mcp/mock";
import { createConversation, handleMessage } from "./agent";

// Roteiro da demo: "hoje é aniversário da minha namorada" deve trazer um bolo (restaurante)
// e uma rosa (shopping), cada um da sua loja.
describe("exemplo do aniversário no mock", () => {
  it("recomenda o bolo e a rosa", async () => {
    const turn = await handleMessage(createConversation("s1"), "hoje é aniversário da minha namorada", createMockMcp());
    const lojas = (turn.options ?? []).map((o) => o.candidate.merchantName).sort();
    expect(lojas).toEqual(["Bolos & Cia", "Casa dos Presentes"]);
  });
});
