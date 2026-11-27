import { z } from "zod";
import type { UIMessage } from "ai";

const message = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.object({ type: z.string().max(100), text: z.string().max(20000).optional() }).passthrough()).max(50),
});

/** Conversation is untrusted text, never system instructions or tool results. */
export function parseChatMessages(input: unknown): UIMessage[] {
  const rows = z.array(message).min(1).max(100).parse(input);
  const clean: UIMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: row.parts.flatMap((part) => part.type === "text" && typeof part.text === "string"
      ? [{ type: "text" as const, text: part.text }]
      : []),
  }));
  if (clean.reduce((sum, row) => sum + row.parts.reduce((n, part) => n + (part.type === "text" ? part.text.length : 0), 0), 0) > 100000) {
    throw new Error("Conversa demasiado longa.");
  }
  if (clean.at(-1)?.role !== "user" || clean.at(-1)?.parts.length === 0) throw new Error("Mensagem inválida.");
  return clean;
}