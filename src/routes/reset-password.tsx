import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Definir nova palavra-passe — MM Club" },
      {
        name: "description",
        content:
          "Escolhe uma nova palavra-passe para voltares a entrar na tua conta MM Club.",
      },
      { property: "og:title", content: "Definir nova palavra-passe — MM Club" },
      {
        property: "og:description",
        content: "Recupera o acesso à tua conta MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The recovery link puts a session in place (hash or code exchange).
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A palavra-passe precisa de pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      toast.success("Palavra-passe atualizada.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Não foi possível atualizar.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">
          Definir nova palavra-passe
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ready
            ? "Escolhe a tua nova palavra-passe de acesso ao MM Club."
            : "A validar o link de recuperação…"}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
              Nova palavra-passe
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
              Confirmar
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !ready}
            className="group flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-50"
          >
            {loading ? "A guardar…" : "Guardar palavra-passe"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </form>
      </div>
    </main>
  );
}
