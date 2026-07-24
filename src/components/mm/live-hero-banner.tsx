import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radio, ArrowRight, Play, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { expertsById } from "@/data/experts";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";

type LiveLike = {
  id: string;
  title: string;
  description?: string | null;
  expert_id?: string | null;
  starts_at: string;
  duration_minutes: number;
  visibility: string;
  cover_url?: string | null;
  status: string;
};

/**
 * Cinematic featured card for a single live: used as dashboard hero when a
 * live is on-air or scheduled next, and at the top of /lives.
 */
export function LiveHeroBanner({ live, className }: { live: LiveLike; className?: string }) {
  const expert = live.expert_id ? expertsById[live.expert_id] : undefined;
  const isLive = live.status === "live";
  const isReplay = live.status === "published" || live.status === "ended";
  const [distance, setDistance] = useState<string>("");
  const [countdown, setCountdown] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const coverUrl = resolveLiveCoverUrl(live.cover_url);

  useEffect(() => {
    if (isLive || isReplay) return;
    const tick = () => {
      const diff = new Date(live.starts_at).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      const s = Math.floor(diff / 1000);
      setCountdown({
        d: Math.floor(s / 86400),
        h: Math.floor((s % 86400) / 3600),
        m: Math.floor((s % 3600) / 60),
        s: s % 60,
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [live.starts_at, isLive, isReplay]);

  useEffect(() => {
    if (isLive) return;
    setDistance(
      formatDistanceToNow(new Date(live.starts_at), { locale: pt, addSuffix: true }),
    );
  }, [live.starts_at, isLive]);

  const cta = isLive ? "Entrar na sessão" : isReplay ? "Ver replay" : "Ver detalhes";
  const CtaIcon = isLive ? Radio : isReplay ? Play : ArrowRight;

  return (
    <Link
      to="/lives/$liveId"
      params={{ liveId: live.id }}
      className={cn(
        "group relative block overflow-hidden rounded-3xl border border-border bg-surface-1",
        "shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      {/* Background cover */}
      <div
        className="absolute inset-0"
        style={
          coverUrl
            ? {
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background:
                  "linear-gradient(135deg, oklch(0.55 0.12 60), oklch(0.15 0.03 60))",
              }
        }
      />
      {/* Cinematic overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative flex min-h-[340px] flex-col justify-between gap-6 p-6 md:min-h-[460px] md:p-14">
        <div className="flex flex-wrap items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-500/95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg shadow-red-500/40">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Ao vivo agora
            </span>
          )}
          {!isLive && !isReplay && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary ring-1 ring-primary/30">
              <Calendar className="h-3 w-3" />
              Próxima sessão
            </span>
          )}
          {isReplay && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white ring-1 ring-white/20">
              <Play className="h-3 w-3" />
              Replay disponível
            </span>
          )}
          {!isLive && distance && (
            <span className="text-[11px] uppercase tracking-widest text-white/70">
              {distance}
            </span>
          )}
        </div>

        <div className="max-w-3xl space-y-4">
          <h2 className="font-display text-3xl leading-[1.05] tracking-tight text-white md:text-6xl">
            {live.title}
          </h2>
          {live.description && (
            <p className="line-clamp-2 max-w-xl text-sm text-white/75 md:text-base">
              {live.description}
            </p>
          )}

          {/* Countdown for scheduled sessions — dramatic stage feel */}
          {countdown && !isLive && !isReplay && (
            <div className="flex flex-wrap gap-3 pt-2">
              {[
                { v: countdown.d, l: "Dias" },
                { v: countdown.h, l: "Horas" },
                { v: countdown.m, l: "Min" },
                { v: countdown.s, l: "Seg" },
              ].map((u) => (
                <div
                  key={u.l}
                  className="flex min-w-[64px] flex-col items-center rounded-xl bg-white/5 px-3 py-2 backdrop-blur-md ring-1 ring-white/10 md:min-w-[84px] md:px-4 md:py-3"
                >
                  <span className="font-display text-2xl tabular-nums leading-none text-white md:text-4xl">
                    {String(u.v).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/50 md:text-[10px]">
                    {u.l}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-3">
            {expert && (
              <div className="flex items-center gap-2.5">
                <div
                  className="h-10 w-10 shrink-0 rounded-full ring-1 ring-white/20"
                  style={
                    expert.logo
                      ? {
                          backgroundImage: `url(${expert.logo})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : { background: expert.photo }
                  }
                />
                <div className="text-xs">
                  <p className="font-medium text-white">{expert.name}</p>
                  <p className="text-white/60">{expert.role}</p>
                </div>
              </div>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition",
                isLive
                  ? "bg-white text-black group-hover:bg-white/90"
                  : "bg-primary text-primary-foreground group-hover:bg-gold-soft",
              )}
            >
              <CtaIcon className="h-4 w-4" />
              {cta}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
