import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import DottedMap from "dotted-map";
import { supabase } from "@/integrations/supabase/client";
import { listCommercialTransactions } from "@/lib/commercial/transactions.functions";
import { CHECKOUT_LIVE_CHANNEL, type CheckoutPresence } from "@/lib/mmpay/checkout-live";

export const Route = createFileRoute("/_authenticated/comercial/ao-vivo")({
  head: () => ({ meta: [{ title: "Live View — Comercial MM Club" }, { name: "description", content: "Visitantes, checkouts e vendas MMpay em tempo real." }, { property: "og:title", content: "Live View — Comercial MM Club" }, { property: "og:description", content: "Visitantes e vendas MMpay em tempo real." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: LiveView,
});

const fmt = (c: number, cur = "EUR") => new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur.toUpperCase() }).format(c / 100);
const W = 120, H = 60;
const project = (lat: number, lng: number) => ({ x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 });
let mapSvg: string | null = null;
function worldSvg() {
  if (!mapSvg) {
    const m = new DottedMap({ width: W, height: H, grid: "diagonal" } as never);
    mapSvg = m.getSVG({ radius: 0.22, color: "currentColor", shape: "circle", backgroundColor: "transparent" });
  }
  return mapSvg;
}

function LiveView() {
  const [people, setPeople] = useState<CheckoutPresence[]>([]);
  const seen = useRef(new Set<string>());
  const [sessionsSeen, setSessionsSeen] = useState(0);
  useEffect(() => {
    const ch = supabase.channel(CHECKOUT_LIVE_CHANNEL);
    const sync = () => {
      const st = ch.presenceState() as Record<string, CheckoutPresence[]>;
      Object.keys(st).forEach(k => seen.current.add(k));
      setSessionsSeen(seen.current.size);
      setPeople(Object.values(st).map(v => v[v.length - 1]).filter((p): p is CheckoutPresence => Boolean(p?.code)));
    };
    ch.on("presence", { event: "sync" }, sync).on("presence", { event: "join" }, sync).on("presence", { event: "leave" }, sync).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);
  const tx = useQuery({ queryKey: ["commercial-transactions"], queryFn: () => listCommercialTransactions(), refetchInterval: 30_000 });
  const today = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
  const paidToday = (tx.data ?? []).filter(r => r.status === "paid" && new Date(r.date).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }) === today);
  const salesToday = paidToday.reduce((s, r) => s + r.amountCents, 0);
  const count = (s: string) => people.filter(p => p.stage === s).length;
  const [svg, setSvg] = useState("");
  useEffect(() => { setSvg(worldSvg()); }, []);

  const byLocation = useMemo(() => tally(people.map(p => [p.city, p.country].filter(Boolean).join(", ") || "Desconhecido")), [people]);
  const byCheckout = useMemo(() => tally(people.map(p => p.title)), [people]);
  const topProducts = useMemo(() => {
    const m = new Map<string, { n: number; c: number }>();
    for (const r of paidToday) { const k = r.product ?? "Produto"; const g = m.get(k) ?? { n: 0, c: 0 }; g.n++; g.c += r.amountCents; m.set(k, g); }
    return [...m.entries()].sort((a, b) => b[1].c - a[1].c).slice(0, 5);
  }, [paidToday]);
  const dots = people.filter(p => p.lat != null && p.lng != null);
  const funnel: [string, number, string][] = [["A ver o checkout", count("viewing"), "Abriram o link"], ["A preencher dados", count("filling"), "Começaram a escrever"], ["A pagar", count("paying"), "No passo de pagamento"], ["Compraram hoje", paidToday.length, "Pagamentos concluídos"]];

  return <div className="commercial-enter">
    <div className="mb-6 flex items-center justify-between border-b border-border pb-4 text-xs text-muted-foreground"><span>Comercial / Live View</span><span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Em tempo real</span></div>
    <h1 className="commercial-page-heading">Live View</h1>
    <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div className="absolute left-4 top-4 z-10 rounded-lg border border-border bg-background/80 px-4 py-3 backdrop-blur">
          <p className="text-xs text-muted-foreground">Visitantes agora</p>
          <p className="font-display text-4xl">{people.length}</p>
        </div>
        <div className="relative aspect-[2/1] w-full text-muted-foreground/40">
          <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          {dots.map((p, i) => { const { x, y } = project(p.lat!, p.lng!); return <span key={i} title={`${p.city ?? ""} · ${p.title}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className={`absolute inset-0 h-3 w-3 animate-ping rounded-full ${p.stage === "paying" ? "bg-accent" : "bg-primary"} opacity-60`} />
            <span className={`relative block h-3 w-3 rounded-full border-2 border-background ${p.stage === "paying" ? "bg-accent" : "bg-primary"}`} />
          </span>; })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 content-start">
        <Kpi label="Visitantes agora" value={people.length} />
        <Kpi label="Vendas hoje" value={fmt(salesToday)} />
        <Kpi label="Sessões (desde que abriste)" value={sessionsSeen} />
        <Kpi label="Encomendas hoje" value={paidToday.length} />
        <Kpi label="Ticket médio" value={paidToday.length ? fmt(Math.round(salesToday / paidToday.length)) : "—"} />
        <Kpi label="A pagar agora" value={count("paying")} />
      </div>
    </div>

    <div className="mt-4 rounded-xl border border-border bg-card p-5">
      <p className="mb-4 text-sm font-medium">Comportamento dos clientes</p>
      <div className="grid gap-4 md:grid-cols-4">{funnel.map(([l, v, d], i) => <div key={l} className="border-l-2 border-primary/60 pl-3"><p className="text-xs text-muted-foreground">{i + 1}. {l}</p><p className="mt-1 font-display text-3xl">{v}</p><p className="text-xs text-muted-foreground">{d}</p></div>)}</div>
    </div>

    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <ListCard title="Sessões por localização" rows={byLocation.map(([k, n]) => [k, String(n)])} empty="Sem visitantes agora" />
      <ListCard title="Checkouts abertos" rows={byCheckout.map(([k, n]) => [k, String(n)])} empty="Ninguém num checkout" />
      <ListCard title="Produtos mais vendidos hoje" rows={topProducts.map(([k, g]) => [`${k} · ${g.n}×`, fmt(g.c)])} empty="Ainda sem vendas hoje" />
    </div>

    <div className="mt-4 rounded-xl border border-border bg-card">
      <p className="border-b border-border px-5 py-3 text-sm font-medium">Últimas vendas de hoje</p>
      {paidToday.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Ainda sem pagamentos hoje.</p> : paidToday.slice(0, 20).map(r => <div key={r.id} className="flex justify-between border-b border-border px-5 py-3 text-sm last:border-0"><span>{r.buyer || r.email} · <span className="text-muted-foreground">{r.product}</span></span><span>{fmt(r.amountCents)}</span></div>)}
    </div>
  </div>;
}

function tally(xs: string[]) { const m = new Map<string, number>(); xs.forEach(x => m.set(x, (m.get(x) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); }
function Kpi({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>; }
function ListCard({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) {
  return <div className="rounded-xl border border-border bg-card p-5"><p className="mb-3 text-sm font-medium">{title}</p>
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-2 text-sm">{rows.map(([a, b]) => <li key={a} className="flex justify-between gap-3"><span className="truncate">{a}</span><span className="text-muted-foreground">{b}</span></li>)}</ul>}</div>;
}
