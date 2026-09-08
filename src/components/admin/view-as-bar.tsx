import { useRouter } from "@tanstack/react-router";
import { Eye, X } from "lucide-react";
import { clearViewAs, type ViewAsTarget } from "@/lib/admin/view-as";

/** Barra fixa a lembrar o admin de que está a ver o clube como um membro. */
export function ViewAsBar({ target }: { target: ViewAsTarget }) {
  const router = useRouter();

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
      <Eye className="h-4 w-4 shrink-0 text-sky-500" />
      <p className="min-w-0 flex-1 text-sky-950 dark:text-sky-100">
        Estás a ver o clube como{" "}
        <strong className="font-semibold">{target.name}</strong>
        {target.email ? ` (${target.email})` : ""} —{" "}
        {target.hasAccess ? "conta com acesso" : "conta sem acesso"}
        {target.status ? `, ${target.status}` : ""}.
      </p>
      <button
        type="button"
        onClick={() => {
          clearViewAs();
          void router.invalidate();
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-400"
      >
        <X className="h-3.5 w-3.5" />
        Sair do modo cliente
      </button>
    </div>
  );
}
