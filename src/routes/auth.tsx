import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MMLogo } from "@/components/mm/logo";
import { toast } from "sonner";

type Search = { redirect?: string };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — MM Club" },
      { name: "description", content: "Entre na comunidade MM Club." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/comunidade" });
    });
  }, [navigate, redirect]);

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
      navigate({ to: redirect ?? "/comunidade" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <MMLogo />
        </div>
        <div className="rounded-2xl border border-border bg-surface-1 p-8">
          <h1 className="font-display text-2xl text-foreground">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Bem-vindo de volta ao clube."
              : "Junte-se à comunidade MM Club."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-50"
            >
              {loading ? "A processar…" : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? "Ainda não tens conta? Criar conta"
              : "Já tens conta? Entrar"}
          </button>
        </div>

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link to="/" className="hover:text-foreground">Início</Link>
            <Link to="/checkout" className="hover:text-foreground">Planos</Link>
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/reembolsos" className="hover:text-foreground">Reembolsos</Link>
            <a href="mailto:geral@mmclub.pt" className="hover:text-foreground">Contacto</a>
          </nav>
          <p className="mt-3">© {new Date().getFullYear()} MMClub</p>
        </footer>
      </div>
    </div>
  );
}
