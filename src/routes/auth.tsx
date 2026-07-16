import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ArrowLeft, Mail, Lock, User, Sparkles, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MMLogo } from "@/components/mm/logo";
import { toast } from "sonner";
import authCover from "@/assets/auth-cover.jpg";
import { cn } from "@/lib/utils";

type Search = { redirect?: string };

export const Route = createFileRoute("/auth")({
  ssr: false,
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

const testimonials = [
  {
    quote:
      "O clube mudou o meu ritmo. Em quatro meses fiz mais do que nos dois anos anteriores.",
    name: "Inês Cardoso",
    role: "Fundadora · Estúdio de branding",
  },
  {
    quote:
      "Nunca tive acesso a este nível de curadoria e comunidade portuguesa a este preço.",
    name: "Ricardo Bento",
    role: "E-commerce · +5 lojas",
  },
  {
    quote:
      "A Suporte IA e as lives semanais foram o divisor de águas para a minha marca.",
    name: "Marta Silva",
    role: "Coach & criadora digital",
  },
];

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [tIndex, setTIndex] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/dashboard" });
    });
  }, [navigate, redirect]);

  useEffect(() => {
    const t = setInterval(() => setTIndex((n) => (n + 1) % testimonials.length), 6000);
    return () => clearInterval(t);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Já podes entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: redirect ?? "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  const t = testimonials[tIndex];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* ==== LEFT — Cinematic stage (MM Club identity) ==== */}
        <aside className="relative hidden overflow-hidden bg-background lg:block">
          {/* Base atmosphere */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.12 0.004 60) 0%, oklch(0.10 0.004 60) 100%)",
            }}
          />
          {/* Ambient glows — gold + violet, matching landing hero */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 45% at 22% 18%, oklch(0.82 0.13 82 / 0.28), transparent 70%), radial-gradient(50% 42% at 82% 88%, oklch(0.55 0.22 285 / 0.22), transparent 70%)",
            }}
          />
          {/* Fine grid */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(to right, oklch(1 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.05) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 90% 70% at 50% 45%, black 40%, transparent 85%)",
            }}
          />
          {/* Big-type watermark — landing vocabulary */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[26%] flex flex-col items-center gap-1 leading-[1] select-none"
          >
            <div
              className="font-display text-[9vw] font-extrabold tracking-tight text-white/[0.06]"
            >
              #CLUB
            </div>
            <div
              className="font-display text-[9vw] font-extrabold tracking-tight text-transparent"
              style={{ WebkitTextStroke: "1px oklch(0.82 0.13 82 / 0.35)" }}
            >
              MARCA
            </div>
            <div
              className="font-display text-[8vw] font-extrabold tracking-tight"
              style={{
                background: "linear-gradient(180deg, var(--gold-soft), var(--gold-deep))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                opacity: 0.85,
              }}
            >
              MILIONÁRIA
            </div>
          </div>
          {/* Bottom fade for legibility */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, oklch(0.10 0.004 60 / 0.85) 60%, oklch(0.10 0.004 60) 100%)",
            }}
          />


          {/* Content */}
          <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
            <Link to="/" aria-label="MM Club" className="text-white">
              <MMLogo />
            </Link>

            <div className="max-w-lg">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 backdrop-blur">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/80">
                    Clube privado · Temporada 2026
                  </span>
                </div>
                <h2 className="mt-6 font-display text-4xl leading-[1.02] tracking-tight text-white xl:text-[52px]">
                  Bem-vindo ao{" "}
                  <span
                    className="inline-block bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(180deg, var(--gold-soft), var(--gold-deep))",
                    }}
                  >
                    ecossistema privado
                  </span>{" "}
                  da Marca Milionária.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 xl:text-base">
                  Cursos, Suporte IA, comunidade, lives e ferramentas — desenhados
                  como um único produto premium.
                </p>
              </motion.div>

              {/* Rotating testimonial */}
              <div className="mt-10 min-h-[130px]">
                <AnimatePresence mode="wait">
                  <motion.figure
                    key={t.name}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md"
                  >
                    <Quote className="h-4 w-4 text-primary" />
                    <blockquote className="mt-3 font-display text-base leading-relaxed text-white xl:text-lg">
                      “{t.quote}”
                    </blockquote>
                    <figcaption className="mt-3 text-xs text-white/60">
                      <span className="text-white/90">{t.name}</span> · {t.role}
                    </figcaption>
                  </motion.figure>
                </AnimatePresence>
                <div className="mt-3 flex items-center gap-1.5">
                  {testimonials.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 rounded-full transition-all",
                        i === tIndex ? "w-6 bg-primary" : "w-2 bg-white/25",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <dl className="grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
              {[
                ["+2.400", "Membros ativos"],
                ["+120", "Aulas na Academia"],
                ["4.9★", "Satisfação"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl text-white">{n}</dt>
                  <dd className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/60">
                    {l}
                  </dd>
                </div>
              ))}
            </dl>
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
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-6 lg:mt-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1/60 px-3 py-1.5 backdrop-blur">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {mode === "signin" ? "Regresso ao clube" : "Adesão ao clube"}
                </span>
              </div>
              <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight text-foreground">
                {mode === "signin" ? "Entra." : "Cria a tua conta."}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Continua onde ficaste no ecossistema MM."
                  : "Ainda sem plano? Depois de criar conta, escolhes o teu na página seguinte."}
              </p>
            </motion.div>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              {mode === "signup" && (
                <Field
                  label="Nome"
                  icon={User}
                  value={displayName}
                  onChange={setDisplayName}
                  autoComplete="name"
                  required
                />
              )}
              <Field
                label="Email"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                required
              />
              <Field
                label="Palavra-passe"
                icon={Lock}
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
              />

              <button
                type="submit"
                disabled={loading}
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82_/_0.7)] transition hover:bg-gold-soft disabled:opacity-50"
              >
                {loading
                  ? "A processar…"
                  : mode === "signin"
                    ? "Entrar no clube"
                    : "Criar conta MM Club"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs">
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-muted-foreground transition hover:text-foreground"
              >
                {mode === "signin"
                  ? "Ainda não tens conta? Criar conta →"
                  : "← Já tens conta? Entrar"}
              </button>
              <Link
                to="/quiz"
                className="text-primary hover:underline"
              >
                Fazer diagnóstico
              </Link>
            </div>

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
