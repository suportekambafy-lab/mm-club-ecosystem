import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MousePointerClick, UserPlus, BadgeEuro, Clock } from "lucide-react";
import { getPartnerLeads } from "@/lib/partners-leads.functions";
import { MemberAvatar } from "@/components/mm/member-avatar";

export const Route = createFileRoute("/admin/partners-leads")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Leads do MM Partners — MM Admin" },
      {
        name: "description",
        content:
          "Nome, email e data de quem chegou pelos links do MM Partners e quem ainda não pagou.",
      },
      { property: "og:title", content: "Leads do MM Partners — MM Admin" },
      {
        property: "og:description",
        content: "Acompanha os leads dos parceiros e o estado de pagamento de cada um.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LeadsPage,
});

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

function Card({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof UserPlus;
}) {
  return (
    <div className="rounded-xl bg-admin-panel p-4">
      <div className="flex items-center gap-2 text-[12px] text-admin-muted">
        <Icon strokeWidth={1.6} className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-admin-fg">{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-admin-faint">{hint}</p> : null}
    </div>
  );
}

function LeadsPage() {
  const fn = useServerFn(getPartnerLeads);
  const q = useQuery({ queryKey: ["admin", "partner-leads"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState<"todos" | "pendentes" | "pagos">("pendentes");
  const [search, setSearch] = useState("");

  const leads = useMemo(() => {
    const rows = q.data?.leads ?? [];
    const term = search.trim().toLowerCase();
    return rows.filter((l) => {
      if (filter === "pagos" && !l.paid) return false;
      if (filter === "pendentes" && l.paid) return false;
      if (!term) return true;
      return (
        l.name.toLowerCase().includes(term) ||
        (l.email ?? "").toLowerCase().includes(term) ||
        l.code.toLowerCase().includes(term) ||
        l.partnerName.toLowerCase().includes(term)
      );
    });
  }, [q.data, filter, search]);

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-[13px] text-admin-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar leads…
      </div>
    );
  }
  if (q.isError) {
    return (
      <p className="p-6 text-[13px] text-admin-muted">Não foi possível carregar os leads.</p>
    );
  }

  const t = q.data!.totals;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-admin-fg">Leads do MM Partners</h1>
        <p className="mt-1 text-[13px] text-admin-muted">
          Quem chegou pelos links dos parceiros — nome, email, data e se já pagou.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Cliques nos links"
          value={String(t.clicks)}
          hint={`${t.uniqueVisitors} visitantes únicos`}
          icon={MousePointerClick}
        />
        <Card label="Contas criadas" value={String(t.signups)} icon={UserPlus} />
        <Card label="Já pagaram" value={String(t.paid)} icon={BadgeEuro} />
        <Card
          label="Ainda sem pagar"
          value={String(t.pending)}
          hint="Leads para acompanhar"
          icon={Clock}
        />
      </div>

      <section className="rounded-xl bg-admin-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-admin-border p-3">
          <div className="flex gap-1 rounded-lg bg-admin-hover/40 p-1 text-[13px]">
            {(
              [
                ["pendentes", "Sem pagar"],
                ["pagos", "Pagaram"],
                ["todos", "Todos"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={
                  filter === key
                    ? "rounded-md bg-admin-hover px-3 py-1.5 font-medium text-admin-fg"
                    : "rounded-md px-3 py-1.5 text-admin-muted transition hover:text-admin-fg"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por nome, email, código ou parceiro"
            className="min-w-[220px] flex-1 rounded-lg bg-admin-hover/40 px-3 py-2 text-[13px] text-admin-fg outline-none placeholder:text-admin-faint"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-admin-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Pessoa</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Parceiro</th>
                <th className="px-3 py-2 font-medium">Data de entrada</th>
                <th className="px-3 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-admin-border">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <MemberAvatar name={l.name} avatarUrl={l.avatarUrl} size={26} />
                      <span className="text-admin-fg">{l.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-admin-muted">{l.email ?? "—"}</td>
                  <td className="px-3 py-2 text-admin-muted">
                    {l.partnerName}
                    <span className="ml-1 text-admin-faint">({l.code})</span>
                  </td>
                  <td className="px-3 py-2 text-admin-muted">{when(l.createdAt)}</td>
                  <td className="px-3 py-2">
                    {l.paid ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[12px] text-emerald-400">
                        Pagou · {when(l.firstPaidAt)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[12px] text-amber-400">
                        {l.subscriptionStatus === "trialing"
                          ? "Em teste"
                          : l.subscriptionStatus
                            ? l.subscriptionStatus
                            : "Sem pagar"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-admin-muted">
                    Nenhum lead nesta vista.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-admin-panel">
        <div className="border-b border-admin-border p-3">
          <h2 className="text-[14px] font-medium text-admin-fg">Cliques sem conta</h2>
          <p className="mt-0.5 text-[12px] text-admin-faint">
            Visitas registadas nos links. Sem conta criada não há nome nem email — apenas a
            data e o parceiro que trouxe a visita.
          </p>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-admin-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Parceiro</th>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Visitante</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.clicks ?? []).map((c) => (
                <tr key={c.id} className="border-t border-admin-border">
                  <td className="px-3 py-2 text-admin-muted">{when(c.createdAt)}</td>
                  <td className="px-3 py-2 text-admin-fg">{c.partnerName}</td>
                  <td className="px-3 py-2 text-admin-muted">{c.code}</td>
                  <td className="px-3 py-2 text-admin-faint">{c.visitorKey ?? "—"}</td>
                </tr>
              ))}
              {(q.data?.clicks ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-admin-muted">
                    Ainda não há cliques registados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
