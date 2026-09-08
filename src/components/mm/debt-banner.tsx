import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aviso permanente para quem está em dívida: explica em linguagem simples
 * porque é que as aulas estão fechadas e leva directamente ao pagamento.
 */
export function DebtBanner({ userId }: { userId: string | null }) {
  const [debt, setDebt] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("billing_invoices")
        .select("total_cents, currency, status")
        .eq("user_id", userId)
        .neq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setDebt(
        new Intl.NumberFormat("pt-PT", {
          style: "currency",
          currency: String(data.currency ?? "EUR"),
        }).format((data.total_cents as number) / 100),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3.5 text-amber-100 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
        <strong className="font-semibold">O teu acesso está suspenso.</strong>{" "}
        {debt ? `Tens ${debt} em dívida. ` : "Há um pagamento em falta. "}
        Regulariza para voltares a ver as aulas, as lives, a comunidade e as
        ferramentas. Nada foi apagado — o teu progresso está guardado.
      </div>
      <Link
        to="/subscricao"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-300"
      >
        Regularizar agora
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
