import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMemberViewState } from "@/lib/admin/view-as.functions";
import { setViewAs } from "@/lib/admin/view-as";
import { cn } from "@/lib/utils";

/**
 * "Entrar como cliente": leva o admin ao painel a ver exactamente o que este
 * membro vê — sem sair da própria sessão.
 */
export function ViewAsButton({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const load = useServerFn(getMemberViewState);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      const state = await load({ data: { userId } });
      setViewAs(state);
      toast.success(`A ver o clube como ${state.name}`);
      await router.navigate({ to: "/dashboard" });
    } catch {
      toast.error("Não foi possível abrir a vista deste membro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={enter}
      disabled={busy}
      title="Ver o clube como este membro"
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
