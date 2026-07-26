import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SubscriptionStatus } from "@/lib/billing/types";

export function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function dt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function day(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "positive" | "negative" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface-1 p-5",
        tone === "accent" && "border-primary/40 bg-primary/5",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-semibold tabular-nums md:text-3xl",
          tone === "positive" && "text-emerald-400",
          tone === "negative" && "text-red-400",
          tone === "accent" && "text-primary",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const STATUS_STYLE: Record<SubscriptionStatus | string, string> = {
  active: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  trialing: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  past_due: "bg-admin-accent/15 text-admin-accent ring-admin-accent/30",
  grace_period: "bg-admin-accent/10 text-admin-accent ring-admin-accent/20",
  suspended: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  cancelled: "bg-muted text-muted-foreground ring-border",
  expired: "bg-muted text-muted-foreground ring-border",
  paid: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 ring-red-500/30",
  refunded: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
  chargeback: "bg-red-600/20 text-red-300 ring-red-600/30",
  pending: "bg-muted text-muted-foreground ring-border",
};

export const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Trial",
  past_due: "Em atraso",
  grace_period: "Período de graça",
  suspended: "Suspensa",
  cancelled: "Cancelada",
  expired: "Expirada",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        STATUS_STYLE[status] ?? "bg-muted text-muted-foreground ring-border",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function BarList({
  items,
  emptyLabel = "Sem dados ainda.",
}: {
  items: { label: string; cents: number; count: number }[];
  emptyLabel?: string;
}) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  const max = Math.max(...items.map((i) => i.cents), 1);
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {money(i.cents)} · {i.count}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${Math.max(2, (i.cents / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-surface-1 p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
