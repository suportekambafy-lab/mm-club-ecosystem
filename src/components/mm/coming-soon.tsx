import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check } from "lucide-react";

export function ComingSoon() {
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

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 20%, oklch(0.82 0.13 82 / 0.28), transparent 60%), radial-gradient(ellipse 80% 60% at 50% 100%, oklch(0.35 0.08 60 / 0.35), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, oklch(0.82 0.13 82 / 0.6), transparent)" }}
      />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85 backdrop-blur">
          MM Club · Em breve
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
          O ecossistema privado da Marca Milionária está a ser finalizado. Deixa o teu email
          e serás dos primeiros a receber acesso quando abrirmos.
        </p>

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

        <p className="mt-14 text-[10px] uppercase tracking-[0.28em] text-white/40">
          © Marca Milionária
        </p>
      </main>
    </div>
  );
}
