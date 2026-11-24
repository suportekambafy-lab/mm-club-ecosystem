import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listCommercialTransactions } from "@/lib/commercial/transactions.functions";
import { CHECKOUT_LIVE_CHANNEL, type CheckoutPresence } from "@/lib/mmpay/checkout-live";

export const Route = createFileRoute("/_authenticated/comercial/ao-vivo")({
  head: () => ({ meta: [{ title: "Checkout ao vivo — Comercial MM Club" }, { name: "description", content: "Quem está agora nos checkouts MMpay." }, { property: "og:title", content: "Checkout ao vivo — Comercial MM Club" }, { property: "og:description", content: "Pessoas nos checkouts MMpay em tempo real." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: LiveView,
});

const STAGE: Record<string, string> = { viewing: "A ver", filling: "A preencher", paying: "A pagar" };
const fmt = (c: number, cur = "EUR") => new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur.toUpperCase() }).format(c / 100);

function LiveView() {
  const [people, setPeople] = useState<CheckoutPresence[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const ch = supabase.channel(CHECKOUT_LIVE_CHANNEL);
    const sync = () => setPeople(Object.values(ch.presenceState() as Record<string, CheckoutPresence[]>).map(v => v[v.length - 1]).filter((p): p is CheckoutPresence => Boolean(p?.code)));
    ch.on("presence", { event: "sync" }, sync).on("presence", { event: "join" }, sync).on("presence", { event: "leave" }, sync).subscribe();
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => { clearInterval(t); void supabase.removeChannel(ch); };
  }, []);
  const tx = useQuery({ queryKey: ["commercial-transactions"], queryFn: () => listCommercialTransactions(), refetchInterval: 30_000 });
  const today = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
  const paidToday = (tx.data ?? []).filter(r => r.status === "paid" && new Date(r.date).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }) === today);
  const groups = useMemo(() => {
    const m = new Map<string, { title: string; amountCents: number; currency: string; list: CheckoutPresence[] }>();
    for (const p of people) { const g = m.get(p.code) ?? { title: p.title, amountCents: p.amountCents, currency: p.currency, list: [] }; g.list.push(p); m.set(p.code, g); }
    return [...m.entries()].sort((a, b) => b[1].list.length - a[1].list.length);
  }, [people]);
  const count = (s: string) => people.filter(p => p.stage === s).length;
  const mins = (iso: string) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  return <div className="commercial-enter">
    <div className="mb-8 flex items-center justify-between border-b border-border pb-4 text-xs text-muted-foreground"><span>Comercial / Ao vivo</span><span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Em tempo real</span></div>
    <h1 className="commercial-page-heading">Checkout ao vivo</h1>
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
      {[["No checkout agora", people.length], ["A ver", count("viewing")], ["A preencher", count("filling")], ["A pagar", count("paying")], ["Pagos hoje", paidToday.length]].map(([l, v]) => <div key={l} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 font-display text-3xl">{v}</p></div>)}
    </div>
    <h2 className="mt-10 mb-3 text-sm font-medium">Checkouts abertos</h2>
    {groups.length === 0 ? <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Ninguém está num checkout neste momento.</p> :
      <div className="grid gap-3 md:grid-cols-2">{groups.map(([code, g]) => <div key={code} className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{g.title}</p><p className="text-xs text-muted-foreground">/pagar/{code} · {fmt(g.amountCents, g.currency)}</p></div><span className="font-display text-2xl">{g.list.length}</span></div>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{g.list.map((p, i) => <li key={i} className="flex justify-between"><span><span className={p.stage === "paying" ? "font-semibold text-primary" : ""}>{STAGE[p.stage]}</span> · {p.method === "mbway" ? "MB WAY" : p.method}</span><span>há {mins(p.since)} min</span></li>)}</ul>
      </div>)}</div>}
    <h2 className="mt-10 mb-3 text-sm font-medium">Pagos hoje · {fmt(paidToday.reduce((s, r) => s + r.amountCents, 0))}</h2>
    <div className="rounded-lg border border-border bg-card">{paidToday.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Ainda sem pagamentos hoje.</p> : paidToday.slice(0, 30).map(r => <div key={r.id} className="flex justify-between border-b border-border px-4 py-3 text-sm last:border-0"><span>{r.buyer || r.email} · <span className="text-muted-foreground">{r.product}</span></span><span>{fmt(r.amountCents)}</span></div>)}</div>
  </div>;
}
