import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initializePaddle, resolvePriceId } from "@/lib/paddle";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

type PaySearch = { plan?: "start" | "plus" | "elite" };

const PLAN_MAP: Record<
  NonNullable<PaySearch["plan"]>,
  { name: string; priceId: string; price: string; cadence: string }
> = {
  start: {
    name: "MM Club Start",
    priceId: "mm_club_start_monthly",
    price: "29,90 €",
    cadence: "/ mês",
  },
  plus: {
    name: "MM Club Plus",
    priceId: "mm_club_plus_semestral",
    price: "149,90 €",
    cadence: "/ 6 meses",
  },
  elite: {
    name: "MM Club Elite",
    priceId: "mm_club_elite_yearly",
    price: "249,90 €",
    cadence: "/ ano",
  },
};

export const Route = createFileRoute("/checkout/pay")({
  validateSearch: (s: Record<string, unknown>): PaySearch => {
    const p = s.plan;
    return {
      plan: p === "start" || p === "plus" || p === "elite" ? p : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Finalizar adesão — MM Club" },
      { name: "description", content: "Conclui a tua adesão ao MM Club com segurança." },
    ],
  }),
  component: CheckoutPayPage,
});

function CheckoutPayPage() {
  const { plan } = useSearch({ from: "/checkout/pay" });
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const selected = plan ? PLAN_MAP[plan as NonNullable<PaySearch["plan"]>] : null;

  useEffect(() => {
    if (!selected) {
      navigate({ to: "/checkout" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user
          ? { id: data.user.id, email: data.user.email ?? undefined }
          : null;

        await initializePaddle();
        const paddlePriceId = await resolvePriceId(selected.priceId);
        if (cancelled) return;

        window.Paddle.Checkout.open({
          items: [{ priceId: paddlePriceId, quantity: 1 }],
          customer: user?.email ? { email: user.email } : undefined,
          customData: user?.id ? { userId: user.id } : undefined,
          settings: {
            displayMode: "inline",
            frameTarget: "paddle-checkout-frame",
            frameInitialHeight: 450,
            frameStyle:
              "width: 100%; min-width: 312px; background-color: transparent; border: none;",
            successUrl: `${window.location.origin}/checkout/return`,
            allowLogout: false,
          },
        });

        setReady(true);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível iniciar o checkout. Tenta novamente.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected, navigate]);

  if (!selected) return null;

  return (
    <>
      <PaymentTestModeBanner />
      <div className="relative min-h-dvh bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-[520px] bg-[radial-gradient(ellipse_at_top,oklch(0.82_0.13_82_/_0.14),transparent_60%)]"
        />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <Link
            to="/checkout"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos planos
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Pagamento seguro via Paddle
          </span>
        </header>

        <main className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-24 md:grid-cols-[380px_1fr]">
          <aside className="rounded-3xl border border-border bg-surface-1 p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Adesão selecionada
            </p>
            <h1 className="mt-3 font-display text-3xl tracking-tight">
              {selected.name}
            </h1>
            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="font-display text-5xl leading-none tracking-tight">
                {selected.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {selected.cadence}
              </span>
            </div>
            <div className="my-6 h-px w-full bg-border" />
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>Acesso completo à plataforma MM Club</li>
              <li>Cursos, comunidade privada e lives</li>
              <li>Ferramentas e suporte IA</li>
              <li>Cancela quando quiseres</li>
            </ul>
          </aside>

          <section className="rounded-3xl border border-border bg-surface-1 p-4 md:p-6">
            {error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
                {error}
              </div>
            ) : !ready ? (
              <div className="flex min-h-[450px] items-center justify-center text-sm text-muted-foreground">
                A preparar checkout seguro…
              </div>
            ) : null}
            <div className="paddle-checkout-frame min-h-[450px]" />
          </section>
        </main>
      </div>
    </>
  );
}
