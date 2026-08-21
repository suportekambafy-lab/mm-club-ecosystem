import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertCircle, ArrowRight, ArrowLeft, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearIntendedPlan, readIntendedPlan } from "@/lib/intended-plan";
import { MMLogo } from "@/components/mm/logo";
import { toast } from "sonner";
import authCover from "@/assets/auth-cover.jpg";
import { reportAuthFailure } from "@/lib/security.functions";


type Search = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — MM Club" },
      { name: "description", content: "Entra no ecossistema privado da Marca Milionária." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [joinIntent, setJoinIntent] = useState<ReturnType<typeof readIntendedPlan>>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);

  useEffect(() => {
    setJoinIntent(readIntendedPlan());
    supabase.auth.getSession().then(({ data }) => {
      setActiveEmail(data.session?.user?.email ?? null);
    });
  }, []);

  async function switchAccount() {
    await supabase.auth.signOut();
    setActiveEmail(null);
    setEmail("");
    setPassword("");
    toast.success("Sessão terminada. Entra com outra conta.");
  }



  async function sendReset() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setFormError("Escreve o teu email primeiro.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Uniform response: never reveal whether the email exists.
      if (error && /rate limit|too many/i.test(error.message)) throw error;
      toast.success(
        "Se existir uma conta com esse email, enviámos instruções para definir uma nova palavra-passe.",
      );
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setFormError(message);
      toast.error(message);
      void reportAuthFailure({ data: { stage: "recovery" } }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {

    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;
      if (!data.session) throw new Error("Sessão não criada. Tenta novamente.");
      const intended = readIntendedPlan();
      if (redirect) {
        navigate({ to: redirect });
        return;
      }
      if (intended) {
        // Só retomamos o plano se a conta ainda não tiver subscrição ativa.
        const { data: subs } = await supabase
          .from("billing_subscriptions")
          .select("status")
          .eq("user_id", data.session.user.id)
          .in("status", ["active", "trialing", "past_due", "grace_period"])
          .limit(1);
        if (subs && subs.length > 0) {
          clearIntendedPlan();
        } else {
          navigate(
            intended.from === "vip"
              ? { to: "/vip" }
              : { to: "/checkout", search: { plan: intended.slug } },
          );
          return;
        }
      }
      navigate({ to: "/dashboard" });

    } catch (err) {
      const message = getAuthErrorMessage(err);
      setFormError(message);
      toast.error(message);
      void reportAuthFailure({
        data: { stage: "login" },
      }).catch(() => {});
    } finally {
      setLoading(false);
    }

  }




  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* ==== LEFT — Cinematic stage ==== */}
        <aside className="relative hidden overflow-hidden bg-background lg:block">
          {/* Editorial portrait */}
          <img
            src={authCover}
            alt=""
            aria-hidden
            decoding="async"
            fetchPriority="high"
            width={900}
            height={1350}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          {/* Vignette — top for logo, strong bottom for text */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.10 0.004 60 / 0.55) 0%, transparent 18%, transparent 65%, oklch(0.08 0.004 60 / 0.92) 100%)",
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
            <Link to="/" aria-label="MM Club" className="text-white">
              <MMLogo />
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-md"
            >
              <FeedbackMarquee />
              <div className="mt-6 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.32em] text-white/70">
                <span className="h-px w-10 bg-white/40" />
                Clube privado · Temporada 2026
              </div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">
                O ecossistema privado da Marca Milionária.
              </p>
            </motion.div>

          </div>


        </aside>

        {/* ==== RIGHT — Form ==== */}
        <section className="relative flex items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
          {/* Ambient on mobile */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 lg:hidden"
            style={{
              background:
                "radial-gradient(50% 40% at 50% 10%, oklch(0.82 0.13 82 / 0.14), transparent 70%)",
            }}
          />

          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link to="/" aria-label="MM Club">
                <MMLogo />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Início
              </Link>
            </div>

            <div className="hidden justify-end lg:flex">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Voltar ao site
              </Link>
            </div>

            <motion.div
              key="signin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-6 lg:mt-8"
            >
              <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                <span className="h-px w-8 bg-hairline" />
                Regresso ao clube
              </div>
              <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight text-foreground lg:text-5xl">
                Entra.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Continua onde ficaste no ecossistema MM.
              </p>
            </motion.div>

            {activeEmail && (
              <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Sessão ativa como <span className="font-medium text-foreground">{activeEmail}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate({ to: redirect ?? "/dashboard" })}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Continuar
                  </button>
                  <button
                    type="button"
                    onClick={switchAccount}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
                  >
                    Entrar com outra conta
                  </button>
                </div>
              </div>
            )}

            {!activeEmail && (
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <Field
                label="Email"
                icon={Mail}
                type="email"
                value={email}
                onChange={(value) => {
                  setEmail(value);
                  setFormError(null);
                }}
                autoComplete="email"
                required
              />
              <Field
                label="Palavra-passe"
                icon={Lock}
                type="password"
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setFormError(null);
                }}
                autoComplete="current-password"
                required
                minLength={6}
              />

              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82_/_0.7)] transition hover:bg-gold-soft disabled:opacity-50"
              >
                {loading ? "A processar…" : "Entrar no clube"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
            )}

            {!activeEmail && (
              <button
                type="button"
                onClick={sendReset}
                disabled={loading}
                className="mt-4 text-xs text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline disabled:opacity-50"
              >
                Esqueci-me da palavra-passe
              </button>
            )}



            {!activeEmail && (
            <div className="mt-6 flex items-center justify-between text-xs">
              {joinIntent?.from === "vip" ? (
                <Link to="/vip" className="text-muted-foreground transition hover:text-foreground">
                  Ainda sem assinatura? Continuar pagamento →
                </Link>
              ) : (
                <Link
                  to="/checkout"
                  search={joinIntent?.slug ? { plan: joinIntent.slug } : undefined}
                  className="text-muted-foreground transition hover:text-foreground"
                >
                  Ainda sem assinatura? Continuar pagamento →
                </Link>
              )}
              <Link
                to="/quiz"
                className="text-primary hover:underline"
              >
                Fazer diagnóstico
              </Link>
            </div>
            )}

            <footer className="mt-12 text-center text-[11px] text-muted-foreground">
              <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                <Link to="/" className="hover:text-foreground">Início</Link>
                <Link to="/quiz" className="hover:text-foreground">Diagnóstico</Link>
                <Link to="/checkout" className="hover:text-foreground">Planos</Link>
                <Link to="/termos" className="hover:text-foreground">Termos</Link>
                <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
              </nav>
              <p className="mt-3">© {new Date().getFullYear()} MM Club · Marca Milionária</p>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

function getAuthErrorMessage(err: unknown) {
  const raw = err instanceof Error ? err.message : "Erro inesperado";
  const normalized = raw.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email ou palavra-passe incorretos. Confirma os dados e tenta novamente.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirma o teu email antes de entrar.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Muitas tentativas seguidas. Espera alguns minutos e tenta novamente.";
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already")
  ) {
    // Uniform message: never confirm whether an email is registered.
    return "Não foi possível concluir o registo com esses dados. Se já tens conta, entra ou recupera a palavra-passe.";
  }
  if (normalized.includes("password") && normalized.includes("weak")) {
    return "Escolhe uma palavra-passe mais forte (mínimo 8 caracteres, evita passwords comuns).";
  }
  if (normalized.includes("pwned") || normalized.includes("compromised")) {
    return "Essa palavra-passe apareceu em fugas de dados conhecidas. Escolhe outra.";
  }

  // Never surface raw backend errors to the browser.
  return "Não foi possível concluir a operação. Confirma os dados e tenta novamente.";
}

function Field({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: {
  label: string;
  icon: typeof Mail;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      <div className="group relative mt-2">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition group-focus-within:text-primary" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className="w-full rounded-xl border border-border bg-surface-1 py-3.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </label>
  );
}

const FEEDBACKS = [
  { name: "Ricardo M.", role: "Fundador · Agência", quote: "Em 90 dias reposicionei a marca e triplicámos o ticket médio." },
  { name: "Sofia A.", role: "Consultora", quote: "O ecossistema MM deu-me clareza estratégica que nenhum curso deu." },
  { name: "João P.", role: "CEO · SaaS", quote: "Passei de operador a dono. A comunidade é de outro nível." },
  { name: "Marta L.", role: "Coach executiva", quote: "Autoridade real, sem showoff. É isto que faltava no mercado." },
  { name: "André S.", role: "Investidor", quote: "Networking premium a sério. Já fechei duas parcerias aqui dentro." },
  { name: "Inês R.", role: "Founder · D2C", quote: "As ferramentas e as lives valem sozinhas o investimento anual." },
];

function FeedbackMarquee() {
  const items = [...FEEDBACKS, ...FEEDBACKS];
  return (
    <div
      className="relative h-40 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(180deg, transparent 0%, black 18%, black 82%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(180deg, transparent 0%, black 18%, black 82%, transparent 100%)",
      }}
    >
      <div className="animate-[mm-marquee-y_28s_linear_infinite] flex flex-col gap-3">
        {items.map((f, i) => (
          <figure
            key={i}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm"
          >
            <blockquote className="text-[12.5px] leading-snug text-white/85">
              “{f.quote}”
            </blockquote>
            <figcaption className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
              {f.name} · {f.role}
            </figcaption>
          </figure>
        ))}
      </div>
      <style>{`@keyframes mm-marquee-y { from { transform: translateY(0); } to { transform: translateY(-50%); } }`}</style>
    </div>
  );
}

