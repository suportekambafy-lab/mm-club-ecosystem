import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { commercialSession } from "@/lib/commercial/commercial.functions";
import { commercialDestination } from "@/lib/commercial/login-rules";
import { Button } from "@/components/ui/button";
import mmIcon from "@/assets/mm-icon.png.asset.json";

export const Route = createFileRoute("/comercial-login")({
  validateSearch: (search: Record<string, unknown>) => ({ redirect: commercialDestination(search.redirect) }),
  head: () => ({ meta: [
    { title: "Entrar — Equipa Comercial MM Club" },
    { name: "description", content: "Entrada reservada à equipa comercial MM Club." },
    { property: "og:title", content: "Entrar — Equipa Comercial MM Club" },
    { property: "og:description", content: "Acesso da equipa comercial às aplicações, vendas e membros MM Club." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: CommercialLogin,
});

function CommercialLogin() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkAccess = useServerFn(commercialSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => { if (active) setHasSession(Boolean(data.user)); });
    return () => { active = false; };
  }, []);

  async function enter(existing = false) {
    setLoading(true); setError(null); setNotice(null);
    try {
      if (!existing) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (authError || !data.session) { setError("Email ou palavra-passe incorretos, ou email ainda por confirmar."); return; }
        setHasSession(true);
      }
      try { await checkAccess(); }
      catch { setError("Esta conta não tem acesso à área comercial. Contacta o administrador."); return; }
      await navigate({ to: redirect, replace: true });
    } catch { setError("Não foi possível entrar. Tenta novamente."); }
    finally { setLoading(false); }
  }

  async function switchAccount() {
    setLoading(true); setError(null);
    try {
      await queryClient.cancelQueries(); queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setHasSession(false); setPassword("");
    } catch { setError("Não foi possível terminar a sessão. Tenta novamente."); }
    finally { setLoading(false); }
  }

  async function reset() {
    if (!email.trim()) { setError("Escreve o teu email primeiro."); return; }
    setLoading(true); setError(null); setNotice(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      setNotice("Se existir uma conta com esse email, receberás instruções para recuperar a palavra-passe.");
    } catch { setError("Não foi possível enviar as instruções. Tenta novamente mais tarde."); }
    finally { setLoading(false); }
  }

  return <div className="admin-shell commercial-shell min-h-screen bg-background text-foreground">
    <header className="flex items-center justify-between border-b border-border px-5 py-5 sm:px-10"><Link to="/" className="flex items-center gap-3"><img src={mmIcon.url} alt="" className="h-9 w-9" /><span className="text-lg font-semibold">MM Club</span></Link><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft />Voltar ao site</Link></Button></header>
    <main className="mx-auto w-full max-w-md px-6 py-16 sm:py-24">
      <p className="mb-4 text-xs font-medium text-commercial-accent">EQUIPA COMERCIAL</p><h1 className="commercial-page-heading">Entrar no comercial</h1>
      <p className="mt-3 text-sm text-muted-foreground">Acesso reservado a administradores, SDR e closers.</p>
      {hasSession ? <div className="mt-8 space-y-3"><Button disabled={loading} onClick={() => void enter(true)} className="h-12 w-full">{loading && <Loader2 className="animate-spin" />}Continuar no comercial<ArrowRight /></Button><Button variant="outline" disabled={loading} className="h-12 w-full" onClick={() => void switchAccount()}>Entrar com outra conta</Button></div> : <form className="mt-8 space-y-5" onSubmit={e => { e.preventDefault(); void enter(); }}>
        <label className="block text-sm font-medium">Email<div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-muted-foreground" /><input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} className="h-12 w-full rounded-md border border-border bg-card pl-10 pr-3 outline-none focus:ring-2 focus:ring-primary" /></div></label>
        <label className="block text-sm font-medium">Palavra-passe<div className="relative mt-2"><Lock className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-muted-foreground" /><input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} className="h-12 w-full rounded-md border border-border bg-card pl-10 pr-3 outline-none focus:ring-2 focus:ring-primary" /></div></label>
        <Button type="submit" disabled={loading} className="h-12 w-full">{loading && <Loader2 className="animate-spin" />}Entrar no comercial<ArrowRight /></Button>
        <Button type="button" variant="link" className="h-auto px-0 text-muted-foreground" disabled={loading} onClick={() => void reset()}>Esqueci-me da palavra-passe</Button>
      </form>}
      {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="mt-5 text-sm text-commercial-accent">{notice}</p>}
      <footer className="mt-12 border-t border-border pt-5 text-xs text-muted-foreground">MM Club · Equipa comercial</footer>
    </main>
  </div>;
}