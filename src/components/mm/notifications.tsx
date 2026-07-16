import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  Radio,
  Wrench,
  Users,
  Bot,
  CalendarDays,
  Play,
  Check,
  
} from "lucide-react";
import { cn } from "@/lib/utils";
import { news } from "@/data/news";
import { lives } from "@/data/lives";
import { communityNotices } from "@/data/community";
import { upcomingEvents } from "@/data/events";
import { useUserProgress, continueFromProgress } from "@/hooks/use-user-progress";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

type NotifKind = "live" | "course" | "expert" | "tool" | "jade" | "community" | "event" | "progress";

type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  subtitle: string;
  href: string;
  createdAt: number; // ms epoch (deterministic)
  priority?: number; // higher = pinned to top
};

const iconByKind: Record<NotifKind, typeof Bell> = {
  live: Radio,
  course: BookOpen,
  expert: Users,
  tool: Wrench,
  jade: Bot,
  community: Users,
  event: CalendarDays,
  progress: Play,
};

const labelByKind: Record<NotifKind, string> = {
  live: "Live",
  course: "Curso",
  expert: "Especialista",
  tool: "Ferramenta",
  jade: "Jade",
  community: "Comunidade",
  event: "Evento",
  progress: "Continua",
};

const STORAGE_KEY = "mm.notifications.state.v1";

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

// Deterministic fixed "now" — matches lives.ts baseline so mock dates land coherent.
const BASELINE_NOW = new Date("2026-07-20T18:00:00.000Z").getTime();

function useAggregatedNotifs(): Notif[] {
  const { progress } = useUserProgress();

  return useMemo(() => {
    const out: Notif[] = [];

    // 1) Próxima live — proativo
    const upcomingLives = lives
      .filter((l) => !l.recording && new Date(l.startsAt).getTime() > BASELINE_NOW)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const next = upcomingLives[0];
    if (next) {
      const startsMs = new Date(next.startsAt).getTime();
      const diffDays = Math.round((startsMs - BASELINE_NOW) / 86400000);
      out.push({
        id: `live:${next.id}`,
        kind: "live",
        title: next.title,
        subtitle:
          diffDays <= 0
            ? "Começa em breve"
            : diffDays === 1
              ? "Amanhã ao vivo"
              : `Daqui a ${diffDays} dias`,
        href: "/lives",
        createdAt: BASELINE_NOW - 3600_000,
        priority: 10,
      });
    }

    // 2) Continuar a aprender — proativo
    const cont = continueFromProgress(progress)[0];
    if (cont) {
      out.push({
        id: `progress:${cont.id}`,
        kind: "progress",
        title: `Continua "${cont.title}"`,
        subtitle: `${Math.round(cont.progress * 100)}% concluído · retoma onde ficaste`,
        href: `/academia/${cont.id}`,
        createdAt: BASELINE_NOW - 2 * 3600_000,
        priority: 8,
      });
    }

    // 3) Novidades recentes
    news.slice(0, 4).forEach((n, i) => {
      const kind: NotifKind =
        n.type === "course"
          ? "course"
          : n.type === "expert"
            ? "expert"
            : n.type === "live"
              ? "live"
              : n.type === "tool"
                ? "tool"
                : "jade";
      out.push({
        id: `news:${n.id}`,
        kind,
        title: n.title,
        subtitle: n.subtitle,
        href: n.href,
        createdAt: BASELINE_NOW - (i + 1) * 86400_000,
      });
    });

    // 4) Comunidade
    communityNotices.slice(0, 2).forEach((c, i) => {
      out.push({
        id: `community:${c.id}`,
        kind: "community",
        title: c.title,
        subtitle: c.body,
        href: "/comunidade",
        createdAt: BASELINE_NOW - (i + 1) * 12 * 3600_000,
      });
    });

    // 5) Próximos eventos
    upcomingEvents.slice(0, 2).forEach((ev, i) => {
      out.push({
        id: `event:${ev.id}`,
        kind: "event",
        title: ev.title,
        subtitle: `${ev.type} · ${ev.date}`,
        href: "/eventos",
        createdAt: BASELINE_NOW - (i + 1) * 2 * 86400_000,
      });
    });

    return out.sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.createdAt - a.createdAt,
    );
  }, [progress]);
}

export function NotificationsBell({ className }: { className?: string }) {
  const notifs = useAggregatedNotifs();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<StoredState>({ readIds: [], dismissedIds: [], lastOpenedAt: 0 });
  const [hydrated, setHydrated] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  // Close on outside click / escape
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

  const visible = notifs.filter((n) => !state.dismissedIds.includes(n.id));
  const unreadCount = hydrated
    ? visible.filter((n) => !state.readIds.includes(n.id)).length
    : 0;

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
    const ids = visible.map((n) => n.id);
    const s: StoredState = {
      ...state,
      readIds: Array.from(new Set([...state.readIds, ...ids])),
    };
    setState(s);
    saveState(s);
  };

  const markRead = (id: string) => {
    if (state.readIds.includes(id)) return;
    const s: StoredState = { ...state, readIds: [...state.readIds, id] };
    setState(s);
    saveState(s);
  };

  const dismiss = (id: string) => {
    const s: StoredState = {
      ...state,
      dismissedIds: Array.from(new Set([...state.dismissedIds, id])),
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
              <Sparkles className="h-3.5 w-3.5 text-primary" />
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
                  const isRead = state.readIds.includes(n.id);
                  const created = new Date(n.createdAt);
                  const timeAgo = hydrated
                    ? formatDistanceToNow(created, { locale: pt, addSuffix: true })
                    : "";
                  return (
                    <li key={n.id} className="group relative">
                      <Link
                        to={n.href}
                        onClick={() => {
                          markRead(n.id);
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
                          dismiss(n.id);
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
