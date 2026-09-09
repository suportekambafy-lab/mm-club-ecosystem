import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aviso para quem cancelou o plano mas ainda tem acesso: diz até quando
 * consegue ver tudo e leva directamente à reativação.
 */
export function CancelBanner() {
  const [until, setUntil] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("billing_subscriptions")
        .select("status, cancel_at_period_end, current_period_end")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const scheduled =
        Boolean(data.cancel_at_period_end) &&
        ["active", "trialing", "past_due", "grace_period"].includes(
          String(data.status),
        );
      if (!scheduled) return;
      const end = data.current_period_end
        ? new Date(data.current_period_end as string)
        : null;
      if (!end || end.getTime() < Date.now()) return;
      setUntil(
        new Intl.DateTimeFormat("pt-PT", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(end),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!until) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <CalendarClock className="h-5 w-5 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
        <strong className="font-semibold">O teu plano está cancelado.</strong>{" "}
        Ficas sem acesso às aulas, lives, comunidade e ferramentas a partir de{" "}
        {until}. Reativa agora para não perderes nada — o teu progresso
        continua guardado.
      </div>
      <Link
        to="/subscricao"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-300"
      >
        Reativar agora
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
