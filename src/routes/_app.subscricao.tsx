import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PaymentBrandMark,
  paymentBrandLabel,
} from "@/components/mm/payment-brand";

import { cn } from "@/lib/utils";
import {
  addPaymentMethod,
  cancelSubscription,
  getBillingOverview,
  getCatalog,
  getInvoicePdf,
  getOutstandingBalance,
  listInvoices,
  removePaymentMethod,
  resumeSubscription,
  setDefaultPaymentMethod,
  startCheckout,
  syncPaymentMethods,
  type BillingOverview,
  type CatalogView,
  type InvoiceListItem,
  type OutstandingBalance,
} from "@/lib/billing.functions";
import { useViewAs } from "@/hooks/use-view-as";
import { formatMoney } from "@/lib/billing/types";


export const Route = createFileRoute("/_app/subscricao")({
  head: () => ({
    meta: [
      { title: "Gerir subscrição — MM Club" },
      {
        name: "description",
        content:
          "Gere o teu plano MM Club: métodos de pagamento, faturação, renovação e cancelamento.",
      },
      { property: "og:title", content: "Gerir subscrição — MM Club" },
      {
        property: "og:description",
        content: "Plano, métodos de pagamento e histórico de faturação do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionPage,
});

const dt = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Período de teste",
  past_due: "Pagamento em falta",
  grace_period: "Período de tolerância",
  suspended: "Suspensa (pagamento em falta)",
  paused: "Pausada",
  cancelled: "Cancelada",
  canceled: "Cancelada",
  expired: "Expirada",
};

function SubscriptionPage() {
  const navigate = useNavigate();
  // Um admin em modo "entrar como cliente" vê a faturação real desse membro.
  const viewAs = useViewAs();
  const viewAsUserId = viewAs?.userId ?? null;
  const [debt, setDebt] = useState<OutstandingBalance | null>(null);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [plans, setPlans] = useState<CatalogView[]>([]);
  const [showPlans, setShowPlans] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  const sub = overview?.subscription ?? null;
  const methods = (overview?.paymentMethods ?? []).filter(
    (m) => m.status !== "revoked",
  );

  const load = async () => {
    try {
      setOverview(await getBillingOverview({ data: { viewAsUserId } }));
      listInvoices({ data: { viewAsUserId } })
        .then(setInvoices)
        .catch(() => setInvoices([]));
      getOutstandingBalance({ data: { viewAsUserId } })
        .then(setDebt)
        .catch(() => setDebt(null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar faturação.");
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (inv: InvoiceListItem) => {
    setDownloading(inv.id);
    try {
      const { base64 } = await getInvoicePdf({ data: { invoiceId: inv.id } });
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.number ?? "fatura"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível gerar a fatura.",
      );
    } finally {
      setDownloading(null);
    }
  };



  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      // Returning from the gateway after adding a card.
      if (new URLSearchParams(window.location.search).get("pm") === "added") {
        await syncPaymentMethods({ data: undefined }).catch(() => {});
        setNotice("Método de pagamento adicionado.");
      }
      await load();
      const catalog = await getCatalog({
        data: { kinds: ["subscription"] },
      }).catch(() => [] as CatalogView[]);
      if (mounted) setPlans(catalog);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Ao entrar/sair do modo "ver como cliente", recarrega com a conta certa.
  useEffect(() => {
    if (!loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewAsUserId]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (ok) {
        setNotice(ok);
        toast.success(ok);
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ocorreu um erro.";
      setError(msg);
      toast.error(msg);
    } finally {

      setBusy(null);
    }
  };

  const onAddMethod = async () => {
    setBusy("add");
    setError(null);
    try {
      const { checkoutUrl } = await addPaymentMethod({
        data: { origin: window.location.origin, returnPath: "/subscricao?pm=added" },
      });
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível iniciar.");
      setBusy(null);
    }
  };

  const onSelectPlan = async (priceSlug: string, busyKey?: string) => {
    setBusy(busyKey ?? `plan-${priceSlug}`);
    setError(null);
    try {
      const { checkoutUrl } = await startCheckout({
        data: {
          priceSlug,
          origin: window.location.origin,
          successPath: "/subscricao",
        },
      });
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível mudar de plano.",
      );
      setBusy(null);
    }
  };

  /** Length of the commitment in months (mensal 1, semestral 6, anual 12). */
  const cycleMonths = (interval: string, count = 1) => {
    const base =
      interval === "year"
        ? 12
        : interval === "week"
          ? 0.25
          : interval === "day"
            ? 1 / 30
            : 1;
    return base * (count || 1);
  };

  /** Monthly-equivalent value, so yearly and monthly prices compare fairly. */
  const monthly = (amountCents: number, interval: string, count = 1) =>
    amountCents / cycleMonths(interval, count);

  const planOptions = plans
    .flatMap((p) =>
      p.prices.map((price) => ({
        productName: p.name,
        tagline: p.tagline,
        badge: p.badge,
        price,
      })),
    )
    // O teste VIP não é um plano — é um estado temporário que desaparece no
    // fim do período. Nunca aparece na lista de planos disponíveis.
    .filter(({ price }) => price.trialDays === 0)


    // Mensal → Semestral → Anual (compromisso mais curto primeiro).
    .sort((a, b) => {
      const diff =
        cycleMonths(a.price.interval, a.price.intervalCount) -
        cycleMonths(b.price.interval, b.price.intervalCount);
      return diff !== 0 ? diff : a.price.amountCents - b.price.amountCents;
    });

  // O plano atual pode ser semestral (mês × 6): usa o catálogo para saber
  // o ciclo real, já que a subscrição só guarda o intervalo base.
  const currentPrice =
    planOptions.find((o) => o.price.slug === sub?.priceSlug)?.price ?? null;
  const currentMonths = sub
    ? cycleMonths(
        currentPrice?.interval ?? sub.interval,
        currentPrice?.intervalCount ?? 1,
      )
    : null;
  const currentMonthly = sub
    ? monthly(
        sub.amountCents,
        currentPrice?.interval ?? sub.interval,
        currentPrice?.intervalCount ?? 1,
      )
    : null;


  const planSection = (
    <div className="grid gap-3 sm:grid-cols-2">
      {planOptions.map(({ productName, tagline, badge, price }) => {
        const isCurrent = sub?.priceSlug === price.slug;
        const months = cycleMonths(price.interval, price.intervalCount);
        const value = monthly(
          price.amountCents,
          price.interval,
          price.intervalCount,
        );
        // Um compromisso mais longo é sempre upgrade; só é downgrade quando o
        // ciclo é mais curto. Com o mesmo ciclo, decide o preço.
        const change =
          currentMonths === null || currentMonthly === null || isCurrent
            ? null
            : months > currentMonths
              ? "Upgrade"
              : months < currentMonths
                ? "Downgrade"
                : value > currentMonthly
                  ? "Upgrade"
                  : value < currentMonthly
                    ? "Downgrade"
                    : "Alterar ciclo";

        return (
          <div
            key={price.slug}
            className={cn(
              "flex flex-col rounded-2xl p-5 ring-1 transition",
              isCurrent
                ? "bg-primary/5 ring-primary/40"
                : "bg-surface-2 ring-border hover:ring-primary/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-lg text-foreground">
                {price.displayLabel ?? productName}
              </p>
              {isCurrent ? (
                <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-primary">
                  Plano atual
                </span>
              ) : change ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]",
                    change === "Upgrade"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-surface-3 text-muted-foreground",
                  )}
                >
                  {change}
                </span>
              ) : badge ? (
                <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {badge}
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              {months === 12
                ? "Anual"
                : months === 6
                  ? "Semestral"
                  : months === 1
                    ? "Mensal"
                    : (tagline ?? "Acesso MM Club")}
            </p>


            <p className="mt-4 text-xl text-foreground">
              {formatMoney(price.amountCents, price.currency)}
              <span className="text-sm text-muted-foreground">
                {price.interval === "year"
                  ? " / ano"
                  : price.interval === "month"
                    ? " / mês"
                    : ""}
              </span>
            </p>

            <button
              type="button"
              disabled={isCurrent || busy === `plan-${price.slug}`}
              onClick={() => onSelectPlan(price.slug)}
              className={cn(
                "mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition",
                isCurrent
                  ? "cursor-default bg-surface-3 text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-gold-soft disabled:opacity-60",
              )}
            >
              {busy === `plan-${price.slug}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {isCurrent ? "Estás neste plano" : (change ?? "Escolher plano")}
            </button>
          </div>
        );
      })}
    </div>
  );



  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-16">
      <header className="space-y-3">
        <Link
          to="/perfil"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao perfil
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-2xl text-foreground md:text-3xl">
            Gerir subscrição
          </h1>
          {sub ? (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em]",
                sub.status === "active" || sub.status === "trialing"
                  ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25"
                  : "bg-surface-2 text-muted-foreground ring-1 ring-border",
              )}
            >
              {STATUS_LABEL[sub.status] ?? sub.status}
            </span>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 ring-1 ring-emerald-500/20">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      ) : !sub ? (
        <section className="space-y-5 rounded-2xl bg-surface-1 p-6 ring-1 ring-border">
          <div>
            <p className="font-display text-lg text-foreground">Sem plano ativo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolhe um plano para desbloquear cursos, lives e ferramentas.
            </p>
          </div>
          {planSection}
        </section>

      ) : (
        <>
          {/* Dívida em aberto — o plano mantém-se, apenas está suspenso. */}
          {debt && debt.cycles > 0 ? (
            <section className="overflow-hidden rounded-2xl bg-amber-400/10 ring-1 ring-amber-400/40">
              <div className="flex flex-wrap items-start justify-between gap-4 p-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500">
                    Pagamento em falta
                  </p>
                  <p className="mt-2 font-display text-2xl text-foreground">
                    {formatMoney(debt.amountCents, debt.currency)} em dívida
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {debt.cycles === 1
                      ? "1 mensalidade em atraso"
                      : `${debt.cycles} mensalidades em atraso`}
                    {" · "}
                    {formatMoney(debt.cycleAmountCents, debt.currency)} cada
                    {debt.dueSince ? ` · desde ${dt(debt.dueSince)}` : ""}
                  </p>
                  {debt.nextIncreaseAt ? (
                    <p className="mt-1 text-xs text-amber-500">
                      Se não pagares, a dívida sobe para{" "}
                      {formatMoney(
                        debt.amountCents + debt.cycleAmountCents,
                        debt.currency,
                      )}{" "}
                      a {dt(debt.nextIncreaseAt)}.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy === "settle"}
                  onClick={() =>
                    onSelectPlan(debt.priceSlug ?? sub.priceSlug, "settle")
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {busy === "settle" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Pagar faturas pendentes
                </button>
              </div>
              {debt.unpaidInvoices.length > 0 ? (
                <ul className="border-t border-amber-400/30">
                  {debt.unpaidInvoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center gap-4 border-b border-amber-400/20 px-6 py-3 text-sm last:border-0"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {inv.number ?? "Fatura"}
                        <span className="text-muted-foreground">
                          {inv.issuedAt ? ` · ${dt(inv.issuedAt)}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-foreground">
                        {formatMoney(inv.totalCents, inv.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {/* Plano */}
          <section className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border">
            <div className="flex flex-wrap items-start justify-between gap-4 p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Plano atual
                </p>
                <p className="mt-2 font-display text-2xl text-foreground">
                  {currentPrice?.displayLabel ?? sub.productName}
                </p>

                {sub.status === "trialing" && sub.trialEnd ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Período de teste — termina a {dt(sub.trialEnd)}. No fim,
                    escolhes um plano para continuar.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatMoney(sub.amountCents, sub.currency)}
                    {sub.interval === "year"
                      ? " / ano"
                      : sub.interval === "month"
                        ? " / mês"
                        : ""}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowPlans((v) => !v)}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
              >
                {showPlans ? "Fechar planos" : "Mudar de plano"}
              </button>
            </div>

            {showPlans ? (
              <div className="space-y-4 border-t border-border p-6">
                <p className="text-xs text-muted-foreground">
                  Ao mudar de plano, a nova subscrição substitui a atual assim
                  que o pagamento for confirmado.
                </p>
                {planSection}
              </div>
            ) : null}

            <dl className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-3">
              <Cell
                label={sub.cancelAtPeriodEnd ? "Acesso termina em" : "Próxima renovação"}
                value={dt(sub.currentPeriodEnd)}
              />
              <Cell label="Início do período" value={dt(sub.currentPeriodStart)} />
              <Cell
                label="Cliente desde"
                value={dt(sub.createdAt)}
              />
            </dl>


            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-5">
              <p className="text-xs text-muted-foreground">
                {sub.cancelAtPeriodEnd
                  ? "O cancelamento está agendado — mantém acesso até ao fim do período."
                  : "Podes cancelar a qualquer momento; mantens acesso até ao fim do período pago."}
              </p>
              {sub.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={() =>
                    run(
                      "resume",
                      () => resumeSubscription({ data: { subscriptionId: sub.id } }),
                      "Subscrição reativada.",
                    )
                  }
                  disabled={busy === "resume"}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60"
                >
                  {busy === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Reativar plano
                </button>
              ) : confirmCancel ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    Manter plano
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      run(
                        "cancel",
                        () => cancelSubscription({ data: { subscriptionId: sub.id } }),
                        sub.status === "trialing"
                          ? "Período de teste cancelado. O acesso foi suspenso de imediato."
                          : "Cancelamento agendado para o fim do período.",
                      ).then(() => setConfirmCancel(false))
                    }
                    disabled={busy === "cancel"}
                    className="inline-flex items-center gap-2 rounded-full bg-destructive/15 px-5 py-2 text-sm font-medium text-destructive ring-1 ring-destructive/30 transition hover:bg-destructive/25 disabled:opacity-60"
                  >
                    {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Confirmar cancelamento
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="rounded-full px-4 py-2 text-sm text-muted-foreground ring-1 ring-border transition hover:text-foreground"
                >
                  Cancelar plano
                </button>
              )}
            </div>
          </section>

          {/* Métodos de pagamento */}
          <section className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border">
            <div className="flex flex-wrap items-center justify-between gap-3 p-6">
              <div>
                <h2 className="font-display text-lg text-foreground">
                  Métodos de pagamento
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  As renovações são cobradas no método predefinido.
                </p>
              </div>
              <button
                type="button"
                onClick={onAddMethod}
                disabled={busy === "add"}
                className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-sm text-foreground ring-1 ring-border transition hover:bg-surface-3 disabled:opacity-60"
              >
                {busy === "add" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Adicionar método
              </button>
            </div>

            {methods.length === 0 ? (
              <p className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
                Ainda não há métodos guardados.
              </p>
            ) : (
              <ul className="border-t border-border">
                {methods.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-4 last:border-0"
                  >
                    <PaymentBrandMark brand={m.brand} method={m.method} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground">
                        {paymentBrandLabel(m.brand, m.method)}
                        {m.last4 ? ` •••• ${m.last4}` : ""}
                      </span>

                      <span className="block text-xs text-muted-foreground">
                        {m.expMonth && m.expYear
                          ? `Válido até ${String(m.expMonth).padStart(2, "0")}/${m.expYear}`
                          : "Método guardado com segurança pelo gateway"}
                      </span>
                    </span>
                    {m.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary ring-1 ring-primary/20">
                        <Star className="h-3 w-3" /> Predefinido
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            `def-${m.id}`,
                            () =>
                              setDefaultPaymentMethod({
                                data: { paymentMethodId: m.id },
                              }),
                            "Método predefinido atualizado.",
                          )
                        }
                        disabled={busy === `def-${m.id}`}
                        className="rounded-full px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border transition hover:text-foreground disabled:opacity-60"
                      >
                        Tornar predefinido
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (methods.length <= 1) {
                          toast.error(
                            "Tens de manter pelo menos um método de pagamento. Adiciona outro antes de remover este.",
                          );
                          return;
                        }
                        void run(
                          `del-${m.id}`,
                          () => removePaymentMethod({ data: { paymentMethodId: m.id } }),
                          "Método removido.",
                        );
                      }}
                      disabled={busy === `del-${m.id}`}
                      title={
                        methods.length <= 1
                          ? "Tens de manter pelo menos um método de pagamento."
                          : "Remover método"
                      }
                      className={cn(
                        "rounded-full p-2 transition disabled:opacity-60",
                        methods.length <= 1
                          ? "cursor-not-allowed text-muted-foreground/40"
                          : "text-muted-foreground hover:text-destructive",
                      )}
                      aria-label="Remover método"
                    >
                      {busy === `del-${m.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>


                  </li>
                ))}
              </ul>
            )}

            <p className="flex items-center gap-2 border-t border-border px-6 py-3 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Os dados do cartão nunca passam pelo MM Club — são guardados pelo
              processador de pagamentos.
            </p>
          </section>

          {/* Faturas */}
          <section className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border">
            <div className="p-6">
              <h2 className="font-display text-lg text-foreground">Faturas</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Cada pagamento gera uma fatura/recibo em PDF.
              </p>
            </div>
            {invoices.length === 0 ? (
              <p className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
                Ainda não existem faturas.
              </p>
            ) : (
              <ul className="border-t border-border">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-0"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {inv.number ?? "Fatura"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {dt(inv.issuedAt)} · {inv.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-foreground">
                      {formatMoney(inv.totalCents, inv.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadInvoice(inv)}
                      disabled={downloading === inv.id}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition hover:bg-surface-2 disabled:opacity-50"
                    >
                      {downloading === inv.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      PDF
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Faturação */}
          <section className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border">
            <div className="p-6">
              <h2 className="font-display text-lg text-foreground">Histórico</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pagamentos, renovações e alterações à tua conta.
              </p>
            </div>
            {(overview?.timeline ?? []).length === 0 ? (
              <p className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
                Ainda sem movimentos.
              </p>
            ) : (
              <ul className="border-t border-border">
                {(overview?.timeline ?? []).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {t.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(t.occurredAt).toLocaleString("pt-PT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {t.description ? ` · ${t.description}` : ""}
                      </span>
                    </span>
                    {typeof t.amountCents === "number" ? (
                      <span className="shrink-0 text-sm tabular-nums text-foreground">
                        {formatMoney(t.amountCents, t.currency ?? "EUR")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-1 px-6 py-4">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
