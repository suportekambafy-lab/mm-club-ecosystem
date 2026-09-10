import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeEuro,
  Check,
  Copy,
  Gift,
  Handshake,
  Loader2,
  Share2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPartnerDashboard,
  joinPartners,
  requestPartnerPayout,
  savePartnerPayoutDetails,
} from "@/lib/partners.functions";

export const Route = createFileRoute("/_app/parceiros")({
  head: () => ({
    meta: [
      { title: "MM Partners — ganha com quem trazes" },
      {
        name: "description",
        content:
          "Partilha o teu link MM Partners: com 3 indicados a pagar tens o MM Club Start grátis e, a partir do 4.º, ganhas 5 € por cada indicado.",
      },
      { property: "og:title", content: "MM Partners — ganha com quem trazes" },
      {
        property: "og:description",
        content:
          "3 indicados a pagar = MM Club Start grátis. Do 4.º em diante, 5 € por cada indicado pago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnersPage,
});

function money(cents: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
}

const STATUS_LABEL: Record<string, string> = {
  paid: "A pagar",
  trial: "Em teste",
  pending: "Sem plano",
  lapsed: "Deixou de pagar",
};

const PAYOUT_STATUS: Record<string, string> = {
  requested: "Em análise",
  paid: "Pago",
  rejected: "Recusado",
};

function PartnersPage() {
  const dashFn = useServerFn(getPartnerDashboard);
  const joinFn = useServerFn(joinPartners);
  const saveFn = useServerFn(savePartnerPayoutDetails);
  const payoutFn = useServerFn(requestPartnerPayout);
  const qc = useQueryClient();

  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const dash = useQuery({
    queryKey: ["mm-partners", origin],
    queryFn: () => dashFn({ data: { origin } }),
    enabled: origin !== null,
  });

  const data = dash.data;
  const [method, setMethod] = useState<"iban" | "mbway">("iban");
  const [target, setTarget] = useState("");
  const [holder, setHolder] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data?.joined) return;
    setMethod((data.payout.method === "mbway" ? "mbway" : "iban") as "iban" | "mbway");
    setTarget(data.payout.target ?? "");
    setHolder(data.payout.holder ?? "");
  }, [data?.joined, data?.payout.method, data?.payout.target, data?.payout.holder]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["mm-partners"] });

  const join = useMutation({
    mutationFn: () => joinFn({ data: { origin } }),
    onSuccess: () => {
      toast.success("Bem-vindo ao MM Partners. O teu link já está pronto.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePayout = useMutation({
    mutationFn: () => saveFn({ data: { method, target, holder } }),
    onSuccess: () => {
      toast.success("Dados de pagamento guardados.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const askPayout = useMutation({
    mutationFn: () => payoutFn({}),
    onSuccess: (res) => {
      toast.success(`Pedido enviado: ${money(res.amountCents)}. Pagamos em poucos dias.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const progress = useMemo(() => {
    const active = Math.min(data?.activeCount ?? 0, 3);
    return { active, missing: Math.max(0, 3 - active), pct: (active / 3) * 100 };
  }, [data?.activeCount]);

  async function copyLink() {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Seleciona o link à mão.");
    }
  }

  async function shareLink() {
    if (!data?.link) return;
    const text = `Entra no MM Club comigo e começa a construir a tua marca: ${data.link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "MM Club", text, url: data.link });
        return;
      } catch {
        /* cancelado */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  if (dash.isLoading || origin === null) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
      </div>
    );
  }

  if (!data?.joined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <div className="surface-card rounded-2xl p-6 md:p-10">
          <Handshake className="h-8 w-8 text-primary" strokeWidth={1.6} />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">MM Partners</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Traz pessoas para o clube com o teu link pessoal e sê recompensado por isso.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <Gift className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <strong>3 indicados a pagar</strong> ao mesmo tempo: o teu MM Club Start fica
                grátis enquanto eles se mantiverem ativos.
              </span>
            </li>
            <li className="flex gap-3">
              <BadgeEuro className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <strong>A partir do 4.º</strong> indicado pago: ganhas <strong>5 €</strong> por
                cada um, uma única vez.
              </span>
            </li>
            <li className="flex gap-3">
              <Wallet className="mt-0.5 h-4 w-4 text-primary" />
              <span>Retiras o saldo quando quiseres, por IBAN ou MB Way, a partir de 25 €.</span>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => join.mutate()}
            disabled={join.isPending}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {join.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Quero o meu link
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            Ao entrares, aceitas que só contam contas reais com plano pago. Indicações a ti mesmo
            não contam.
          </p>
        </div>
      </div>
    );
  }

  const pendingPayout = data.payouts.find((p) => p.status === "requested");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">MM Partners</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Partilha o teu link, acompanha quem entrou e recebe as tuas recompensas.
        </p>
      </header>

      <section className="surface-card rounded-2xl p-5 md:p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">O teu link</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-xl bg-muted px-4 py-3 text-sm">
            {data.link}
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm transition hover:bg-muted"
            >
              <Share2 className="h-4 w-4" />
              Partilhar
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Código: <strong>{data.code}</strong>
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="A pagar agora" value={String(data.activeCount)} icon={Users} />
        <Stat label="Total de indicados" value={String(data.totalCount)} icon={Handshake} />
        <Stat label="Saldo disponível" value={money(data.balanceCents)} icon={Wallet} />
        <Stat label="Já recebido" value={money(data.paidOutCents)} icon={BadgeEuro} />
      </section>

      <section className="surface-card rounded-2xl p-5 md:p-6">
        {data.freeBenefitActive ? (
          <p className="text-sm">
            <strong className="text-primary">MM Club Start grátis ativo.</strong> Tens{" "}
            {data.activeCount} indicados a pagar. Enquanto forem 3 ou mais, o valor do Start volta
            para o teu saldo todos os meses.
          </p>
        ) : (
          <p className="text-sm">
            Faltam <strong>{progress.missing}</strong>{" "}
            {progress.missing === 1 ? "indicado" : "indicados"} a pagar para teres o{" "}
            <strong>MM Club Start grátis</strong>.
          </p>
        )}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {progress.active}/3 · a partir do 4.º indicado pago ganhas {money(data.cashRewardCents)}{" "}
          por pessoa.
        </p>
      </section>

      <section className="surface-card rounded-2xl">
        <h2 className="px-5 py-4 text-base font-medium md:px-6">Os teus indicados</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-t border-border">
                <th className="px-5 py-2 font-normal md:px-6">Membro</th>
                <th className="px-5 py-2 font-normal">Entrou</th>
                <th className="px-5 py-2 font-normal">Estado</th>
                <th className="px-5 py-2 font-normal">Recompensa</th>
              </tr>
            </thead>
            <tbody>
              {data.referrals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-muted-foreground md:px-6">
                    Ainda ninguém entrou pelo teu link. Partilha-o com quem quer começar.
                  </td>
                </tr>
              ) : (
                data.referrals.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-5 py-3 md:px-6">{r.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(r.joinedAt).toLocaleDateString("pt-PT")}
                    </td>
                    <td className="px-5 py-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="px-5 py-3">
                      {r.rewardKind === "cash"
                        ? money(r.rewardCents)
                        : r.rewardKind === "free_slot"
                          ? "Conta para o MM grátis"
                          : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card rounded-2xl p-5 md:p-6">
        <h2 className="text-base font-medium">Retirar saldo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A partir de {money(data.minPayoutCents)}. Pagamos por IBAN ou MB Way depois de
          confirmarmos o pedido.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">Método</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "iban" | "mbway")}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="iban">Transferência (IBAN)</option>
              <option value="mbway">MB Way</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">
              {method === "mbway" ? "Número MB Way" : "IBAN"}
            </span>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={method === "mbway" ? "9xx xxx xxx" : "PT50 …"}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">Titular</span>
            <input
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="Nome completo"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => savePayout.mutate()}
            disabled={savePayout.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm transition hover:bg-muted disabled:opacity-50"
          >
            {savePayout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar dados
          </button>
          <button
            type="button"
            onClick={() => askPayout.mutate()}
            disabled={
              askPayout.isPending ||
              Boolean(pendingPayout) ||
              data.balanceCents < data.minPayoutCents
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {askPayout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Pedir retirada ({money(data.balanceCents)})
          </button>
        </div>
        {pendingPayout ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Tens um pedido de {money(pendingPayout.amountCents)} em análise.
          </p>
        ) : null}

        {data.payouts.length > 0 ? (
          <ul className="mt-5 space-y-2 text-sm">
            {data.payouts.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-4 py-2.5"
              >
                <span>{money(p.amountCents)}</span>
                <span className="text-muted-foreground">
                  {new Date(p.createdAt).toLocaleDateString("pt-PT")} ·{" "}
                  {PAYOUT_STATUS[p.status] ?? p.status}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="surface-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
