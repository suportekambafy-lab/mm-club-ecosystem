import { createFileRoute, Link } from "@tanstack/react-router";
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
  MousePointerClick,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPartnerDashboard,
  requestPartnerAccess,
  requestPartnerPayout,
  savePartnerPayoutDetails,
} from "@/lib/partners.functions";
import partnersHero from "@/assets/partners-hero.jpg";
import partnersSocial from "@/assets/partners-social.jpg";

export const Route = createFileRoute("/_app/parceiros")({
  head: () => ({
    meta: [
      { title: "MM Partners — ganha com quem trazes" },
      {
        name: "description",
        content:
          "Partilha o teu link MM Partners: com 3 indicados a pagar tens o MM Club Start grátis e, a partir do 4.º, ganhas 10 € por cada indicado.",
      },
      { property: "og:title", content: "MM Partners — ganha com quem trazes" },
      {
        property: "og:description",
        content:
          "3 indicados a pagar = MM Club Start grátis. Do 4.º em diante, 10 € por cada indicado pago.",
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
  const joinFn = useServerFn(requestPartnerAccess);
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
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!data?.joined) return;
    setMethod((data.payout.method === "mbway" ? "mbway" : "iban") as "iban" | "mbway");
    setTarget(data.payout.target ?? "");
    setHolder(data.payout.holder ?? "");
  }, [data?.joined, data?.payout.method, data?.payout.target, data?.payout.holder]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["mm-partners"] });

  const join = useMutation({
    mutationFn: () => joinFn({ data: { origin, note } }),
    onSuccess: () => {
      toast.success("Candidatura enviada. Avisamos-te quando for aprovada.");
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
      <div className="px-4 py-6 md:py-10">
        <section className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border bg-[#0b0a09]">
          <div className="grid items-stretch lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10 p-6 sm:p-10 lg:p-14">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-gold">
                <Sparkles className="h-3.5 w-3.5" /> Programa de parceiros
              </span>
              <h1 className="mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl">
                Transforma a tua
                <span className="block bg-gradient-to-r from-gold-soft via-gold to-gold-deep bg-clip-text text-transparent">
                  influência em receita
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/70 md:text-base">
                Recebes um link só teu, acompanhas cada clique em tempo real e és pago por cada
                pessoa que entra no clube e fica.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Pillar
                  icon={Gift}
                  title="3 ativos"
                  text="MM Club Start grátis enquanto se mantiverem a pagar."
                />
                <Pillar icon={BadgeEuro} title="10 € cada" text="Do 4.º indicado pago em diante." />
                <Pillar icon={Wallet} title="Retiras a partir de 25 €" text="IBAN ou MB Way." />
              </div>

              {data?.applicationStatus === "pending" ? (
                <div className="mt-9 rounded-2xl border border-gold/30 bg-gold/10 p-5">
                  <p className="text-sm font-medium text-gold">Pedido em análise</p>
                  <p className="mt-2 text-sm text-white/70">
                    Recebemos a tua candidatura
                    {data.requestedAt
                      ? ` em ${new Date(data.requestedAt).toLocaleDateString("pt-PT")}`
                      : ""}
                    . A equipa responde em poucos dias e avisamos-te por email.
                  </p>
                </div>
              ) : data?.applicationStatus === "rejected" ? (
                <div className="mt-9 rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
                  <p className="text-sm font-medium text-white">Candidatura recusada</p>
                  <p className="mt-2 text-sm text-white/70">
                    {data.decisionNote || "Fala com o MM Suporte para saberes mais."}
                  </p>
                </div>
              ) : data && !data.eligible ? (
                <div className="mt-9 rounded-2xl border border-gold/30 bg-gold/10 p-5">
                  <p className="text-sm font-medium text-gold">Regulariza a tua conta primeiro</p>
                  <p className="mt-2 text-sm text-white/70">
                    {data.ineligibleReason ??
                      "A tua conta está suspensa. Paga os valores em atraso para te candidatares."}
                  </p>
                  <Link
                    to="/subscricao"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-soft to-gold-deep px-5 py-2.5 text-sm font-semibold text-[#12100d]"
                  >
                    Pagar agora
                  </Link>
                </div>
              ) : (
                <div className="mt-9 max-w-lg">
                  <label className="text-xs uppercase tracking-[0.14em] text-white/45">
                    Conta-nos como vais divulgar
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={600}
                    placeholder="Ex.: tenho 8 mil seguidores no Instagram sobre e-commerce…"
                    className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => join.mutate()}
                    disabled={join.isPending}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-soft to-gold-deep px-6 py-3.5 text-sm font-semibold text-[#12100d] shadow-[0_18px_40px_-18px_oklch(0.72_0.14_74/0.9)] transition hover:brightness-110 disabled:opacity-50"
                  >
                    {join.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Enviar candidatura
                  </button>
                  <p className="mt-4 max-w-md text-xs text-white/45">
                    A entrada é por aprovação. Só contam contas reais com plano pago e indicações a
                    ti mesmo não contam.
                  </p>
                </div>
              )}
            </div>

            <div className="relative min-h-[320px] lg:min-h-[560px]">
              <img
                src={partnersHero}
                alt="Empresária a partilhar o seu link MM Partners"
                width={1280}
                height={1600}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a09] via-[#0b0a09]/25 to-transparent lg:bg-gradient-to-r lg:from-[#0b0a09] lg:via-[#0b0a09]/35 lg:to-transparent" />
            </div>
          </div>
        </section>

        <section className="mx-auto mt-6 grid max-w-6xl gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="surface-card overflow-hidden rounded-3xl">
            <img
              src={partnersSocial}
              alt="Dois membros do MM Club a acompanhar resultados"
              width={1280}
              height={960}
              loading="lazy"
              className="h-56 w-full object-cover sm:h-72"
            />
            <div className="p-5 md:p-6">
              <h2 className="text-base font-medium">Como funciona, sem letras pequenas</h2>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>1. Entras e recebes o teu link em mmclub.pt.</li>
                <li>2. Partilhas com quem quer construir marca.</li>
                <li>3. Contamos cada clique e cada plano realmente pago.</li>
                <li>4. Recebes: Start grátis aos 3 ativos, 10 € por cada indicado seguinte.</li>
              </ol>
            </div>
          </div>
          <div className="surface-card rounded-3xl p-5 md:p-6">
            <TrendingUp className="h-6 w-6 text-primary" strokeWidth={1.6} />
            <h2 className="mt-3 text-base font-medium">Painel com números reais</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Depois de entrares vês cliques, pessoas diferentes que abriram o link, indicados a
              pagar, saldo disponível e histórico de pagamentos.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Cliques no link", "1 284"],
                ["A pagar agora", "14 indicados"],
                ["Saldo disponível", "350 €"],
                ["Já recebido", "1 120 €"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="mt-1 text-lg font-semibold text-gold">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
              Números de exemplo
            </p>
          </div>
        </section>
      </div>
    );
  }

  const pendingPayout = data.payouts.find((p) => p.status === "requested");

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-10">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-[#0b0a09] p-6 md:p-10">
        <img
          src={partnersHero}
          alt=""
          aria-hidden
          width={1280}
          height={1600}
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[42%] object-cover object-top opacity-70 md:block"
        />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#0b0a09] via-[#0b0a09]/85 to-transparent md:block" />
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-gold">
            <Handshake className="h-3.5 w-3.5" /> MM Partners
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-4xl">
            {data.freeBenefitActive ? "Start grátis ativo" : "O teu negócio de indicações"}
          </h1>
          <p className="mt-3 text-sm text-white/65">
            Partilha o teu link, acompanha cliques e conversões e recebe as tuas recompensas.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-soft to-gold-deep px-4 py-3 text-sm font-semibold text-[#12100d] transition hover:brightness-110"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar link"}
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm text-white transition hover:bg-white/10"
            >
              <Share2 className="h-4 w-4" />
              Partilhar
            </button>
          </div>
          <code className="mt-4 block max-w-md truncate rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            {data.link}
          </code>
          <p className="mt-2 text-xs text-white/45">
            Código: <strong className="text-white/70">{data.code}</strong>
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Cliques no link"
          value={String(data.clicks)}
          hint={`${data.uniqueClicks} pessoas diferentes`}
          icon={MousePointerClick}
        />
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
            className="h-full rounded-full bg-gradient-to-r from-gold-soft to-gold-deep transition-all"
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

function Pillar({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Users;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <Icon className="h-4 w-4 text-gold" strokeWidth={1.8} />
      <p className="mt-2 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/55">{text}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <div className="surface-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
