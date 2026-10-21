import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { confirmMmpayPayment, getMmpayLink, startMmpayCheckout } from "@/lib/mmpay.functions";
import { formatMoney } from "@/lib/billing/types";
import { MMLogo } from "@/components/mm/logo";

export const Route = createFileRoute("/pagar/$code")({
  validateSearch: z.object({ session_id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Pagamento seguro — MM Club" },
      { name: "description", content: "Conclui o teu pagamento ao MM Club em segurança." },
      { property: "og:title", content: "Pagamento seguro — MM Club" },
      { property: "og:description", content: "Conclui o teu pagamento ao MM Club em segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MmpayPage,
});

const METHODS = ["Cartão", "Apple Pay", "Google Pay", "MB WAY", "Klarna"];

function MmpayPage() {
  const { code } = useParams({ from: "/pagar/$code" });
  const { session_id } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mmpay-link", code],
    queryFn: () => getMmpayLink({ data: { code } }),
    staleTime: 60_000,
  });
  const confirmQuery = useQuery({
    queryKey: ["mmpay-confirm", session_id],
    queryFn: () => confirmMmpayPayment({ data: { code, sessionId: session_id! } }),
    enabled: Boolean(session_id),
  });

  const link = data?.found ? data.link : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await startMmpayCheckout({
        data: { code, email: email.trim(), name: name.trim() || null, origin: window.location.origin },
      });
      window.location.href = res.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o pagamento. Tenta novamente.");
      setPending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-[420px] bg-[radial-gradient(ellipse_at_top,oklch(0.82_0.13_82_/_0.16),transparent_60%)]"
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 flex justify-center">
          <MMLogo size={44} />
        </div>

        {isLoading || (session_id && confirmQuery.isLoading) ? (
          <div className="h-96 animate-pulse rounded-3xl bg-surface-1 ring-1 ring-border" />
        ) : session_id && confirmQuery.data?.paid ? (
          <div className="rounded-3xl bg-surface-1 p-8 text-center ring-1 ring-border">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 font-display text-2xl tracking-tight text-foreground">Pagamento confirmado</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Obrigado! {link ? `Recebemos o pagamento de «${link.title}». ` : ""}Vais receber o recibo por email e a
              equipa MM Club entra em contacto contigo.
            </p>
          </div>
        ) : !link ? (
          <div className="rounded-3xl bg-surface-1 p-8 text-center ring-1 ring-border">
            <h1 className="font-display text-2xl tracking-tight text-foreground">Link indisponível</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Este link de pagamento já não está ativo. Fala com a equipa MM Club para receberes um novo.
            </p>
            <a
              href="mailto:geral@mmclub.pt"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Contactar o MM Club
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="overflow-hidden rounded-3xl bg-surface-1 ring-1 ring-border">
            {link.coverUrl ? (
              <img src={link.coverUrl} alt={link.title} className="aspect-[16/9] w-full object-cover" />
            ) : null}
            <div className="p-7 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pagamento MM Club</p>
              <h1 className="mt-3 font-display text-2xl leading-tight tracking-tight text-foreground">{link.title}</h1>
              {link.description ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {link.description}
                </p>
              ) : null}

              <div className="mt-6 flex items-baseline gap-2 rounded-2xl bg-background px-5 py-4 ring-1 ring-border">
                <span className="font-display text-4xl leading-none tracking-tight text-foreground">
                  {formatMoney(link.amountCents, link.currency)}
                </span>
                <span className="text-sm text-muted-foreground">pagamento único</span>
              </div>

              {session_id && confirmQuery.data && !confirmQuery.data.paid ? (
                <p className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  O pagamento ainda não foi concluído. Se usaste MB WAY, confirma na app e atualiza esta página.
                </p>
              ) : null}

              <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@exemplo.com"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              />
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Nome (opcional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O teu nome"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              />

              {error ? (
                <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> A abrir pagamento…
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" /> Pagar com segurança
                  </>
                )}
              </button>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {METHODS.map((m) => (
                  <span key={m} className="rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border">
                    {m}
                  </span>
                ))}
              </div>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Pagamento processado pela Stripe. O MM Club nunca vê os dados do teu cartão.
              </p>
            </div>
          </form>
        )}

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link to="/termos" className="underline hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="underline hover:text-foreground">Privacidade</Link>
            <Link to="/reembolsos" className="underline hover:text-foreground">Reembolsos</Link>
          </nav>
          <p className="mt-3">© {new Date().getFullYear()} MM Club · Kambafy, LLC</p>
        </footer>
      </motion.div>
    </main>
  );
}
