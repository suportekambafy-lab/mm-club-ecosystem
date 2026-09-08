import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startImpersonation } from "@/lib/admin/impersonate.functions";
import { saveAdminSession, setViewAs } from "@/lib/admin/view-as";
import { cn } from "@/lib/utils";

/**
 * "Entrar como cliente": abre a sessão real do membro (a do admin fica
 * guardada para regressar com um clique).
 */
export function ViewAsButton({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const start = useServerFn(startImpersonation);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      const ticket = await start({ data: { userId } });

      // Guardar a sessão do admin ANTES de trocar, para poder voltar.
      const { data: current } = await supabase.auth.getSession();
      if (current.session) {
        saveAdminSession({
          access_token: current.session.access_token,
          refresh_token: current.session.refresh_token,
        });
      }

      const { error } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: ticket.tokenHash,
      });
      if (error) throw error;

      setViewAs({
        userId: ticket.userId,
        name: ticket.name,
        email: ticket.email,
        hasAccess: false,
      });
      toast.success(`Sessão aberta como ${ticket.name}`);
      await router.navigate({ to: "/dashboard" });
      router.invalidate();
      window.location.reload();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível entrar na conta.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={enter}
      disabled={busy}
      title="Abrir a sessão deste membro"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs transition hover:border-primary hover:text-primary disabled:opacity-50",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Eye className="h-3.5 w-3.5" />
      )}
      Entrar como cliente
    </button>
  );
}
