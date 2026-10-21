import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getCatalog } from "@/lib/billing.functions";
import { createMmpayLink, listMmpayLinks, setMmpayLinkActive } from "@/lib/mmpay.functions";
import { formatMoney } from "@/lib/billing/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comercial/mmpay")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MMpay — Comercial MM Club" },
      { name: "description", content: "Cria links de pagamento com a identidade MM Club e partilha com os clientes." },
      { property: "og:title", content: "MMpay — Comercial MM Club" },
      { property: "og:description", content: "Links de pagamento MM Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MmpayAdminPage,
});

type Mode = "catalog" | "custom";

function MmpayAdminPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("catalog");
  const [title, setTitle] = useState("");
  const [priceId, setPriceId] = useState("");
  const [amountEur, setAmountEur] = useState("");
  const [description, setDescription] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const linksQuery = useQuery({
    queryKey: ["mmpay-links"],
    queryFn: () => listMmpayLinks(),
  });
  const catalogQuery = useQuery({
    queryKey: ["mmpay-catalog"],
    queryFn: () => getCatalog({ data: {} }),
    staleTime: 5 * 60_000,
  });

  const catalogPrices = (catalogQuery.data ?? []).flatMap((p) =>
    p.prices.map((pr) => ({
      id: pr.id,
      label: `${p.name} — ${pr.displayLabel ?? pr.slug} (${formatMoney(pr.amountCents, pr.currency)}${pr.interval === "month" ? "/mês" : pr.interval === "year" ? "/ano" : ""})`,
    })),
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createMmpayLink({
        data: {
          title: title.trim(),
          priceId: mode === "catalog" ? priceId || null : null,
          customAmountCents:
            mode === "custom" ? Math.round(Number(amountEur.replace(",", ".")) * 100) : null,
          customDescription: mode === "custom" ? description.trim() || null : null,
        },
      }),
    onSuccess: (link) => {
      toast.success(`Link criado: /pagar/${link.code}`);
      setTitle("");
      setPriceId("");
      setAmountEur("");
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["mmpay-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (i: { id: string; active: boolean }) => setMmpayLinkActive({ data: i }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mmpay-links"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = async (id: string, code: string) => {
    const url = `https://mmclub.pt/pagar/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      toast.error(`Copia manualmente: ${url}`);
    }
  };

  const canSubmit =
    title.trim().length > 0 &&
    (mode === "catalog" ? Boolean(priceId) : Number(amountEur.replace(",", ".")) >= 1 && description.trim().length >= 3);

  return (
    <div className="commercial-enter space-y-9">
      <section className="border-b border-border pb-8">
        <p className="mb-4 text-xs font-medium text-commercial-accent">PAGAMENTOS</p>
        <h1 className="commercial-page-heading">MMpay</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Cria links de pagamento com a identidade MM Club e envia ao cliente por
          WhatsApp ou email. O cliente abre o link, confirma o email e paga numa
          página com a nossa marca.
        </p>
      </section>

      <section aria-label="Criar link de pagamento" className="rounded-2xl border border-border bg-surface-1 p-6">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
          <Plus className="h-4 w-4" /> Novo link de pagamento
        </h2>

        <div className="mb-5 flex gap-2">
          {(["catalog", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-4 py-2 text-sm ring-1 transition-colors",
                mode === m
                  ? "bg-primary/15 text-primary ring-primary/40"
                  : "bg-muted text-muted-foreground ring-border",
              )}
            >
              {m === "catalog" ? "Produto do catálogo" : "Valor personalizado"}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Título do link
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Adesão MM Club — João"
              maxLength={120}
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {mode === "catalog" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Produto e preço
              </label>
              <select
                value={priceId}
                onChange={(e) => setPriceId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Escolhe um preço…</option>
                {catalogPrices.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Valor (EUR)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountEur}
                  onChange={(e) => setAmountEur(e.target.value)}
                  placeholder="Ex.: 497"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  O que está a ser cobrado
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Mentoria individual — sessão única"
                  maxLength={140}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </>
          )}
        </div>

        <Button
          className="mt-6"
          disabled={!canSubmit || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "A criar…" : "Criar link de pagamento"}
        </Button>
      </section>

      <section aria-label="Links de pagamento criados">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Links criados</h2>
          <span className="text-sm text-muted-foreground">
            {linksQuery.data?.length ?? 0} links
          </span>
        </div>

        {linksQuery.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-surface-1" />
            ))}
          </div>
        ) : (linksQuery.data ?? []).length === 0 ? (
          <div className="border-y border-border py-16 text-center">
            <Link2 className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Ainda não criaste nenhum link.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cria o primeiro acima e partilha com um cliente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(linksQuery.data ?? []).map((link) => (
              <div
                key={link.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface-1 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{link.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {link.productName ? `${link.productName} · ` : ""}
                    {formatMoney(link.amountCents, link.currency)}
                    {link.interval === "month" ? "/mês" : link.interval === "year" ? "/ano" : " único"}
                    {" · "}
                    {new Date(link.createdAt).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">/pagar/{link.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(link.id, link.code)}
                  >
                    {copiedId === link.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedId === link.id ? "Copiado" : "Copiar link"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: link.id, active: !link.active })}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs ring-1 transition-colors",
                      link.active
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                        : "bg-muted text-muted-foreground ring-border",
                    )}
                  >
                    {link.active ? "Ativo" : "Inativo"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
