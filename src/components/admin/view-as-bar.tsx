import { useState } from "react";
import { Eye, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  clearViewAs,
  takeAdminSession,
  type ViewAsTarget,
} from "@/lib/admin/view-as";

/** Barra fixa a lembrar o admin de que está dentro da conta de um membro. */
export function ViewAsBar({ target }: { target: ViewAsTarget }) {
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    try {
      const admin = takeAdminSession();
      clearViewAs();
      if (admin) {
        const { error } = await supabase.auth.setSession(admin);
        if (error) throw error;
        window.location.href = "/admin/financeiro/subscricoes";
        return;
      }
      // Sem sessão guardada, sai por completo.
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch {
      toast.error("Não foi possível voltar à tua conta. Faz login novamente.");
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
      <Eye className="h-4 w-4 shrink-0 text-sky-500" />
      <p className="min-w-0 flex-1 text-sky-950 dark:text-sky-100">
        Estás dentro da conta de{" "}
        <strong className="font-semibold">{target.name}</strong>
        {target.email ? ` (${target.email})` : ""}
        {target.status ? ` · ${STATUS_PT[target.status] ?? target.status}` : ""}
        {target.hasAccess ? " · com acesso" : ""}. Tudo o que fizeres é como
        este membro.
      </p>

      <button
        type="button"
        onClick={leave}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
        Voltar à minha conta
      </button>
    </div>
  );
}
