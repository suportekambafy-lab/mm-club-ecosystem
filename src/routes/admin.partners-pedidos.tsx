import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  decidePartnerApplication,
  getPartnerApplications,
} from "@/lib/partners-admin.functions";
import { MemberAvatar } from "@/components/mm/member-avatar";

export const Route = createFileRoute("/admin/partners-pedidos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pedidos do MM Partners — MM Admin" },
      {
        name: "description",
        content: "Aprova ou recusa as candidaturas ao programa MM Partners.",
      },
      { property: "og:title", content: "Pedidos do MM Partners — MM Admin" },
      {
        property: "og:description",
        content: "Candidaturas ao MM Partners com estado de conta e decisão da equipa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ApplicationsPage,
});

const STATUS: Record<string, string> = {
  pending: "Em análise",
  active: "Aprovado",
  rejected: "Recusado",
};

const SUB_STATUS: Record<string, string> = {
  active: "Plano ativo",
  trialing: "Em teste",
  past_due: "Pagamento em falta",
  grace_period: "Pagamento em falta",
  suspended: "Suspenso",
  cancelled: "Cancelado",
  expired: "Expirado",
};

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ApplicationsPage() {
  const listFn = useServerFn(getPartnerApplications);
  const decideFn = useServerFn(decidePartnerApplication);
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const apps = useQuery({
    queryKey: ["admin-partner-applications"],
    queryFn: () => listFn({}),
  });

  const decide = useMutation({
    mutationFn: (v: { accountId: string; decision: "active" | "rejected" }) =>
      decideFn({
        data: { ...v, note: notes[v.accountId] ?? "" },
      }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "active" ? "Parceiro aprovado." : "Pedido recusado.");
      qc.invalidateQueries({ queryKey: ["admin-partner-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (apps.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-admin-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar pedidos…
      </div>
    );
  }

  const rows = apps.data?.rows ?? [];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-lg font-semibold text-admin-fg">Pedidos do MM Partners</h1>
        <p className="mt-1 text-sm text-admin-muted">
          A entrada é por aprovação. Contas suspensas ou com dívida não podem candidatar-se.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-admin-panel p-4">
          <div className="flex items-center gap-2 text-[12px] text-admin-muted">
            <Clock strokeWidth={1.6} className="h-4 w-4" /> Em análise
          </div>
          <p className="mt-2 text-2xl font-semibold text-admin-fg">{apps.data?.pending ?? 0}</p>
        </div>
        <div className="rounded-xl bg-admin-panel p-4">
          <div className="flex items-center gap-2 text-[12px] text-admin-muted">
            <Check strokeWidth={1.6} className="h-4 w-4" /> Aprovados
          </div>
          <p className="mt-2 text-2xl font-semibold text-admin-fg">
            {rows.filter((r) => r.status === "active").length}
          </p>
        </div>
        <div className="rounded-xl bg-admin-panel p-4">
          <div className="flex items-center gap-2 text-[12px] text-admin-muted">
            <UserPlus strokeWidth={1.6} className="h-4 w-4" /> Total de pedidos
          </div>
          <p className="mt-2 text-2xl font-semibold text-admin-fg">{rows.length}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-admin-panel p-6 text-sm text-admin-muted">
          Ainda não há candidaturas ao MM Partners.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl bg-admin-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <MemberAvatar name={r.name} avatarUrl={r.avatarUrl} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-admin-fg">{r.name}</p>
                    <p className="truncate text-xs text-admin-muted">{r.email ?? "—"}</p>
                    <p className="mt-1 text-xs text-admin-muted">
                      Pedido: {when(r.requestedAt)} · Código {r.code}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      r.status === "pending"
                        ? "bg-amber-500/15 text-amber-500"
                        : r.status === "active"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-red-500/15 text-red-500"
                    }`}
                  >
                    {STATUS[r.status] ?? r.status}
                  </span>
                  <span className="text-admin-muted">
                    {r.subscriptionStatus
                      ? (SUB_STATUS[r.subscriptionStatus] ?? r.subscriptionStatus)
                      : "Sem plano"}
                  </span>
                </div>
              </div>

              {r.note ? (
                <p className="mt-3 rounded-lg bg-black/20 p-3 text-sm text-admin-muted">
                  “{r.note}”
                </p>
              ) : null}

              {r.status === "pending" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="Nota da decisão (opcional)"
                    className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-admin-fg placeholder:text-admin-muted focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => decide.mutate({ accountId: r.id, decision: "active" })}
                    disabled={decide.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => decide.mutate({ accountId: r.id, decision: "rejected" })}
                    disabled={decide.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> Recusar
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-admin-muted">
                  Decidido {when(r.decidedAt)}
                  {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
