import { useEffect, useState } from "react";
import { Flame, Target, Trophy } from "lucide-react";
import { useLearningStreak } from "@/hooks/use-learning-streak";
import {
  StreakCelebration,
  markStreakCelebrated,
  shouldCelebrateStreak,
} from "@/components/mm/streak-celebration";
import { WEEKLY_GOAL_MINUTES, lisbonDay } from "@/lib/learning-activity";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function lastSevenDays(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    out.push(lisbonDay(new Date(Date.now() - i * 86_400_000)));
  }
  return out;
}

/** Contas em modo de teste: a ofensiva aparece sempre que entram. */
const ALWAYS_CELEBRATE_EMAILS = ["victormuabi20@gmail.com"];

export function StreakCard({ className }: { className?: string }) {
  const { streak, loaded } = useLearningStreak();
  const current = streak?.current_streak ?? 0;
  const [celebrate, setCelebrate] = useState(false);
  const [alwaysCelebrate, setAlwaysCelebrate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.toLowerCase() ?? "";
      if (!cancelled) setAlwaysCelebrate(ALWAYS_CELEBRATE_EMAILS.includes(email));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Popup de parabéns a partir do 2.º dia seguido, uma vez por nova contagem.
  // Se a pessoa faltar e a sequência recomeçar, volta a celebrar desde o 2.º dia.
  // Em modo de teste (conta admin ou ?ofensiva=1) mostra sempre.
  useEffect(() => {
    if (!loaded) return;
    const forced =
      alwaysCelebrate ||
      (typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).has("ofensiva"));
    if (!forced && !shouldCelebrateStreak(current)) return;
    if (!forced) markStreakCelebrated(current);
    const t = window.setTimeout(() => setCelebrate(true), 600);
    return () => window.clearTimeout(t);
  }, [loaded, current, alwaysCelebrate]);


  if (!loaded) {
    return (
      <div className={cn("h-[116px] animate-pulse rounded-3xl border border-border bg-surface-1", className)} />
    );
  }
  if (!streak) return null;


  const days = lastSevenDays();
  const active = new Set(streak.active_days ?? []);
  const weekMinutes = streak.week_minutes ?? 0;
  const goalPct = Math.min(100, Math.round((weekMinutes / WEEKLY_GOAL_MINUTES) * 100));

  return (
    <>
    <StreakCelebration open={celebrate} streak={current} onClose={() => setCelebrate(false)} />
    <section
      className={cn(
        "rounded-3xl border border-border bg-surface-1 p-4 sm:p-5",
        className,
      )}
    >

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-2xl",
              streak.current_streak > 0 ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground",
            )}
          >
            <Flame className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-xl leading-none text-foreground">
              {streak.current_streak}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {streak.current_streak === 1 ? "dia seguido" : "dias seguidos"}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {streak.current_streak === 0
                ? "Vê uma aula hoje para começar a tua sequência."
                : "Mantém o ritmo — vê uma aula hoje."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {days.map((day, i) => (
            <div key={day} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "h-7 w-7 rounded-full border transition",
                  active.has(day)
                    ? "border-primary bg-primary/80"
                    : "border-border bg-surface-2",
                )}
                aria-label={active.has(day) ? `${day}: ativo` : `${day}: sem atividade`}
              />
              <span className="text-[10px] text-muted-foreground">{DAY_LABELS[new Date(day + "T12:00:00").getDay()] ?? DAY_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" /> Meta semanal
            </span>
            <span className="text-foreground">
              {weekMinutes}/{WEEKLY_GOAL_MINUTES} min
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-primary" /> Recorde
          </span>
          <span className="text-foreground">
            {streak.longest_streak} {streak.longest_streak === 1 ? "dia" : "dias"} ·{" "}
            {Math.round((streak.total_minutes ?? 0) / 60)}h no total
          </span>
        </div>
      </div>
    </section>
    </>
  );
}
