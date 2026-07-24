import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, Users, Calendar, GraduationCap, Wrench, Sparkles, ArrowRight } from "lucide-react";
import mmEvent from "@/assets/mm-event.jpg";

// Launch date — ajusta conforme necessário
const LAUNCH_DATE = new Date("2026-09-01T10:00:00Z");

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds, done: diff === 0 };
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Insere um email válido.");
      return;
    }
    setStatus("loading");
    setError(null);
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: email.trim().toLowerCase(), source: typeof window !== "undefined" ? window.location.hostname : null });
    if (error && !/duplicate|unique/i.test(error.message)) {
      setStatus("error");
      setError("Não foi possível registar. Tenta novamente.");
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-primary/40 bg-primary/10 px-6 py-3 text-sm text-primary">
        <Check className="h-4 w-4" />
        Estás na lista. Vamos avisar-te em primeira mão.
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="o.teu@email.com"
          className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/40 outline-none backdrop-blur transition focus:border-primary/60 focus:bg-white/10"
          autoComplete="email"
          inputMode="email"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82/0.7)] transition hover:opacity-90 disabled:opacity-60"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Quero acesso antecipado
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <p className="mt-4 text-[11px] text-white/45">
        Os primeiros membros terão condições exclusivas de lançamento.
      </p>
    </>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur min-w-[76px]">
      <span className="font-display text-3xl leading-none tracking-tight text-white md:text-4xl" style={{ fontFamily: "Syne, ui-sans-serif" }}>
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.28em] text-white/50">{label}</span>
    </div>
  );
}

const PILLARS = [
  { icon: Users, title: "Comunidade", desc: "Rede privada de empreendedores digitais em crescimento contínuo." },
  { icon: Calendar, title: "Eventos", desc: "MM Sessions e MM Summit — encontros presenciais para conectar e escalar." },
  { icon: GraduationCap, title: "Academia", desc: "Formação prática com casos reais, do zero ao 7 dígitos." },
  { icon: Wrench, title: "Ferramentas", desc: "MM Studio, MM Intelligence e ferramentas exclusivas para membros." },
  { icon: Sparkles, title: "Mentoria", desc: "Acesso direto a mentores que já construíram marcas de referência." },
];

export function ComingSoon() {
  const c = useCountdown(LAUNCH_DATE);
  const benefits = useMemo(() => ["Comunidade privada", "Eventos exclusivos", "Networking e crescimento"], []);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      <style>{`
        @keyframes mmAurora { 0%,100% { transform: translate3d(-6%, -4%, 0) scale(1); opacity: .75; } 50% { transform: translate3d(6%, 4%, 0) scale(1.15); opacity: 1; } }
        @keyframes mmAurora2 { 0%,100% { transform: translate3d(5%, 6%, 0) scale(1.1); opacity: .7; } 50% { transform: translate3d(-5%, -6%, 0) scale(1); opacity: .95; } }
        @keyframes mmSheen { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes mmFloat { 0% { transform: translateY(100vh) translateX(0); opacity: 0; } 10% { opacity: .9; } 90% { opacity: .9; } 100% { transform: translateY(-10vh) translateX(20px); opacity: 0; } }
        @keyframes mmPulseRing { 0% { transform: scale(0.6); opacity: .6; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes mmGridDrift { 0% { background-position: 0 0; } 100% { background-position: 60px 60px; } }
        @keyframes mmRise { 0% { opacity: 0; transform: translateY(24px); } 100% { opacity: 1; transform: translateY(0); } }
        .mm-rise { animation: mmRise .8s ease-out both; }
      `}</style>

      {/* Ambient background (hero) */}
      <div aria-hidden className="pointer-events-none absolute -top-1/3 left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, oklch(0.82 0.13 82 / 0.45), transparent 65%)", animation: "mmAurora 12s ease-in-out infinite" }} />
      <div aria-hidden className="pointer-events-none absolute top-[40vh] left-1/2 h-[90vh] w-[90vh] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, oklch(0.35 0.08 60 / 0.55), transparent 60%)", animation: "mmAurora2 14s ease-in-out infinite" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(oklch(0.82 0.13 82) 1px, transparent 1px), linear-gradient(90deg, oklch(0.82 0.13 82) 1px, transparent 1px)", backgroundSize: "60px 60px", animation: "mmGridDrift 18s linear infinite", maskImage: "radial-gradient(ellipse at center top, black 20%, transparent 65%)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => {
          const left = (i * 53) % 100;
          const delay = (i * 0.7) % 12;
          const dur = 10 + ((i * 1.3) % 10);
          const size = 2 + (i % 3);
          return (
            <span key={i} className="absolute rounded-full" style={{ left: `${left}%`, bottom: `-10vh`, width: size, height: size, background: "oklch(0.92 0.14 88)", boxShadow: "0 0 12px oklch(0.82 0.13 82 / 0.9)", animation: `mmFloat ${dur}s linear ${delay}s infinite` }} />
          );
        })}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="h-full w-1/2" style={{ background: "linear-gradient(90deg, transparent, oklch(0.82 0.13 82 / 0.9), transparent)", animation: "mmSheen 5s ease-in-out infinite" }} />
      </div>

      {/* HERO */}
      <section className="relative z-10 mx-auto flex min-h-[100dvh] max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="relative inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85 backdrop-blur mm-rise">
          <span aria-hidden className="absolute -left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" style={{ boxShadow: "0 0 0 0 oklch(0.82 0.13 82 / 0.7)", animation: "mmPulseRing 2s ease-out infinite" }} />
          <span className="ml-3">MM Club · Lista de espera aberta</span>
        </span>

        <h1 className="mt-8 font-display text-5xl leading-[0.95] tracking-tight md:text-7xl mm-rise" style={{ fontFamily: "Syne, ui-sans-serif", animationDelay: ".05s" }}>
          O ecossistema privado para construir uma{" "}
          <span style={{ background: "linear-gradient(135deg, oklch(0.92 0.14 88), oklch(0.65 0.14 70))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Marca Milionária
          </span>
          .
        </h1>

        <p className="mt-6 max-w-2xl text-base text-white/70 md:text-lg mm-rise" style={{ animationDelay: ".15s" }}>
          Comunidade exclusiva, networking, eventos presenciais, formação prática e ferramentas
          para acelerar o crescimento do teu negócio. Deixa o teu email e sê dos primeiros a entrar.
        </p>

        {/* Quick benefits */}
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/75 mm-rise" style={{ animationDelay: ".25s" }}>
          {benefits.map((b) => (
            <li key={b} className="inline-flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary" />
              {b}
            </li>
          ))}
        </ul>

        <div className="mm-rise" style={{ animationDelay: ".35s" }}>
          <WaitlistForm />
        </div>

        {/* Countdown */}
        <div className="mt-12 mm-rise" style={{ animationDelay: ".5s" }}>
          <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-white/45">Abre em</p>
          <div className="flex items-center justify-center gap-2 md:gap-3">
            <CountdownUnit value={c.days} label="Dias" />
            <CountdownUnit value={c.hours} label="Horas" />
            <CountdownUnit value={c.minutes} label="Min" />
            <CountdownUnit value={c.seconds} label="Seg" />
          </div>
        </div>

        <p className="mt-10 text-[11px] uppercase tracking-[0.28em] text-white/45">
          Junta-te a milhares de empreendedores no ecossistema Marca Milionária.
        </p>
      </section>

      {/* IMAGE — evento */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          <img
            src={mmEvent}
            alt="MM Summit — auditório premium com empreendedores"
            width={1600}
            height={1000}
            loading="lazy"
            className="h-[52vh] w-full object-cover md:h-[68vh]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
            <p className="text-[10px] uppercase tracking-[0.28em] text-primary/90">MM Summit · MM Sessions</p>
            <h2 className="mt-2 max-w-2xl font-display text-3xl leading-tight tracking-tight md:text-5xl" style={{ fontFamily: "Syne, ui-sans-serif" }}>
              Onde os empreendedores se encontram para crescer.
            </h2>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-12 max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">O que vais receber</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight md:text-5xl" style={{ fontFamily: "Syne, ui-sans-serif" }}>
            Um ecossistema desenhado para acelerar o teu negócio.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition hover:border-primary/40 hover:bg-white/[0.06]">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-xl tracking-tight" style={{ fontFamily: "Syne, ui-sans-serif" }}>{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{desc}</p>
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition group-hover:opacity-100" style={{ background: "radial-gradient(circle, oklch(0.82 0.13 82 / 0.35), transparent 70%)" }} />
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-28 text-center">
        <div className="rounded-3xl border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent p-10 backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.28em] text-primary/90">Acesso antecipado</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight md:text-5xl" style={{ fontFamily: "Syne, ui-sans-serif" }}>
            Reserva o teu lugar no MM Club.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/70">
            Os primeiros membros recebem condições exclusivas de lançamento e prioridade
            nos próximos eventos presenciais.
          </p>
          <div className="mt-6 flex justify-center">
            <WaitlistForm />
          </div>
        </div>

        <p className="mt-14 text-[10px] uppercase tracking-[0.28em] text-white/40">
          © Marca Milionária
        </p>
      </section>
    </div>
  );
}
