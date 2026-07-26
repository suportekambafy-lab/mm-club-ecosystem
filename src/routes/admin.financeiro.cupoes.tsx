import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { day, money, Panel } from "@/components/admin/finance-ui";
import {
  createCoupon,
  listAdminCoupons,
  setCouponActive,
} from "@/lib/admin-finance.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro/cupoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cupões — MM Admin" },
      {
        name: "description",
        content:
          "Cupões do MM Club: utilizações, conversão, receita gerada, criação e desativação.",
      },
      { property: "og:title", content: "Cupões — MM Admin" },
      { property: "og:description", content: "Gestão de cupões do MM Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CouponsPage,
});

type FormState = {
  code: string;
  name: string;
  kind: "percent" | "amount" | "trial";
  value: string;
  duration: "once" | "repeating" | "forever";
  maxRedemptions: string;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  kind: "percent",
  value: "",
  duration: "once",
  maxRedemptions: "",
};

function CouponsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminCoupons);
  const create = useServerFn(createCoupon);
  const toggle = useServerFn(setCouponActive);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => list({ data: undefined as never }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const value = Number(form.value);
      if (!form.code.trim()) throw new Error("Indique um código.");
      if (!Number.isFinite(value) || value <= 0)
        throw new Error("Indique um valor válido.");
      return create({
        data: {
          code: form.code.trim(),
          name: form.name.trim() || null,
          percentOff: form.kind === "percent" ? value : null,
          amountOffCents:
            form.kind === "amount" ? Math.round(value * 100) : null,
          trialDaysOverride: form.kind === "trial" ? Math.round(value) : null,
          duration: form.duration,
          maxRedemptions: form.maxRedemptions
            ? Number(form.maxRedemptions)
            : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Cupão criado.");
      setForm(EMPTY);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      toggle({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" />
          Novo cupão
        </Button>
      </div>

      {open ? (
        <Panel title="Criar cupão">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Código</span>
              <input
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                maxLength={40}
                placeholder="MMVIP3"
                className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none ring-primary/40 focus:ring-2"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Nome interno</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={120}
                placeholder="Campanha de lançamento"
                className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none ring-primary/40 focus:ring-2"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Tipo</span>
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as FormState["kind"],
                  }))
                }
                className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none ring-primary/40 focus:ring-2"
              >
                <option value="percent">Desconto %</option>
                <option value="amount">Desconto em €</option>
                <option value="trial">Dias grátis</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">
                {form.kind === "percent"
                  ? "Percentagem"
                  : form.kind === "amount"
                    ? "Valor (€)"
                    : "Dias"}
              </span>
              <input
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                inputMode="decimal"
                className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none ring-primary/40 focus:ring-2"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Duração</span>
              <select
                value={form.duration}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    duration: e.target.value as FormState["duration"],
                  }))
                }
                className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none ring-primary/40 focus:ring-2"
              >
                <option value="once">Uma vez</option>
                <option value="repeating">Repetido</option>
                <option value="forever">Para sempre</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Limite de usos</span>
              <input
                value={form.maxRedemptions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxRedemptions: e.target.value }))
                }
                inputMode="numeric"
                placeholder="Sem limite"
                className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none ring-primary/40 focus:ring-2"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              Criar cupão
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </Panel>
      ) : null}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface-1" />
      ) : (data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface-1 p-6 text-sm text-muted-foreground">
          Ainda não existem cupões.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Benefício</th>
                <th className="px-4 py-3 text-right">Usos</th>
                <th className="px-4 py-3 text-right">Ativas</th>
                <th className="px-4 py-3 text-right">Conversão</th>
                <th className="px-4 py-3 text-right">Receita</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-mono font-medium">{c.code}</p>
                    {c.name ? (
                      <p className="text-xs text-muted-foreground">{c.name}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.percentOff != null
                      ? `${c.percentOff}% desconto`
                      : c.amountOffCents != null
                        ? `${money(c.amountOffCents)} desconto`
                        : c.trialDaysOverride != null
                          ? `${c.trialDaysOverride} dias grátis`
                          : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.redemptions}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.activeSubs}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.conversionRate == null
                      ? "—"
                      : `${(c.conversionRate * 100).toFixed(0)}%`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(c.revenueCents)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.validUntil ? `até ${day(c.validUntil)}` : "sem fim"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        toggleMutation.mutate({ id: c.id, active: !c.active })
                      }
                      className={cn(
                        "rounded-full px-3 py-1 text-xs ring-1 transition-colors",
                        c.active
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                          : "bg-muted text-muted-foreground ring-border",
                      )}
                    >
                      {c.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
