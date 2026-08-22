import type { UIMessage } from "ai";

export const HUMAN_MARKER = "[[HUMANO]]";

export type SupportRow = {
  thread_id: string;
  user_id: string;
  client_id: string;
  role: "user" | "assistant";
  content: string;
  seq: number;
};

/** Texto simples de uma mensagem do AI SDK. */
export function textOf(m: UIMessage): string {
  return (m.parts ?? [])
    .filter((part: { type: string }) => part.type === "text")
    .map((part) => (part as { text?: string }).text ?? "")
    .join("")
    .trim();
}

/** Hash estável do conteúdo, usado quando a mensagem não traz id do cliente. */
export function hashContent(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

/**
 * Converte o histórico do widget em linhas para `support_messages`.
 *
 * O `client_id` é estável por mensagem (id do cliente ou hash do conteúdo) para
 * que uma resposta nova nunca sobrescreva a anterior no upsert, e o `seq`
 * preserva a ordem de inserção na conversa.
 */
export function buildSupportRows(
  threadId: string,
  userId: string,
  messages: UIMessage[],
): SupportRow[] {
  const rows = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, index) => {
      const content = textOf(m).replace(HUMAN_MARKER, "").trim();
      const fallback = `${m.role}-${hashContent(content)}`;
      return {
        thread_id: threadId,
        user_id: userId,
        client_id: m.id && String(m.id).trim() ? String(m.id) : fallback,
        role: m.role as "user" | "assistant",
        content,
        seq: index,
      };
    })
    .filter((r) => r.content.length > 0);

  const byClient = new Map<string, SupportRow>();
  for (const row of rows) byClient.set(row.client_id, row);
  return [...byClient.values()];
}

/** Ordem canónica da timeline do painel: data de criação e depois sequência. */
export function sortSupportTimeline<T extends { created_at: string; seq?: number | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byDate = a.created_at.localeCompare(b.created_at);
    if (byDate !== 0) return byDate;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });
}
