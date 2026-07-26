import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { money, Panel } from "@/components/admin/finance-ui";
import {
  listAdminCatalog,
  setPriceActive,
  setProductActive,
} from "@/lib/admin-finance.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro/catalogo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Catálogo — MM Admin" },
      {
        name: "description",
        content:
          "Produtos, preços versionados e funcionalidades incluídas no catálogo do MM Club.",
      },
      { property: "og:title", content: "Catálogo — MM Admin" },
      {
        property: "og:description",
        content: "Gestão de produtos e preços do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CatalogPage,
});

function Toggle({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs ring-1 transition-colors",
        active
          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
          : "bg-muted text-muted-foreground ring-border",
      )}
    >
      {active ? "Ativo" : "Inativo"}
    </button>
  );
}

function CatalogPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminCatalog);
  const toggleProduct = useServerFn(setProductActive);
  const togglePrice = useServerFn(setPriceActive);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-catalog"],
    queryFn: () => list({ data: undefined as never }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-catalog"] });
  const productMutation = useMutation({
    mutationFn: (i: { id: string; active: boolean }) => toggleProduct({ data: i }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const priceMutation = useMutation({
    mutationFn: (i: { id: string; active: boolean }) => togglePrice({ data: i }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-2xl border border-border bg-surface-1"
          />
        ))}
      </div>
    );

  return (
    <div className="space-y-4">
      {(data ?? []).map((p) => (
        <Panel
          key={p.id}
          title={`${p.name} · ${p.kind}`}
          action={
            <Toggle
              active={p.active}
              onClick={() =>
                productMutation.mutate({ id: p.id, active: !p.active })
              }
            />
          }
        >
          {p.tagline ? (
            <p className="mb-3 text-sm text-muted-foreground">{p.tagline}</p>
          ) : null}

          {p.features.length ? (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {p.features.map((f) => (
                <span
                  key={f.key}
                  className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border"
                >
                  {f.key}
                  {f.quota != null ? ` · ${f.quota}` : ""}
                </span>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Preço</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-left">Intervalo</th>
                  <th className="px-3 py-2 text-right">Trial</th>
                  <th className="px-3 py-2 text-right">Créditos</th>
                  <th className="px-3 py-2 text-right">Subs ativas</th>
                  <th className="px-3 py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {p.prices.map((pr) => (
                  <tr key={pr.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-mono text-xs">{pr.slug}</p>
                      <p className="text-[11px] text-muted-foreground">
                        v{pr.version}
                        {pr.displayLabel ? ` · ${pr.displayLabel}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(pr.amountCents, pr.currency)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {pr.intervalCount > 1 ? `${pr.intervalCount} × ` : ""}
                      {pr.interval}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pr.trialDays || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pr.grantsCredits || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pr.activeSubs}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Toggle
                        active={pr.active}
                        onClick={() =>
                          priceMutation.mutate({
                            id: pr.id,
                            active: !pr.active,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
      {(data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface-1 p-6 text-sm text-muted-foreground">
          Catálogo vazio.
        </p>
      ) : null}
    </div>
  );
}
