import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  addPaymentMethod,
  cancelSubscription,
  getBillingOverview,
  getCatalog,
  removePaymentMethod,
  resumeSubscription,
  setDefaultPaymentMethod,
  startCheckout,
  syncPaymentMethods,
  type BillingOverview,
  type CatalogView,
} from "@/lib/billing.functions";
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
  paused: "Pausada",
  cancelled: "Cancelada",
  canceled: "Cancelada",
  expired: "Expirada",
};

function SubscriptionPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [plans, setPlans] = useState<CatalogView[]>([]);
  const [showPlans, setShowPlans] = useState(false);

  const sub = overview?.subscription ?? null;
  const methods = (overview?.paymentMethods ?? []).filter(
    (m) => m.status !== "revoked",
  );

  const load = async () => {
    try {
      setOverview(await getBillingOverview({ data: undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar faturação.");
    } finally {
      setLoading(false);
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


  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocorreu um erro.");
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

  const onSelectPlan = async (priceSlug: string) => {
    setBusy(`plan-${priceSlug}`);
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

  /** Monthly-equivalent value, so yearly and monthly prices compare fairly. */
  const monthly = (amountCents: number, interval: string, count = 1) => {
    const months =
      (interval === "year" ? 12 : interval === "week" ? 0.25 : 1) * (count || 1);
    return amountCents / months;
  };

  const planOptions = plans
    .flatMap((p) =>
      p.prices.map((price) => ({
        productName: p.name,
        tagline: p.tagline,
        badge: p.badge,
        price,
      })),
    )
    .sort(
      (a, b) =>
        monthly(a.price.amountCents, a.price.interval, a.price.intervalCount) -
        monthly(b.price.amountCents, b.price.interval, b.price.intervalCount),
    );

  const currentMonthly = sub
    ? monthly(sub.amountCents, sub.interval)
    : null;

  const planSection = (
    <div className="grid gap-3 sm:grid-cols-2">
      {planOptions.map(({ productName, tagline, badge, price }) => {
        const isCurrent = sub?.priceSlug === price.slug;
        const value = monthly(
          price.amountCents,
          price.interval,
          price.intervalCount,
        );
        const change =
          currentMonthly === null || isCurrent
            ? null
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
                {productName}
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
              {price.displayLabel ?? tagline ?? "Acesso MM Club"}
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
          {/* Plano */}
          <section className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border">
            <div className="flex flex-wrap items-start justify-between gap-4 p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Plano atual
                </p>
                <p className="mt-2 font-display text-2xl text-foreground">
                  {sub.productName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatMoney(sub.amountCents, sub.currency)}
                  {sub.interval === "year"
                    ? " / ano"
                    : sub.interval === "month"
                      ? " / mês"
                      : ""}
                </p>
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
                        "Cancelamento agendado para o fim do período.",
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
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 ring-1 ring-border">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground">
                        {(m.brand ?? m.method ?? "Cartão").toString().toUpperCase()}
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
                      onClick={() =>
                        run(
                          `del-${m.id}`,
                          () => removePaymentMethod({ data: { paymentMethodId: m.id } }),
                          "Método removido.",
                        )
                      }
                      disabled={busy === `del-${m.id}`}
                      className="rounded-full p-2 text-muted-foreground transition hover:text-destructive disabled:opacity-60"
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
