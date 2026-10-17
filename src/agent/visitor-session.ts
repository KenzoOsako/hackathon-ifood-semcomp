import { randomBytes, randomUUID } from "node:crypto";
import { createConversation, type Conversation } from "./agent";
import { ProposalError } from "./proposals";

const COOKIE = "foodpilot_visitor";
const LIFETIME_MS = 30 * 60_000;
interface Visitor { conversation: Conversation; expiresAt: number; busy: boolean }

export class VisitorSessions {
  private readonly sessions = new Map<string, Visitor>();
  constructor(private readonly capacity: number, private readonly now: () => number = Date.now) {}

  resolve(req: Request, create: boolean): { visitor: Visitor; cookie?: string } {
    const values = (req.headers.get("cookie") ?? "").split(";").map((entry) => entry.trim()).filter((entry) => entry.startsWith(`${COOKIE}=`));
    if (values.length > 1) throw new ProposalError("AUTH_REQUIRED");
    const token = values[0]?.slice(COOKIE.length + 1);
    const time = this.now();
    for (const [key, visitor] of this.sessions) if (visitor.expiresAt <= time && !visitor.busy) this.sessions.delete(key);
    const visitor = token && this.sessions.get(token);
    if (visitor && visitor.expiresAt > time) return { visitor };
    if (!create) throw new ProposalError("AUTH_REQUIRED");
    if (this.sessions.size >= this.capacity) throw new ProposalError("UNAVAILABLE");
    const key = randomBytes(32).toString("hex");
    const next: Visitor = { conversation: createConversation(randomUUID()), expiresAt: time + LIFETIME_MS, busy: false };
    this.sessions.set(key, next);
    return { visitor: next, cookie: `${COOKIE}=${key}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${LIFETIME_MS / 1000}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}` };
  }

  async run<T>(visitor: Visitor, action: (conversation: Conversation) => Promise<T> | T): Promise<T> {
    if (visitor.expiresAt <= this.now()) throw new ProposalError("AUTH_REQUIRED");
    if (visitor.busy) throw new ProposalError("STALE_PROPOSAL");
    visitor.busy = true;
    try {
      const result = await action(visitor.conversation);
      if (visitor.expiresAt <= this.now()) throw new ProposalError("AUTH_REQUIRED");
      return result;
    } finally { visitor.busy = false; }
  }
}

// Mesmo processo apenas; reinício ou outra instância exige nova sessão.
const g = globalThis as unknown as { __foodpilotVisitors?: VisitorSessions };
export const visitorSessions = (g.__foodpilotVisitors ??= new VisitorSessions(1000));
