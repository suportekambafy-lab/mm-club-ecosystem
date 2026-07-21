import { useEffect, useState } from "react";
import { X, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initializePaddle, resolvePriceId } from "@/lib/paddle";
import { CREDIT_PACKS, type CreditPack } from "@/lib/studio-credit-packs";
import { useStudio } from "@/lib/studio-context";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreditsTopupModal({ open, onClose }: Props) {
  const { refresh } = useStudio();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? undefined });
    });
    initializePaddle().catch((e) => console.error("Paddle init failed", e));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleBuy = async (pack: CreditPack) => {
    if (!user?.id) {
      setError("Precisas de sessão iniciada para carregar créditos.");
      return;
    }
    setPending(pack.priceId);
    setError(null);
    try {
      await initializePaddle();
      const paddlePriceId = await resolvePriceId(pack.priceId);
      const successUrl = `${window.location.origin}/ferramentas/studio?topup=success`;
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: user.email ? { email: user.email } : undefined,
        customData: { userId: user.id, pack: pack.priceId, credits: String(pack.credits) },
        settings: {
          displayMode: "overlay",
          theme: "dark",
          successUrl,
          showAddDiscounts: false,
        },
      });
      // Refresh a few times after opening — Paddle overlay closes on success and
      // the webhook takes a moment to fulfill.
      const t1 = window.setTimeout(() => refresh(), 8000);
      const t2 = window.setTimeout(() => refresh(), 20000);
      const t3 = window.setTimeout(() => refresh(), 45000);
      // best-effort; not tracked
      void [t1, t2, t3];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir o checkout.");
    } finally {
      setPending(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-md md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-4xl overflow-hidden rounded-t-3xl border border-[color:var(--hairline)] bg-surface-1 md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-[color:var(--hairline)] p-6 md:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            Carregar créditos
          </p>
          <h2 className="mt-2 font-display text-2xl text-foreground md:text-3xl">
            Escolhe o teu pack.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pagamento seguro via cartão ou MB Way. Os créditos aparecem no teu saldo em segundos após a confirmação.
          </p>
        </div>

        <div className="grid gap-3 p-6 md:grid-cols-4 md:p-8">
          {CREDIT_PACKS.map((pack) => {
            const isPending = pending === pack.priceId;
            return (
              <button
                key={pack.id}
                type="button"
                disabled={isPending}
                onClick={() => handleBuy(pack)}
                className={
                  "group relative flex flex-col rounded-2xl border p-5 text-left transition disabled:opacity-60 " +
                  (pack.highlight
                    ? "border-primary/60 bg-primary/5 hover:border-primary"
                    : "border-[color:var(--hairline)] bg-background/40 hover:border-primary/50")
                }
              >
                {pack.highlight && (
                  <span className="absolute -top-2 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Popular
                  </span>
                )}
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {pack.name}
                </p>
                <p className="mt-2 font-display text-3xl text-foreground">{pack.price}</p>
                <p className="mt-1 text-xs text-muted-foreground">{pack.tagline}</p>

                <div className="mt-4 space-y-2 text-sm text-foreground/90">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium">{pack.credits.toLocaleString("pt-PT")} créditos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{pack.videos} vídeos IA</span>
                  </div>
                </div>

                <span
                  className={
                    "mt-5 inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition " +
                    (pack.highlight
                      ? "bg-primary text-primary-foreground group-hover:brightness-110"
                      : "bg-foreground text-background group-hover:opacity-90")
                  }
                >
                  {isPending ? "A abrir…" : "Carregar"}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="border-t border-[color:var(--hairline)] bg-destructive/10 px-6 py-3 text-xs text-destructive md:px-8">
            {error}
          </div>
        )}

        <div className="border-t border-[color:var(--hairline)] px-6 py-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:px-8">
          Métodos: Cartão · MB Way · Apple Pay · Google Pay · PayPal
        </div>
      </div>
    </div>
  );
}
