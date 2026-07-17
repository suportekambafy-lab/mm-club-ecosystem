import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Radio, Play, Check, Heart, MessageCircle, AtSign, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { listLivesAuthed as listLives } from "@/lib/lives.functions";
import { useUserProgress, continueFromProgress } from "@/hooks/use-user-progress";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { useCommunityNotifications, type CommunityNotifKind } from "@/lib/community-notifications";

type NotifKind = "live" | "progress" | CommunityNotifKind;

type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  subtitle: string;
  href: string;
  createdAt: number;
  priority?: number;
  source: "local" | "db";
  read?: boolean;
};

const iconByKind: Record<NotifKind, typeof Bell> = {
  live: Radio,
  progress: Play,
  like: Heart,
  reply: MessageCircle,
  mention: AtSign,
  reaction: Smile,
};

const labelByKind: Record<NotifKind, string> = {
  live: "Live",
  progress: "Continua",
  like: "Gosto",
  reply: "Resposta",
  mention: "Menção",
  reaction: "Reação",
};

const STORAGE_KEY = "mm.notifications.state.v2";

type StoredState = {
  readIds: string[];
  dismissedIds: string[];
  lastOpenedAt: number;
};

function loadState(): StoredState {
  if (typeof window === "undefined") return { readIds: [], dismissedIds: [], lastOpenedAt: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { readIds: [], dismissedIds: [], lastOpenedAt: 0 };
    const parsed = JSON.parse(raw) as StoredState;
    return {
      readIds: parsed.readIds ?? [],
      dismissedIds: parsed.dismissedIds ?? [],
      lastOpenedAt: parsed.lastOpenedAt ?? 0,
    };
  } catch {
    return { readIds: [], dismissedIds: [], lastOpenedAt: 0 };
  }
}

function saveState(s: StoredState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

type RealLive = Awaited<ReturnType<typeof listLives>>[number];

function useDerivedNotifs(): Notif[] {
  const { progress } = useUserProgress();
  const [liveRows, setLiveRows] = useState<RealLive[]>([]);

  useEffect(() => {
    let cancelled = false;
    listLives()
      .then((rows) => {
        if (cancelled) return;
        setLiveRows(rows as RealLive[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const out: Notif[] = [];
    const now = Date.now();

    const active = liveRows.find((l) => l.status === "live");
    const upcoming = liveRows
      .filter((l) => l.status === "scheduled" && new Date(l.starts_at).getTime() > now - 3600_000)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
    const featured = active ?? upcoming;
    if (featured) {
      const startsMs = new Date(featured.starts_at).getTime();
      const diffDays = Math.round((startsMs - now) / 86400000);
      out.push({
        id: `live:${featured.id}`,
        kind: "live",
        title: featured.title,
        subtitle:
          featured.status === "live"
            ? "A decorrer agora"
            : diffDays <= 0
              ? "Começa em breve"
              : diffDays === 1
                ? "Amanhã ao vivo"
                : `Daqui a ${diffDays} dias`,
        href: "/lives",
        createdAt: now - 3600_000,
        priority: 10,
        source: "local",
      });
    }

    const cont = continueFromProgress(progress)[0];
    if (cont) {
      out.push({
        id: `progress:${cont.id}`,
        kind: "progress",
        title: `Continua "${cont.title}"`,
        subtitle: `${Math.round(cont.progress * 100)}% concluído · retoma onde ficaste`,
        href: `/academia/${cont.id}`,
        createdAt: now - 2 * 3600_000,
        priority: 8,
        source: "local",
      });
    }

    return out;
  }, [progress, liveRows]);
}

function communityCopy(kind: CommunityNotifKind, actorName: string | null): { title: string; subtitle: string } {
  const who = actorName?.trim() || "Alguém";
  if (kind === "like") {
    return {
      title: `${who} gostou do teu post`,
      subtitle: "Toca para veres a publicação",
    };
  }
  if (kind === "reply") {
    return {
      title: `${who} comentou no teu post`,
      subtitle: "Vê a resposta na comunidade",
    };
  }
  return {
    title: `${who} mencionou-te`,
    subtitle: "Foste referido numa publicação",
  };
}

export function NotificationsBell({ className }: { className?: string }) {
  const derived = useDerivedNotifs();
  const {
    items: dbItems,
    markAllRead: dbMarkAllRead,
    markRead: dbMarkRead,
    dismiss: dbDismiss,
  } = useCommunityNotifications();

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<StoredState>({ readIds: [], dismissedIds: [], lastOpenedAt: 0 });
  const [hydrated, setHydrated] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const merged: Notif[] = useMemo(() => {
    const fromDb: Notif[] = dbItems.map((n) => {
      const copy = communityCopy(n.kind, n.actor_name);
      const href = n.post_id ? `/comunidade?post=${n.post_id}` : "/comunidade";
      return {
        id: `notif:${n.id}`,
        kind: n.kind,
        title: copy.title,
        subtitle: copy.subtitle,
        href,
        createdAt: new Date(n.created_at).getTime(),
        source: "db",
        read: !!n.read_at,
        priority: 5,
      };
    });
    return [...derived, ...fromDb].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.createdAt - a.createdAt,
    );
  }, [derived, dbItems]);

  const visible = merged.filter((n) =>
    n.source === "local" ? !state.dismissedIds.includes(n.id) : true,
  );

  const isReadOf = (n: Notif) =>
    n.source === "db" ? !!n.read : state.readIds.includes(n.id);

  const unreadCount = hydrated ? visible.filter((n) => !isReadOf(n)).length : 0;

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const s: StoredState = { ...state, lastOpenedAt: Date.now() };
      setState(s);
      saveState(s);
    }
  };

  const markAllRead = () => {
    const localIds = visible.filter((n) => n.source === "local").map((n) => n.id);
    const s: StoredState = {
      ...state,
      readIds: Array.from(new Set([...state.readIds, ...localIds])),
    };
    setState(s);
    saveState(s);
    void dbMarkAllRead();
  };

  const markRead = (n: Notif) => {
    if (n.source === "db") {
      if (!n.read) void dbMarkRead(n.id.replace(/^notif:/, ""));
      return;
    }
    if (state.readIds.includes(n.id)) return;
    const s: StoredState = { ...state, readIds: [...state.readIds, n.id] };
    setState(s);
    saveState(s);
  };

  const dismiss = (n: Notif) => {
    if (n.source === "db") {
      void dbDismiss(n.id.replace(/^notif:/, ""));
      return;
    }
    const s: StoredState = {
      ...state,
      dismissedIds: Array.from(new Set([...state.dismissedIds, n.id])),
    };
    setState(s);
    saveState(s);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        aria-label="Notificações"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition hover:text-foreground sm:h-10 sm:w-10"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} não lidas`}
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground ring-2 ring-background"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] origin-top-right overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-2xl shadow-black/40 ring-1 ring-[color:var(--hairline)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="font-display text-sm text-foreground">Notificações</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-medium text-primary transition hover:underline"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>

          <div className="max-h-[min(70vh,480px)] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-foreground">Tudo em dia.</p>
                <p className="text-xs text-muted-foreground">
                  Voltamos a avisar assim que houver algo novo.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((n) => {
                  const Icon = iconByKind[n.kind];
                  const isRead = isReadOf(n);
                  const created = new Date(n.createdAt);
                  const timeAgo = hydrated
                    ? formatDistanceToNow(created, { locale: pt, addSuffix: true })
                    : "";
                  return (
                    <li key={n.id} className="group relative">
                      <Link
                        to={n.href}
                        onClick={() => {
                          markRead(n);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex gap-3 px-4 py-3 transition hover:bg-surface-2",
                          !isRead && "bg-primary/[0.03]",
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-[color:var(--hairline)]",
                            isRead ? "bg-surface-2 text-muted-foreground" : "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                              {labelByKind[n.kind]}
                            </span>
                            {!isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Não lido" />
                            )}
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {timeAgo}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
                            {n.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.subtitle}
                          </p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dismiss(n);
                        }}
                        aria-label="Dispensar notificação"
                        className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:flex group-hover:opacity-100"
                      >
                        <span aria-hidden className="text-xs leading-none">×</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link
              to="/comunidade"
              onClick={() => setOpen(false)}
              className="text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              Ver toda a atividade do clube
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
