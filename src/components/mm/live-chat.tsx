import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listChatMessages, sendChatMessage } from "@/lib/lives.functions";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  live_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export function LiveChat({ liveId, currentUserId }: { liveId: string; currentUserId: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const fetchInitial = useServerFn(listChatMessages);
  const send = useServerFn(sendChatMessage);

  useEffect(() => {
    let cancelled = false;
    fetchInitial({ data: { liveId } })
      .then((rows) => {
        if (!cancelled) setMessages(rows as Message[]);
      })
      .catch((e) => setError((e as Error).message));

    const channel = supabase
      .channel(`live:${liveId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `live_id=eq.${liveId}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveId, fetchInitial]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const row = await send({ data: { liveId, body } });
      setMessages((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row as Message]));
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-surface-1">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessagesSquare className="h-4 w-4 text-primary" />
        <p className="font-display text-sm">Chat ao vivo</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">Sê o primeiro a comentar.</p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === currentUserId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    mine ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground",
                  )}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {m.user_id.slice(0, 6)}
                    </p>
                  )}
                  <p className="break-words leading-snug">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="border-t border-border p-3">
        {error && <p className="mb-2 text-[11px] text-red-400">{error}</p>}
        {currentUserId ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreve uma mensagem…"
              maxLength={2000}
              className="flex-1 rounded-full bg-surface-2 px-4 py-2 text-sm text-foreground outline-none ring-1 ring-transparent focus:ring-primary/40"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Inicia sessão para participar no chat.</p>
        )}
      </form>
    </div>
  );
}
