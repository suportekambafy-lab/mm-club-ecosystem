import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { useTicker } from "@/hooks/use-ticker";

function computeDelta(target: number, now: number) {
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { diff, days, hours, minutes, seconds };
}

export function LiveCountdown({
  startsAt,
  variant = "chip",
}: {
  startsAt: string;
  variant?: "chip" | "hero";
}) {
  const target = new Date(startsAt).getTime();
  const now = useTicker(1000);
  const delta = useMemo(() => computeDelta(target, now), [target, now]);


  if (delta.diff <= 0) return null;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (variant === "hero") {
    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        {delta.days > 0 && <Cell value={delta.days} label="dias" />}
        <Cell value={delta.hours} label="horas" />
        <Cell value={delta.minutes} label="min" />
        <Cell value={delta.seconds} label="seg" />
      </div>
    );
  }

  const label =
    delta.days > 0
      ? `${delta.days}d ${pad(delta.hours)}h ${pad(delta.minutes)}m`
      : `${pad(delta.hours)}:${pad(delta.minutes)}:${pad(delta.seconds)}`;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary ring-1 ring-primary/30 backdrop-blur">
      <CalendarClock className="h-3 w-3" />
      <span className="tabular-nums">{label}</span>
    </span>
  );
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[56px] flex-col items-center rounded-xl border border-primary/30 bg-black/50 px-3 py-2 backdrop-blur">
      <span className="font-display text-2xl tabular-nums text-primary">
        {value.toString().padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
