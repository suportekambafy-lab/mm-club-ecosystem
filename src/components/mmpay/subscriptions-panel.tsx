import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Repeat } from "lucide-react";
import { cancelMmpaySubscription, listMmpaySubscriptionCharges, listMmpaySubscriptions } from "@/lib/mmpay.functions";
import { intervalLabel, type BillingInterval } from "@/lib/mmpay/subscription-rules";
import { formatMoney } from "@/lib/billing/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
  active: { label: "Ativa", cls: "bg-primary/15 text-primary" },
  past_due: { label: "Em atraso", cls: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  completed: { label: "Concluída", cls: "bg-secondary text-secondary-foreground" },
};
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }) : "—");

export function MmpaySubscriptions() {
  const qc = useQueryClient();
  const subs = useQuery({ queryKey: ["mmpay-subs"], queryFn: () => listMmpaySubscriptions() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const open = subs.data?.find((s) => s.id === openId) ?? null;
  const charges = useQuery({
    queryKey: ["mmpay-sub-charges", openId],
    queryFn: () => listMmpaySubscriptionCharges({ data: { id: openId! } }),
    enabled: Boolean(openId),
  });
  const cancel = useMutation({
    mutationFn: () => cancelMmpaySubscription({ data: { id: openId!, reason: reason.trim() || null } }),
    onSuccess: () => {
      toast.success("Assinatura cancelada. Não haverá mais cobranças.");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["mmpay-subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section aria-label="Assinaturas">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Assinaturas</h2>
        <span className="text-sm text-muted-foreground">{subs.data?.length ?? 0}</span>
      </div>
      {subs.isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-surface-1" />
      ) : !subs.data?.length ? (
        <div className="border-y border-border py-12 text-center text-sm text-muted-foreground">
          <Repeat className="mx-auto mb-3 h-6 w-6" />
          Ainda não há assinaturas. Aparecem aqui depois do primeiro pagamento.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface-1">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Cliente", "Produto", "Valor", "Periodicidade", "Próxima", "Cobranças", "Duração", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.data.map((s) => (
                <tr key={s.id} onClick={() => setOpenId(s.id)} className="cursor-pointer border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-3"><p className="font-medium">{s.customer_name ?? "—"}</p><p className="text-xs text-muted-foreground">{s.customer_email}</p></td>
                  <td className="px-4 py-3">{s.product_title}</td>
                  <td className="px-4 py-3">
                    {s.total_amount_cents && s.total_cycles ? (
                      <>
                        <p>{formatMoney(s.total_amount_cents, s.currency)}</p>
                        <p className="text-xs text-muted-foreground">{s.total_cycles}x de {formatMoney(s.amount_cents, s.currency)}</p>
                      </>
                    ) : (
                      formatMoney(s.amount_cents, s.currency)
                    )}
                  </td>
                  <td className="px-4 py-3">{intervalLabel(s.billing_interval as BillingInterval, s.billing_interval_count)}</td>
                  <td className="px-4 py-3">{date(s.next_charge_at)}</td>
                  <td className="px-4 py-3">{s.charges_count}{s.total_cycles ? ` / ${s.total_cycles}` : ""}</td>
                  <td className="px-4 py-3">{s.total_cycles ? `${s.total_cycles} cobranças` : "Indeterminada"}</td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs", STATUS[s.status]?.cls)}>{STATUS[s.status]?.label ?? s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{open?.product_title}</DialogTitle></DialogHeader>
          {open ? (
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-3 text-muted-foreground">
                <p>Cliente: <span className="text-foreground">{open.customer_name ?? "—"} · {open.customer_email}{open.customer_phone ? ` · ${open.customer_phone}` : ""}</span></p>
                <p>Início: <span className="text-foreground">{date(open.started_at)}</span></p>
                <p>Última cobrança: <span className="text-foreground">{date(open.last_charge_at)}</span></p>
                <p>Próxima: <span className="text-foreground">{date(open.next_charge_at)}</span></p>
                {open.completed_at ? <p>Concluída: <span className="text-foreground">{date(open.completed_at)}</span></p> : null}
                {open.cancelled_at ? <p>Cancelada: <span className="text-foreground">{date(open.cancelled_at)}{open.cancel_reason ? ` — ${open.cancel_reason}` : ""}</span></p> : null}
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Histórico de cobranças</h3>
                {charges.isLoading ? <div className="h-16 animate-pulse rounded-xl bg-muted" /> : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {(charges.data ?? []).map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <span>Cobrança {c.cycle_number}{c.attempt > 1 ? ` (tentativa ${c.attempt})` : ""} · {date(c.finished_at ?? c.created_at)}</span>
                        <span className="flex items-center gap-2">
                          {formatMoney(c.amount_cents, "EUR")}
                          <span className={cn("rounded-full px-2 py-0.5 text-xs", c.status === "paid" ? "bg-primary/15 text-primary" : c.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted")}>
                            {c.status === "paid" ? "Paga" : c.status === "failed" ? "Falhou" : "Em curso"}
                          </span>
                        </span>
                        {c.error ? <p className="w-full text-xs text-destructive">{c.error}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {["pending", "active", "past_due"].includes(open.status) ? (
                <div className="space-y-2 border-t border-border pt-4">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Motivo do cancelamento (opcional)"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary" />
                  <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                    {cancel.isPending ? "A cancelar…" : "Cancelar assinatura"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
