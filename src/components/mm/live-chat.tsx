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
      .channel(`live-chat:${liveId}:${Math.random().toString(36).slice(2)}`)
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface-1/60 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-3.5 w-3.5 text-primary" />
          <p className="font-display text-[13px]">
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
          className="absolute inset-0 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-width:thin]"
        >
          {/* Bottom-anchor: messages sit at the bottom when the list is short,
              and still scroll naturally when it overflows. */}
          <div className="flex min-h-full flex-col justify-end gap-1.5">
            {messages.length === 0 ? (
              <p className="pb-2 text-center text-[11px] text-muted-foreground/70">
                {readOnly ? "Nenhuma mensagem gravada nesta sessão." : "Sê o primeiro a comentar."}
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.user_id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={cn("live-chat-msg flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[82%] rounded-2xl px-3 py-1.5 text-[13.5px] leading-snug",
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2 text-foreground",
                      )}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {m.user_id.slice(0, 6)}
                        </p>
                      )}
                      <p className="break-words">{m.body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
        <form onSubmit={handleSend} className="shrink-0 border-t border-border/60 px-2.5 py-2">
          {error && <p className="mb-1.5 text-[11px] text-red-400">{error}</p>}
          {currentUserId ? (
            <div className="relative">
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
                className="live-chat-input w-full rounded-2xl bg-surface-2/80 pl-4 pr-12 py-3 text-foreground outline-none ring-1 ring-border/40 transition placeholder:text-muted-foreground/60 focus:ring-primary/50"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                aria-label="Enviar"
                className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25 transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
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
