import { approveProposal } from "@/agent/agent";
import { ApprovalRequestSchema } from "@/contracts";
import { visitorSessions } from "@/agent/visitor-session";
import { failureResponse, jsonBody, jsonResponse, requireMockRequest } from "@/agent/http";

// Aprova apenas proposta local; não cria carrinho nem envia pedido.
export async function POST(req: Request) {
  try {
    requireMockRequest(req);
    const request = ApprovalRequestSchema.parse(await jsonBody(req));
    const { visitor } = visitorSessions.resolve(req, false);
    return jsonResponse(await visitorSessions.run(visitor, (conversation) => approveProposal(conversation, request)));
  } catch (error) { return failureResponse(error); }
}
