import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initializePaddle, onPaddleEvent, resolvePriceId } from "@/lib/paddle";
import { CREDIT_PACKS, type CreditPack } from "@/lib/studio-credit-packs";
import { useStudio } from "@/lib/studio-context";
import { CreditsCelebration } from "./credits-celebration";

type Props = {
  open: boolean;
  onClose: () => void;
};

type StudioContextData = {
  credits?: { balance?: number };
  [k: string]: unknown;
};

export function CreditsTopupModal({ open, onClose }: Props) {
  const { refresh, balance } = useStudio();
  const qc = useQueryClient();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [celebrateOpen, setCelebrateOpen] = useState(false);
  const [celebrateCredits, setCelebrateCredits] = useState<number | null>(null);
  const [celebrateBalance, setCelebrateBalance] = useState<number | null>(null);
  const lastPackRef = useRef<CreditPack | null>(null);
  const baselineBalanceRef = useRef<number>(0);

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

  // Listen to Paddle events → optimistic bump + poll until webhook fulfills.
  useEffect(() => {
    const unsubscribe = onPaddleEvent((event) => {
      if (event?.name !== "checkout.completed") return;
      const pack = lastPackRef.current;
      if (!pack) return;

      const baseline = baselineBalanceRef.current;
      const optimistic = baseline + pack.credits;

      // Optimistically bump the balance in the react-query cache so the UI
      // updates instantly.
      qc.setQueryData<StudioContextData | undefined>(
        ["studio", "context"],
        (prev) => {
          if (!prev) return prev;
          const currentBalance = prev.credits?.balance ?? baseline;
          return {
            ...prev,
            credits: {
              ...(prev.credits ?? {}),
              balance: Math.max(currentBalance, optimistic),
            },
          };
        },
      );

      // Close the topup modal and celebrate.
      onClose();
      setCelebrateCredits(pack.credits);
      setCelebrateBalance(optimistic);
      setCelebrateOpen(true);

      // Poll to reconcile with the webhook.
      let attempts = 0;
      const maxAttempts = 20;
      const poll = async () => {
        attempts += 1;
        await refresh();
        const data = qc.getQueryData<StudioContextData>(["studio", "context"]);
        const current = data?.credits?.balance ?? 0;
        if (current >= optimistic) {
          setCelebrateBalance(current);
          return;
        }
        if (attempts < maxAttempts) {
          window.setTimeout(poll, 2000);
        }
      };
      window.setTimeout(poll, 1500);
    });
    return unsubscribe;
  }, [qc, onClose, refresh]);

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
      lastPackRef.current = pack;
      baselineBalanceRef.current = balance ?? 0;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir o checkout.");
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      {open && (
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
      )}

      <CreditsCelebration
        open={celebrateOpen}
        credits={celebrateCredits}
        newBalance={celebrateBalance}
        onClose={() => setCelebrateOpen(false)}
      />
    </>
  );
}
