import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, Send, MessagesSquare, Lock, Pin, PinOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cachedAvatarUrl, resolveAvatarUrl } from "@/lib/avatar-cache";
import { listChatMessages, sendChatMessage, setChatMessagePinned } from "@/lib/lives.functions";
import { useAdminIds } from "@/hooks/use-admin-ids";
import { VerifiedBadge } from "@/components/mm/verified-badge";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  live_id: string;
  user_id: string;
  body: string;
  created_at: string;
  pinned_at?: string | null;
  pinned_by?: string | null;
};

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  liveId: string;
  currentUserId: string | null;
  readOnly?: boolean;
};

const NEAR_BOTTOM_PX = 80;

function initialsOf(name: string | null | undefined, fallback: string): string {
  const src = (name && name.trim()) || fallback;
  const parts = src.split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((p) => p[0]).join("");
  return (letters || src.slice(0, 2)).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

// Render message body with clickable links. Any http(s):// URL becomes an
// anchor; everything else is escaped as plain text (React handles escaping).
function renderBody(body: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(https?:\/\/[^\s<>"']+)/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    const url = match[0];
    parts.push(
      <a
        key={`l-${idx++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline decoration-current/60 underline-offset-2 hover:decoration-current break-all"
      >
        {url}
      </a>,
    );
    last = match.index + url.length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

export function LiveChat({ liveId, currentUserId, readOnly }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const fetchInitial = useServerFn(listChatMessages);
  const send = useServerFn(sendChatMessage);
  const setPinned = useServerFn(setChatMessagePinned);
  const adminIds = useAdminIds();
  const [hostIds, setHostIds] = useState<Set<string>>(() => new Set());
  const isVerified = (uid: string) => adminIds.has(uid) || hostIds.has(uid);
  const isAdmin = currentUserId ? adminIds.has(currentUserId) : false;

  // Fetch host + cohosts for this live so they render with the verified badge
  // even if they aren't platform admins.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: live }, { data: parts }] = await Promise.all([
        supabase.from("lives").select("created_by").eq("id", liveId).maybeSingle(),
        supabase
          .from("live_participants")
          .select("user_id, role")
          .eq("live_id", liveId)
          .in("role", ["host", "cohost"]),
      ]);
      if (cancelled) return;
      const set = new Set<string>();
      if (live?.created_by) set.add(live.created_by as string);
      for (const p of parts ?? []) set.add((p as { user_id: string }).user_id);
      setHostIds(set);
    })();
    return () => {
      cancelled = true;
    };
  }, [liveId]);


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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_chat_messages", filter: `live_id=eq.${liveId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveId, fetchInitial]);

  async function handleTogglePin(m: Message) {
    const next = !m.pinned_at;
    // Optimistic update
    setMessages((prev) =>
      prev.map((x) =>
        x.id === m.id
          ? { ...x, pinned_at: next ? new Date().toISOString() : null, pinned_by: next ? currentUserId : null }
          : x,
      ),
    );
    try {
      await setPinned({ data: { id: m.id, pinned: next } });
    } catch (e) {
      setError((e as Error).message);
      // Revert
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, pinned_at: m.pinned_at, pinned_by: m.pinned_by } : x)),
      );
    }
  }

  // Fetch profiles for any user_ids we don't have yet.
  useEffect(() => {
    const missing = Array.from(
      new Set(messages.map((m) => m.user_id).filter((id) => id && !profiles[id])),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", missing);
      if (cancelled || !data) return;
      // Resolve storage paths to signed URLs (cache partilhado).
      const resolved = await Promise.all(
        data.map(async (p) => {
          const url = await resolveAvatarUrl(p.avatar_url);
          return { ...p, avatar_url: url ?? cachedAvatarUrl(p.avatar_url) } as Profile;
        }),
      );
      if (cancelled) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of resolved) next[p.id] = p;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, profiles]);

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

  // Group consecutive messages from the same author so we only show the
  // header (avatar + name + time) once per burst — feels closer to native
  // chat apps and keeps the list tidy.
  const grouped = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const sameAuthor = prev && prev.user_id === m.user_id;
      const closeInTime =
        prev && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
      return { m, showHeader: !(sameAuthor && closeInTime) };
    });
  }, [messages]);

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

      {(() => {
        const pinned = messages.find((m) => m.pinned_at);
        if (!pinned) return null;
        const p = profiles[pinned.user_id];
        const pname = p?.display_name || (pinned.user_id === currentUserId ? "Tu" : pinned.user_id.slice(0, 6));
        return (
          <div className="flex shrink-0 items-start gap-2 border-b border-border/60 bg-primary/5 px-3 py-2">
            <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary/80">
                <span>Fixada</span>
                <span className="opacity-60">·</span>
                <span className="normal-case tracking-normal text-foreground/85">{pname}</span>
                {isVerified(pinned.user_id) && <VerifiedBadge size={10} />}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-foreground/90 break-words">
                {renderBody(pinned.body)}
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleTogglePin(pinned)}
                aria-label="Remover fixação"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              >
                <PinOff className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })()}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="absolute inset-0 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-width:thin]"
        >
          <div className="flex min-h-full flex-col justify-end gap-1">
            {messages.length === 0 ? (
              <p className="pb-2 text-center text-[11px] text-muted-foreground/70">
                {readOnly ? "Nenhuma mensagem gravada nesta sessão." : "Sê o primeiro a comentar."}
              </p>
            ) : (
              grouped.map(({ m, showHeader }) => {
                const mine = m.user_id === currentUserId;
                const profile = profiles[m.user_id];
                const name = profile?.display_name || (mine ? "Tu" : m.user_id.slice(0, 6));
                const time = formatTime(m.created_at);
                const authorIsAdmin = isVerified(m.user_id);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "live-chat-msg group/msg flex gap-2",
                      mine ? "flex-row-reverse" : "flex-row",
                      showHeader ? "mt-2 first:mt-0" : "mt-0.5",
                    )}
                  >
                    <div className="w-8 shrink-0">
                      {showHeader ? (
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60">
                          {profile?.avatar_url ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={profile.avatar_url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initialsOf(profile?.display_name, mine ? "Tu" : m.user_id)
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className={cn("flex min-w-0 max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
                      {showHeader && (
                        <div
                          className={cn(
                            "mb-0.5 flex items-baseline gap-1.5 text-[10.5px] text-muted-foreground",
                            mine ? "flex-row-reverse" : "flex-row",
                          )}
                        >
                          <span className="flex items-baseline gap-1 font-medium text-foreground/85">
                            {name}
                            {authorIsAdmin && <VerifiedBadge size={11} />}
                          </span>
                          <span className="opacity-60">·</span>
                          <span className="tabular-nums opacity-70">{time}</span>
                        </div>
                      )}
                      <div className={cn("flex items-center gap-1", mine ? "flex-row-reverse" : "flex-row")}>
                        <div
                          className={cn(
                            "rounded-2xl px-3 py-1.5 text-[13.5px] leading-snug break-words whitespace-pre-wrap",
                            mine
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-surface-2 text-foreground rounded-tl-sm",
                          )}
                        >
                          {renderBody(m.body)}
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleTogglePin(m)}
                            aria-label={m.pinned_at ? "Remover fixação" : "Fixar mensagem"}
                            className={cn(
                              "shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground",
                              m.pinned_at
                                ? "opacity-100 text-primary"
                                : "opacity-0 group-hover/msg:opacity-100 focus:opacity-100",
                            )}
                          >
                            {m.pinned_at ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
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
