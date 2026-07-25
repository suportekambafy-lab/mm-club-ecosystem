import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, Send, MessagesSquare, Lock } from "lucide-react";
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

type Props = {
  liveId: string;
  currentUserId: string | null;
  readOnly?: boolean;
};

const NEAR_BOTTOM_PX = 80;

export function LiveChat({ liveId, currentUserId, readOnly }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

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
      .channel(`live-chat:${liveId}`)
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

  // Track whether the user is near the bottom so we only auto-scroll when
  // it won't fight against a manual scroll-up (reading history).
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < NEAR_BOTTOM_PX;
    stickToBottomRef.current = near;
    if (near) setUnread(0);
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setUnread(0);
    } else {
      setUnread((n) => n + 1);
    }
  }, [messages.length]);

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnread(0);
  }

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
      stickToBottomRef.current = true;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface-1/80 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-primary" />
          <p className="font-display text-sm">
            {readOnly ? "Conversa da sessão" : "Chat ao vivo"}
          </p>
        </div>
        {readOnly && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Lock className="h-3 w-3" />
            Leitura
          </span>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="absolute inset-0 space-y-2 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-width:thin]"
        >
          {messages.length === 0 ? (
            <p className="pt-6 text-center text-xs text-muted-foreground">
              {readOnly ? "Nenhuma mensagem gravada nesta sessão." : "Sê o primeiro a comentar."}
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.user_id === currentUserId;
              return (
                <div key={m.id} className={cn("live-chat-msg flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm",
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

        {unread > 0 && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110"
          >
            <ArrowDown className="h-3 w-3" />
            {unread} nova{unread === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {!readOnly && (
        <form onSubmit={handleSend} className="shrink-0 border-t border-border p-2.5">
          {error && <p className="mb-1.5 text-[11px] text-red-400">{error}</p>}
          {currentUserId ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escreve uma mensagem…"
                maxLength={2000}
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                enterKeyHint="send"
                className="live-chat-input flex-1 rounded-full bg-surface-2 px-4 py-2 text-foreground outline-none ring-1 ring-transparent focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-50"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Inicia sessão para participar no chat.</p>
          )}
        </form>
      )}
    </div>
  );
}
