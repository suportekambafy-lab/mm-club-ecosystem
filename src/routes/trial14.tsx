import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rememberIntendedPlan } from "@/lib/intended-plan";
import { startCheckout, startGuestCheckout } from "@/lib/billing.functions";

const PRICE_SLUG = "mm_club_trial14";

export const Route = createFileRoute("/trial14")({
  head: () => ({
    meta: [
      { title: "3 dias grátis no MM Club — experimenta sem compromisso" },
      {
        name: "description",
        content:
          "Experimenta o MM Club durante 3 dias grátis: cursos, comunidade, lives e ferramentas. Cancelas quando quiseres antes do fim do trial.",
      },
      {
        property: "og:title",
        content: "3 dias grátis no MM Club",
      },
      {
        property: "og:description",
        content:
          "3 dias de acesso completo ao MM Club. Depois, apenas 29,90 €/mês — cancelas quando quiseres.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trial14Page,
});

const BENEFITS = [
  "Acesso completo ao MM Club durante 3 dias",
  "Todos os cursos, aulas e novos lançamentos",
  "Comunidade privada, lives e ferramentas",
  "Suporte MM Inteligence 24/7",
  "Apenas 1 € de validação do cartão — os 3 dias continuam grátis",
  "Cancelas quando quiseres antes do fim do trial",
  "Depois dos 3 dias, apenas 29,90 €/mês",
];

function Trial14Page() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [askEmail, setAskEmail] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? undefined });
        setGuestEmail((prev) => prev || data.user.email || "");
        const dn = (data.user.user_metadata as { display_name?: string } | null)
          ?.display_name;
        if (dn) setGuestName((prev) => prev || dn);
      }
    });
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("trial") === "success") setSuccess(true);
    }
  }, []);

  const handleStart = async () => {
    if (!user && !askEmail) {
      setAskEmail(true);
      return;
    }

    setPending(true);
    setError(null);
    rememberIntendedPlan(PRICE_SLUG, "vip");
    try {
      if (!user) {
        const res = await startGuestCheckout({
          data: {
            email: guestEmail.trim(),
            name: guestName.trim(),
            priceSlug: PRICE_SLUG,
            origin: window.location.origin,
          },
        });
        window.location.href = res.checkoutUrl;
        return;
      }
      const { checkoutUrl } = await startCheckout({
        data: {
          priceSlug: PRICE_SLUG,
          origin: window.location.origin,
          successPath: "/trial14?trial=success",
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
          Teste grátis
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mt-5 text-center text-4xl font-semibold tracking-tight md:text-5xl"
        >
          3 dias grátis no MM Club
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 max-w-lg text-center text-base text-muted-foreground md:text-lg"
        >
          Acesso completo ao ecossistema MM Club durante 3 dias. Depois do
          trial, continua por 29,90 €/mês — cancelas quando quiseres.
        </motion.p>

        {success ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
          >
            Recebemos a validação do cartão. A tua conta será ativada em
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
            <p className="text-sm text-muted-foreground">Plano de teste</p>
            <p className="text-lg font-semibold">MM Club — 3 dias grátis</p>
          </div>

          <div className="mt-6 flex items-end gap-2">
            <span className="text-5xl font-semibold tracking-tight">0 €</span>
            <span className="mb-2 text-sm text-muted-foreground">
              nos primeiros 3 dias
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Não cobramos a mensalidade hoje: só validamos o cartão. Depois dos
            3 dias, 29,90 €/mês — cancelas a qualquer momento antes do fim do
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
            {pending ? "A abrir checkout..." : "Começar 3 dias grátis"}
          </button>

          {error && !askEmail ? (
            <p className="mt-4 text-center text-sm text-destructive">{error}</p>
          ) : null}

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Pagamento seguro via Mollie.
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

      {askEmail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.form
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleStart();
            }}
            className="w-full max-w-md rounded-3xl bg-card p-7 ring-1 ring-border"
          >
            <h2 className="text-2xl font-semibold tracking-tight">
              {user ? "Confirma os teus dados" : "Só falta o teu email"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {user
                ? "Vamos validar o cartão e ativar os 3 dias grátis nesta conta."
                : "Criamos a tua conta MM Club automaticamente após a validação do cartão e enviamos-te o acesso para este email."}
            </p>

            <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus={!user}
              readOnly={!!user}
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="tu@exemplo.com"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary read-only:opacity-70"
            />

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nome
            </label>
            <input
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="O teu nome"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />

            {error ? (
              <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                pending ||
                !guestEmail.includes("@") ||
                guestName.trim().length < 2
              }
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
            >
              {pending ? "A abrir pagamento..." : "Continuar para pagamento"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAskEmail(false);
                setError(null);
              }}
              className="mt-3 w-full text-center text-xs text-muted-foreground underline"
            >
              Cancelar
            </button>
          </motion.form>
        </div>
      ) : null}
    </div>
  );
}
