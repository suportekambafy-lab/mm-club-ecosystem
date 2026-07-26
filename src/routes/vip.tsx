import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startCheckout } from "@/lib/billing.functions";


export const Route = createFileRoute("/vip")({
  head: () => ({
    meta: [
      { title: "Acesso VIP — 3 meses grátis no MM Club" },
      {
        name: "description",
        content:
          "Convite VIP: 3 meses grátis no MM Club. Acesso completo aos cursos, comunidade, lives e ferramentas exclusivas.",
      },
      { property: "og:title", content: "Acesso VIP — 3 meses grátis no MM Club" },
      {
        property: "og:description",
        content:
          "Convite VIP: 3 meses grátis no MM Club. Cancela quando quiseres antes do fim do trial.",
      },
    ],
  }),
  component: VipPage,
});

const BENEFITS = [
  "Acesso completo ao MM Club durante 3 meses",
  "Todos os cursos, aulas e novos lançamentos",
  "Comunidade privada, lives e ferramentas",
  "Suporte MM Intelligence 24/7",
  "Cancelas quando quiseres antes do fim do trial",
  "Depois do 3.º mês, apenas 29,90 €/mês",
];

function VipPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? undefined });
      }
    });
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("vip") === "success") setSuccess(true);
    }
  }, []);

  const handleStart = async () => {
    if (!user) {
      window.location.href = `/auth?redirect=${encodeURIComponent("/vip")}`;
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { checkoutUrl } = await startCheckout({
        data: {
          priceSlug: "mm_club_monthly",
          couponCode: "MMVIP3",
          origin: window.location.origin,
          successPath: "/vip?vip=success",
        },
      });

      window.location.href = checkoutUrl;
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível abrir o checkout. Tenta novamente.",
      );
      setPending(false);
    }
  };

  return (
    <>
      
      <div className="relative min-h-[calc(100dvh-3rem)] overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-[520px] bg-[radial-gradient(ellipse_at_top,oklch(0.82_0.13_82_/_0.22),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:56px_56px]"
        />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-4 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            Convite VIP
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-5 text-center text-4xl font-semibold tracking-tight md:text-5xl"
          >
            3 meses grátis no MM Club
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 max-w-lg text-center text-base text-muted-foreground md:text-lg"
          >
            Acesso completo ao ecossistema MM Club durante 90 dias. Depois do
            trial, continua por 29,90 €/mês — cancelas quando quiseres.
          </motion.p>

          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
            >
              Recebemos o teu pagamento. A tua conta VIP será ativada em
              segundos.
            </motion.div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-10 w-full overflow-hidden rounded-3xl border border-primary/30 bg-card/60 p-8 shadow-[0_30px_80px_-40px_oklch(0.82_0.13_82_/_0.4)] backdrop-blur"
          >
            <div>
              <p className="text-sm text-muted-foreground">Plano VIP</p>
              <p className="text-lg font-semibold">MM Club — 3 meses grátis</p>
            </div>

            <div className="mt-6 flex items-end gap-2">
              <span className="text-5xl font-semibold tracking-tight">0 €</span>
              <span className="mb-2 text-sm text-muted-foreground">
                nos primeiros 3 meses
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Depois, 29,90 €/mês. Cancelas a qualquer momento antes do fim do
              trial.
            </p>

            <ul className="mt-8 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleStart}
              disabled={pending}
              className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-lg transition hover:opacity-95 disabled:opacity-60"
            >
              {pending ? "A abrir checkout..." : "Ativar 3 meses grátis"}
            </button>

            {error ? (
              <p className="mt-4 text-center text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Pagamento seguro via Mollie. Aceitamos cartão, MB WAY, Multibanco
              e mais.
            </p>
          </motion.div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Preferes pagar à vista (semestral ou anual)?{" "}
            <Link to="/checkout" className="underline hover:text-foreground">
              Vê os outros planos
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
