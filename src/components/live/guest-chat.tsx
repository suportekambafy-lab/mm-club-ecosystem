/**
 * <GuestChat> — chat da sala para convidados sem conta MM Club.
 *
 * Os convidados não têm sessão Supabase, por isso lê/escreve através de
 * server functions públicas validadas pelo código do link (polling curto em
 * vez de Realtime).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, MessagesSquare } from "lucide-react";
import { listGuestChatMessages, sendGuestChatMessage } from "@/lib/live-guest.functions";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  body: string;
  created_at: string;
  pinned_at: string | null;
  authorId: string;
  authorName: string;
  isGuest: boolean;
};

interface Props {
  liveId: string;
  code: string;
  guestId: string;
  displayName: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export function GuestChat({ liveId, code, guestId, displayName }: Props) {
  const list = useServerFn(listGuestChatMessages);
  const send = useServerFn(sendGuestChatMessage);
  const [messages, setMessages] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await list({ data: { liveId, code } });
      setMessages(rows as Row[]);
    } catch {
      /* transitório */
    }
  }, [list, liveId, code]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const row = await send({ data: { liveId, code, guestId, displayName, body } });
      setMessages((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row as Row]));
      setText("");
      stick.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  const pinned = messages.find((m) => m.pinned_at);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-black/60">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <MessagesSquare className="h-3.5 w-3.5 text-amber-400" />
        <p className="text-[13px] font-semibold text-white/90">Chat ao vivo</p>
      </div>

      {pinned && (
        <div className="shrink-0 border-b border-white/10 bg-amber-400/10 px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-amber-300/90">Fixada · {pinned.authorName}</p>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-white/90">{pinned.body}</p>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
      >
        {messages.length === 0 ? (
          <p className="pt-4 text-center text-[11px] text-white/45">Sê o primeiro a comentar.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {messages.map((m) => {
              const mine = m.authorId === guestId;
              return (
                <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  <div className="mb-0.5 flex items-baseline gap-1.5 text-[10.5px] text-white/50">
                    <span className="font-medium text-white/80">{mine ? "Tu" : m.authorName}</span>
                    <span className="tabular-nums opacity-70">{formatTime(m.created_at)}</span>
                  </div>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[13.5px] leading-snug",
                      mine ? "bg-amber-400 text-black" : "bg-white/10 text-white",
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="shrink-0 border-t border-white/10 px-2.5 py-2">
        {error && <p className="mb-1.5 text-[11px] text-red-300">{error}</p>}
        <div className="relative">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreve uma mensagem…"
            maxLength={2000}
            enterKeyHint="send"
            className="w-full rounded-2xl bg-white/10 py-3 pl-4 pr-12 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-amber-400/60"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="Enviar"
            className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-amber-400 text-black transition active:scale-95 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
