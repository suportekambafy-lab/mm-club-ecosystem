import { useEffect, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import {
  getPaymentMigrationStatus,
  startMigrationCheckout,
} from "@/lib/payment-migration.functions";

/** Pede aos membros ainda na plataforma antiga que confirmem o pagamento. */
export function PaymentMigrationBanner() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPaymentMigrationStatus()
      .then((r) => !cancelled && setShow(r.needsUpdate))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const onUpdate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await startMigrationCheckout({
        data: { origin: window.location.origin },
      });
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Não foi possível abrir o pagamento agora. Tenta outra vez dentro de alguns minutos.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
        <strong className="font-semibold">Atualização de sistema:</strong> estamos a
        migrar para uma nova plataforma de pagamentos, mais rápida e segura. Confirma o
        teu método de pagamento para manteres o acesso contínuo. O teu progresso,
        notas e certificados continuam guardados.
        {error ? <div className="mt-1 text-red-400">{error}</div> : null}
      </div>
      <button
        type="button"
        onClick={onUpdate}
        disabled={busy}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {busy ? "A abrir o pagamento…" : "Atualizar em 1 minuto"}
      </button>
    </div>
  );
}
