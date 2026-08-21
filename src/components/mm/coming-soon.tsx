import { useEffect, useMemo, useState } from "react";
import { useTicker } from "@/hooks/use-ticker";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, Lock } from "lucide-react";
import { LAUNCH_LABEL, launchCountdown } from "@/lib/launch";

const ACCESS_PASSWORD = "VIPMCLUB";

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[68px] flex-col items-center rounded-2xl border border-white/12 bg-white/5 px-3 py-3 backdrop-blur sm:min-w-[84px]">
      <span
        className="text-3xl font-semibold tabular-nums text-white sm:text-4xl"
        style={{ fontFamily: "Syne, ui-sans-serif" }}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.22em] text-white/50">{label}</span>
    </div>
  );
}

function LaunchCountdown() {
  const now = useTicker(1000);
  const t = useMemo(() => launchCountdown(new Date(now)), [now]);

  if (t.isOpen) {
    return (
      <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-semibold text-primary">
        As portas estão abertas — verifica o teu email.
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-[0.28em] text-primary/90">
        Abertura ao público · {LAUNCH_LABEL}
      </span>
      <div className="mt-4 flex items-center gap-2 sm:gap-3">
        <CountdownUnit value={t.days} label="Dias" />
        <CountdownUnit value={t.hours} label="Horas" />
        <CountdownUnit value={t.minutes} label="Min" />
        <CountdownUnit value={t.seconds} label="Seg" />
      </div>
    </div>
  );
}


export function ComingSoon() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState<string | null>(null);

  function onPassSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pass === ACCESS_PASSWORD) {
      window.localStorage.setItem("mm_bypass", "1");
      window.location.reload();
      return;
    }
    setPassError("Senha incorreta.");
  }


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

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      <style>{`
        @keyframes mmAurora {
          0%,100% { transform: translate3d(-6%, -4%, 0) scale(1); opacity: .75; }
          50%     { transform: translate3d(6%, 4%, 0) scale(1.15); opacity: 1; }
        }
        @keyframes mmAurora2 {
          0%,100% { transform: translate3d(5%, 6%, 0) scale(1.1); opacity: .7; }
          50%     { transform: translate3d(-5%, -6%, 0) scale(1); opacity: .95; }
        }
        @keyframes mmSheen {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes mmFloat {
          0%   { transform: translateY(100vh) translateX(0); opacity: 0; }
          10%  { opacity: .9; }
          90%  { opacity: .9; }
          100% { transform: translateY(-10vh) translateX(20px); opacity: 0; }
        }
        @keyframes mmPulseRing {
          0%   { transform: scale(0.6); opacity: .6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes mmGridDrift {
          0%   { background-position: 0 0; }
          100% { background-position: 60px 60px; }
        }
      `}</style>

      {/* Animated aurora blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, oklch(0.82 0.13 82 / 0.45), transparent 65%)",
          animation: "mmAurora 12s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-1/3 left-1/2 h-[90vh] w-[90vh] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, oklch(0.35 0.08 60 / 0.55), transparent 60%)",
          animation: "mmAurora2 14s ease-in-out infinite",
        }}
      />

      {/* Drifting grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.82 0.13 82) 1px, transparent 1px), linear-gradient(90deg, oklch(0.82 0.13 82) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          animation: "mmGridDrift 18s linear infinite",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* Floating particles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => {
          const left = (i * 53) % 100;
          const delay = (i * 0.7) % 12;
          const dur = 10 + ((i * 1.3) % 10);
          const size = 2 + (i % 3);
          return (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${left}%`,
                bottom: `-10vh`,
                width: size,
                height: size,
                background: "oklch(0.92 0.14 88)",
                boxShadow: "0 0 12px oklch(0.82 0.13 82 / 0.9)",
                animation: `mmFloat ${dur}s linear ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>

      {/* Top sheen line */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div
          className="h-full w-1/2"
          style={{
            background: "linear-gradient(90deg, transparent, oklch(0.82 0.13 82 / 0.9), transparent)",
            animation: "mmSheen 5s ease-in-out infinite",
          }}
        />
      </div>


      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="relative inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85 backdrop-blur animate-fade-in">
          <span
            aria-hidden
            className="absolute -left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
            style={{ boxShadow: "0 0 0 0 oklch(0.82 0.13 82 / 0.7)", animation: "mmPulseRing 2s ease-out infinite" }}
          />
          <span className="ml-3">MM Club · Em breve</span>
        </span>


        <h1
          className="mt-8 font-display text-5xl leading-[0.95] tracking-tight md:text-7xl"
          style={{ fontFamily: "Syne, ui-sans-serif" }}
        >
          Algo grande está{" "}
          <span
            style={{
              background: "linear-gradient(135deg, oklch(0.92 0.14 88), oklch(0.65 0.14 70))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            a caminho
          </span>
          .
        </h1>

        <p className="mt-6 max-w-xl text-base text-white/70 md:text-lg">
          O ecossistema privado da Marca Milionária abre ao público a {LAUNCH_LABEL}.
          Deixa o teu email e recebes o acesso mal abrirmos.
        </p>

        <LaunchCountdown />



        {status === "done" ? (
          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-primary/40 bg-primary/10 px-6 py-3 text-sm text-primary">
            <Check className="h-4 w-4" />
            Estás na lista. Vamos avisar-te.
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row"
          >
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
              Avisar-me
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {showPass ? (
          <form onSubmit={onPassSubmit} className="mt-8 flex w-full max-w-sm flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoFocus
              value={pass}
              onChange={(e) => { setPass(e.target.value); setPassError(null); }}
              placeholder="Senha de acesso"
              className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/40 outline-none backdrop-blur focus:border-primary/60"
            />
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/20">
              Entrar
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowPass(true)}
            className="mt-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/60 hover:text-white"
          >
            <Lock className="h-3 w-3" /> Entrar com senha
          </button>
        )}
        {passError && <p className="mt-2 text-xs text-red-400">{passError}</p>}

        <p className="mt-14 text-[10px] uppercase tracking-[0.28em] text-white/40">
          © Marca Milionária
        </p>

      </main>
    </div>
  );
}
