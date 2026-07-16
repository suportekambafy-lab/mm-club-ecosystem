import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, CalendarDays, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLive } from "@/lib/lives.functions";
import { LivePlayer } from "@/components/mm/live-player";
import { LiveChat } from "@/components/mm/live-chat";

export const Route = createFileRoute("/_app/lives/$liveId")({
  loader: async ({ params }) => {
    try {
      return await getLive({ data: { id: params.liveId } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.live.title} — MM Club` },
          { name: "description", content: loaderData.live.description ?? "Live MM Club." },
        ]
      : [{ title: "Live — MM Club" }],
  }),
  component: LiveDetail,
});

function LiveDetail() {
  const { live, playbackToken, videoUid } = Route.useLoaderData();
  const [userId, setUserId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(() => diff(live.starts_at));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (live.status !== "scheduled") return;
    const t = setInterval(() => setCountdown(diff(live.starts_at)), 1000);
    return () => clearInterval(t);
  }, [live.starts_at, live.status]);

  const isLive = live.status === "live";
  const dateStr = new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(live.starts_at));

  return (
    <div className="space-y-6">
      <Link
        to="/lives"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Lives
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {videoUid ? (
            <LivePlayer videoUid={videoUid} playbackToken={playbackToken} live={isLive} />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl border border-border bg-surface-1 text-center">
              <div className="max-w-sm space-y-2 px-6">
                <p className="font-display text-lg text-foreground">Ainda não começou</p>
                {live.status === "scheduled" && countdown && (
                  <p className="font-mono text-sm text-primary">{countdown}</p>
                )}
                <p className="text-xs text-muted-foreground">{dateStr}</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface-1 p-5">
            <h1 className="font-display text-2xl text-foreground md:text-3xl">{live.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateStr}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {live.duration_minutes} min
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {live.visibility === "public"
                  ? "Aberta"
                  : live.visibility === "premium"
                    ? "Premium"
                    : "MM Club"}
              </span>
            </div>
            {live.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {live.description}
              </p>
            )}
          </div>
        </div>

        <div className="lg:h-[calc(100dvh-8rem)] lg:sticky lg:top-20">
          <LiveChat liveId={live.id} currentUserId={userId} />
        </div>
      </div>
    </div>
  );
}

function diff(iso: string): string | null {
  const t = new Date(iso).getTime() - Date.now();
  if (t <= 0) return null;
  const s = Math.floor(t / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
