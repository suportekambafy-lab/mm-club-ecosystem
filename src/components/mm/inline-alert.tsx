import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { L } from "@/lib/language-guide";
import { trackUx } from "@/lib/ux-analytics";

type Variant = "error" | "success" | "info";

const styles: Record<Variant, string> = {
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  success: "border-primary/40 bg-primary/10 text-foreground",
  info: "border-border bg-surface-1 text-muted-foreground",
};

const icons: Record<Variant, typeof Info> = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

/**
 * Banner inline único da app. Regra do guia de linguagem:
 * toast → sucesso passageiro; banner → erro que impede continuar.
 */
export function InlineAlert({
  variant = "error",
  children,
  onRetry,
  retryLabel = L.retry,
  surface,
  className,
}: {
  variant?: Variant;
  children: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** Zona da app, para métricas anónimas. */
  surface?: string;
  className?: string;
}) {
  const Icon = icons[variant];

  useEffect(() => {
    if (variant === "error") trackUx("inline_error_shown", { surface });
  }, [variant, surface]);

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        styles[variant],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onRetry && (
        <button
          type="button"
          onClick={() => {
            trackUx("retry_clicked", { surface });
            onRetry();
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-current/30 px-3 py-1 text-xs font-medium transition hover:bg-current/10"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
