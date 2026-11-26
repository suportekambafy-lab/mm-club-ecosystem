import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Lock, AlertCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MMLogo } from "@/components/mm/logo";
import { activateLegacyAccount } from "@/lib/legacy/legacy.functions";

export const Route = createFileRoute("/ativar")({
  head: () => ({
    meta: [
      { title: "Ativar acesso — MM Club" },
      { name: "description", content: "Compraste o Marca Milionária Legacy? Cria a tua palavra-passe e entra no MM Club." },
      { property: "og:title", content: "Ativar acesso — MM Club" },
      { property: "og:description", content: "Cria a tua palavra-passe e entra no MM Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AtivarPage,
});

function AtivarPage() {
  const navigate = useNavigate();
  const activate = useServerFn(activateLegacyAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A palavra-passe precisa de pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As palavras-passe não coincidem.");
    setLoading(true);
    try {
      const res = await activate({ data: { email, password } });
      if (!res.ok) return setError(res.error);
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signErr) return navigate({ to: "/auth" });
      navigate({ to: "/dashboard" });
    } catch {
      setError("Não foi possível ativar agora. Confirma os dados e tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-xl border border-border bg-surface-1 py-3.5 pl-11 pr-4 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-sm">
        <Link to="/" aria-label="MM Club"><MMLogo /></Link>
        <h1 className="mt-8 font-display text-4xl tracking-tight">Ativa o teu acesso.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Compraste o Marca Milionária Legacy? Usa o email da compra e escolhe a tua palavra-passe.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="relative block"><Mail className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input className={input} type="email" required placeholder="Email da compra" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="relative block"><Lock className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input className={input} type="password" required minLength={8} placeholder="Nova palavra-passe" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label className="relative block"><Lock className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input className={input} type="password" required minLength={8} placeholder="Repete a palavra-passe" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
          {error && <div role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {loading ? "A ativar…" : "Ativar e entrar"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">Já tens conta? <Link to="/auth" className="underline">Entra aqui</Link>.</p>
      </div>
    </div>
  );
}
