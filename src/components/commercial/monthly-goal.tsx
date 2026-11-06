import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { monthlyGoalOptions } from "@/lib/commercial/queries";
import { formatSaleAmount } from "@/lib/aplicacao/sale-rules";
import { Target } from "lucide-react";

const MONTH_LABEL = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "Europe/Lisbon" });
const DAY_MS = 86_400_000;

export function MonthlyGoal() {
  const { data } = useSuspenseQuery(monthlyGoalOptions);
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(data.percent));
    return () => cancelAnimationFrame(frame);
  }, [data.percent]);

  const monthLabel = MONTH_LABEL.format(new Date(data.startIso));
  const daysLeft = Math.max(0, Math.ceil((Date.parse(data.endIso) - Date.now()) / DAY_MS));

  return <section aria-label="Meta do mês" className="card-soft commercial-enter bg-card p-6 md:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Target className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-semibold">Meta do mês</p>
          <p className="mt-0.5 text-xs text-muted-foreground first-letter:uppercase">{monthLabel}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-3xl font-semibold tabular-nums">{formatSaleAmount(data.revenueCents)}</p>
        <p className="mt-1 text-xs text-muted-foreground">de {formatSaleAmount(data.goalCents)}</p>
      </div>
    </div>

    <div
      className="mt-5 h-3 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={data.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${data.percent}% da meta de ${formatSaleAmount(data.goalCents)}`}
      aria-label={`Meta do mês de ${monthLabel}`}
    >
      <div className="h-full rounded-full bg-gradient-to-r from-primary to-commercial-success transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${filled}%` }} />
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="tabular-nums">{data.percent}% da meta</span>
      <span className="tabular-nums">
        {data.reached
          ? "Meta atingida"
          : `Faltam ${formatSaleAmount(data.remainingCents)} · ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}
      </span>
    </div>
  </section>;
}
