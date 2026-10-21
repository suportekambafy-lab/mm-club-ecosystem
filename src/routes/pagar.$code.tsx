import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  confirmKlarnaMmpayOrder,
  confirmMmpayPayment,
  getMmpayLink,
  startKlarnaMmpayPayment,
  startMmpayCheckout,
} from "@/lib/mmpay.functions";
import { formatMoney } from "@/lib/billing/types";
import { MMLogo } from "@/components/mm/logo";
import { CardBrandsLogo, KlarnaLogo, MbWayLogo } from "@/components/mmpay/payment-logos";

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

type PayMethod = "card" | "mb_way" | "klarna";

const METHOD_OPTIONS: Array<{
  id: PayMethod;
  label: string;
  hint: string;
  Logo: (props: { className?: string }) => React.ReactNode;
}> = [
  { id: "card", label: "Cartão", hint: "Visa, Mastercard, Apple Pay e Google Pay", Logo: CardBrandsLogo },
  { id: "mb_way", label: "MB WAY", hint: "Confirma na app MB WAY", Logo: MbWayLogo },
  { id: "klarna", label: "Klarna", hint: "Paga em 3 vezes sem juros", Logo: KlarnaLogo },
];

async function loadKlarnaSdk(): Promise<any> {
  const w = window as any;
  if (w.Klarna) return w.Klarna;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://x.klarnacdn.net/kp/lib/v1/api.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Não foi possível carregar o Klarna. Tenta novamente."));
    document.head.appendChild(s);
  });
  return (window as any).Klarna;
}

function MmpayPage() {
  const { code } = useParams({ from: "/pagar/$code" });
  const { session_id } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PayMethod>("card");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [klarna, setKlarna] = useState<{ clientToken: string; sessionRef: string } | null>(null);
  const [klarnaPaid, setKlarnaPaid] = useState(false);

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
      if (method === "klarna") {
        const res = await startKlarnaMmpayPayment({
          data: { code, email: email.trim(), name: name.trim(), phone: phone.trim() },
        });
        const Klarna = await loadKlarnaSdk();
        Klarna.Payments.init({ client_token: res.clientToken });
        setKlarna(res);
        Klarna.Payments.load(
          { container: "#klarna-widget", payment_method_category: "pay_later" },
          {},
          (r: { show_form?: boolean }) => {
            if (r && r.show_form === false) {
              setError("O Klarna não está disponível para este pagamento. Experimenta cartão ou MB WAY.");
              setPending(false);
              return;
            }
            authorizeKlarna(res);
          },
        );
        return;
      }
      const res = await startMmpayCheckout({
        data: { code, email: email.trim(), name: name.trim(), phone: phone.trim(), origin: window.location.origin, method },
      });
      window.location.href = res.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o pagamento. Tenta novamente.");
      setPending(false);
    }
  };

  const authorizeKlarna = (klarna: { clientToken: string; sessionRef: string }) => {
    const Klarna = (window as any).Klarna;
    Klarna.Payments.authorize(
      { payment_method_category: "pay_later" },
      {},
      async (res: { approved?: boolean; authorization_token?: string }) => {
        if (!res.approved || !res.authorization_token) {
          setError("O Klarna não aprovou este pagamento. Experimenta outro método.");
          setPending(false);
          return;
        }
        try {
          const done = await confirmKlarnaMmpayOrder({
            data: { code, sessionRef: klarna.sessionRef, authorizationToken: res.authorization_token },
          });
          if (done.paid) setKlarnaPaid(true);
          else setError("Não foi possível concluir o pagamento. Fala com a equipa MM Club.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Não foi possível concluir o pagamento.");
        }
        setPending(false);
      },
    );
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-5 sm:py-5">
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
        <div className="mb-3 flex justify-center sm:mb-3">
          <MMLogo size={36} />
        </div>

        {isLoading || (session_id && confirmQuery.isLoading) ? (
          <div className="h-96 animate-pulse rounded-3xl bg-surface-1 ring-1 ring-border" />
        ) : klarnaPaid || (session_id && confirmQuery.data?.paid) ? (
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
              <img src={link.coverUrl} alt={link.title} className="aspect-[3/1] w-full object-cover sm:aspect-[7/2]" />
            ) : null}
            <div className="p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pagamento MM Club</p>
              <h1 className="mt-2 font-display text-xl leading-tight tracking-tight text-foreground sm:text-2xl">{link.title}</h1>
              {link.description ? (
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {link.description}
                </p>
              ) : null}

              <div className="mt-4 flex items-baseline gap-2 rounded-2xl bg-background px-4 py-2.5 ring-1 ring-border">
                <span className="font-display text-3xl leading-none tracking-tight text-foreground sm:text-4xl">
                  {formatMoney(link.amountCents, link.currency)}
                </span>
                <span className="text-sm text-muted-foreground">pagamento único</span>
              </div>

              {session_id && confirmQuery.data && !confirmQuery.data.paid ? (
                <p className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  O pagamento ainda não foi concluído. Se usaste MB WAY, confirma na app e atualiza esta página.
                </p>
              ) : null}

              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@exemplo.com"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
              <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Nome
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O teu nome"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
              <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Telemóvel
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+351 912 345 678"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Método de pagamento
              </p>
              <div className="mx-auto mt-2 grid w-full max-w-[19rem] grid-cols-3 gap-2">
                {METHOD_OPTIONS.map((opt, i) => {
                  const Logo = opt.Logo;
                  const selected = method === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setMethod(opt.id);
                        setKlarna(null);
                        setError(null);
                      }}
                      title={opt.hint}
                      className={`relative flex aspect-square flex-col items-center overflow-hidden rounded-xl p-1.5 ring-1 transition-colors ${
                        selected
                          ? "text-primary ring-primary"
                          : "bg-background text-muted-foreground ring-border hover:text-foreground"
                      }`}
                    >
                      {selected ? (
                        <motion.span
                          layoutId="mmpay-method-bg"
                          className="absolute inset-0 bg-primary/10"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      ) : null}
                      <motion.span
                        className="relative flex w-full min-h-0 flex-1 items-center justify-center"
                        animate={selected ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                        transition={{ duration: 0.4 }}
                      >
                        <Logo className="h-full w-full" />
                      </motion.span>
                      <span className="relative mt-1 flex min-h-[1.75rem] w-full flex-col items-center justify-end gap-0.5 sm:mt-1.5 sm:min-h-[2.25rem] sm:gap-1">
                        {opt.id === "klarna" && link ? (
                          <motion.span
                            className="rounded-full bg-[#FFB3C7] px-1.5 py-0.5 text-[9px] font-bold text-[#17120F] sm:px-2 sm:text-[10px]"
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          >
                            3x {formatMoney(Math.ceil(link.amountCents / 3), link.currency)}
                          </motion.span>
                        ) : null}
                        <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">
                          {opt.label}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={method}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="mt-3 text-center text-xs text-muted-foreground"
                >
                  {method === "klarna" && link ? (
                    <>
                      Paga em <span className="font-semibold text-foreground">3x de {formatMoney(Math.ceil(link.amountCents / 3), link.currency)}</span> sem juros com Klarna
                    </>
                  ) : (
                    METHOD_OPTIONS.find((o) => o.id === method)?.hint
                  )}
                </motion.p>
              </AnimatePresence>

              {error ? (
                <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}

              <div id="klarna-widget" aria-hidden className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" />
              {(
                <button
                  type="submit"
                  disabled={pending}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60 sm:py-3.5"
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
              )}

              <div className="mt-4 border-t border-border pt-3">
                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Pagamento seguro processado pela Stripe ou Klarna. O MM Club nunca vê os dados do teu cartão.
                </p>
              </div>
            </div>
          </form>
        )}

        <footer className="mt-5 text-center text-xs text-muted-foreground sm:mt-6">
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
