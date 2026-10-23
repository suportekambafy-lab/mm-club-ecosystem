import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, CopyPlus, ImagePlus, Link2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MmpaySubscriptions } from "@/components/mmpay/subscriptions-panel";
import { intervalLabel, splitInstallments, type BillingInterval } from "@/lib/mmpay/subscription-rules";
import { createMmpayLink, deleteMmpayLink, listMmpayLinks, setMmpayLinkActive, updateMmpayLink, uploadMmpayCover } from "@/lib/mmpay.functions";
import { COVER_MIME_TYPES, MAX_COVER_BYTES, MAX_DESCRIPTION_LENGTH } from "@/lib/mmpay/rules";
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

const inputCls =
  "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    r.readAsDataURL(file);
  });
}

function MmpayAdminPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [amountEur, setAmountEur] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<"one_time" | "subscription">("one_time");
  const [interval, setBillingInterval] = useState<BillingInterval | "">("");
  const [intervalCount, setIntervalCount] = useState("");
  const [durationKind, setDurationKind] = useState<"" | "indefinite" | "fixed">("");
  const [cycles, setCycles] = useState("");
  const [tab, setTab] = useState<"one_time" | "subscription">("one_time");
  const [productFilter, setProductFilter] = useState<"all" | "adesao" | "mentoria">("all");

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setAmountEur("");
    setDescription("");
    setCoverUrl(null);
    setBillingType("one_time");
    setBillingInterval("");
    setIntervalCount("");
    setDurationKind("");
    setCycles("");
  };

  const linksQuery = useQuery({ queryKey: ["mmpay-links"], queryFn: () => listMmpayLinks() });
  const amountCents = Math.round(Number(amountEur.replace(",", ".")) * 100);
  const countNum = Number(intervalCount);
  const cyclesNum = Number(cycles);
  const isFixedPlan = billingType === "subscription" && durationKind === "fixed";
  const subscriptionValid =
    interval !== "" && Number.isInteger(countNum) && countNum >= 1 && countNum <= 24 &&
    (durationKind === "indefinite" || (isFixedPlan && Number.isInteger(cyclesNum) && cyclesNum >= 1 && cyclesNum <= 600));
  // Com prestações, o campo de valor é o TOTAL da venda; o sistema divide em prestações exatas.
  const installments = isFixedPlan && subscriptionValid ? splitInstallments(amountCents, cyclesNum) : null;
  const billing =
    billingType === "subscription" && subscriptionValid
      ? {
          type: "subscription" as const,
          interval: interval as BillingInterval,
          intervalCount: countNum,
          totalCycles: durationKind === "fixed" ? cyclesNum : null,
          totalCents: isFixedPlan ? amountCents : null,
        }
      : { type: "one_time" as const };

  const onCover = async (file: File | undefined) => {
    if (!file) return;
    if (!(COVER_MIME_TYPES as readonly string[]).includes(file.type)) return toast.error("Usa JPG, PNG ou WebP.");
    if (file.size > MAX_COVER_BYTES) return toast.error("A imagem tem de ter até 5 MB.");
    setUploading(true);
    try {
      const { url } = await uploadMmpayCover({
        data: { mime: file.type as (typeof COVER_MIME_TYPES)[number], base64: await toBase64(file) },
      });
      setCoverUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio da imagem.");
    } finally {
      setUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createMmpayLink({
        data: { title: title.trim(), description: description.trim() || null, amountCents, coverUrl, billing },
      }),
    onSuccess: (link) => {
      toast.success(`Link criado: /pagar/${link.code}`);
      setTab(link.billing.type === "subscription" ? "subscription" : "one_time");
      resetForm();
      void qc.invalidateQueries({ queryKey: ["mmpay-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (i: { id: string; active: boolean }) => setMmpayLinkActive({ data: i }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mmpay-links"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error("Seleciona um produto para editar.");
      return updateMmpayLink({ data: { id: editingId, title: title.trim(), description: description.trim() || null, amountCents, coverUrl, billing } });
    },
    onSuccess: () => {
      toast.success("Produto atualizado.");
      resetForm();
      void qc.invalidateQueries({ queryKey: ["mmpay-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMmpayLink({ data: { id } }),
    onSuccess: () => {
      setConfirmDeleteId(null);
      toast.success("Link eliminado.");
      void qc.invalidateQueries({ queryKey: ["mmpay-links"] });
    },
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

  const loadBilling = (b: { type: string; interval?: BillingInterval; intervalCount?: number; totalCycles?: number | null }) => {
    if (b.type === "subscription" && b.interval) {
      setBillingType("subscription");
      setBillingInterval(b.interval);
      setIntervalCount(String(b.intervalCount ?? ""));
      setDurationKind(b.totalCycles ? "fixed" : "indefinite");
      setCycles(b.totalCycles ? String(b.totalCycles) : "");
    } else {
      setBillingType("one_time");
      setBillingInterval("");
      setIntervalCount("");
      setDurationKind("");
      setCycles("");
    }
  };

  type LinkLike = {
    id?: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    amountCents: number;
    totalCents?: number;
    billing: { type: string; totalCycles?: number | null; totalCents?: number | null };
  };
  /** Com prestações, o formulário edita o valor total; sem prestações, o valor por cobrança. */
  const formAmount = (link: LinkLike) =>
    link.billing.type === "subscription" && link.billing.totalCycles && link.billing.totalCents
      ? link.billing.totalCents
      : link.amountCents;

  const edit = (link: LinkLike & { id: string }) => {
    setEditingId(link.id);
    loadBilling(link.billing as never);
    setTitle(link.title);
    setDescription(link.description ?? "");
    setCoverUrl(link.coverUrl);
    setAmountEur(String(formAmount(link) / 100).replace(".", ","));
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("mmpay-title")?.focus({ preventScroll: true });
  };

  const duplicate = (link: LinkLike) => {
    setEditingId(null);
    loadBilling(link.billing as never);
    setTitle(`${link.title} (cópia)`);
    setDescription(link.description ?? "");
    setCoverUrl(link.coverUrl);
    setAmountEur(String(formAmount(link) / 100).replace(".", ","));
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => document.getElementById("mmpay-price")?.focus(), 300);
    toast.info("Link duplicado no formulário — muda o preço e cria.");
  };

  const canSubmit = title.trim().length > 0 && amountCents >= 100 && !uploading && (billingType === "one_time" || subscriptionValid);

  // Normaliza para comparar produtos independentemente de acentos ou maiúsculas.
  const normalizeTitle = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matchesProduct = (title: string) =>
    productFilter === "all" ||
    (productFilter === "adesao" && normalizeTitle(title).includes("adesao")) ||
    (productFilter === "mentoria" && normalizeTitle(title).includes("mentoria"));
  const visibleLinks = (linksQuery.data ?? [])
    .filter((l) => (l.billing.type === "subscription") === (tab === "subscription"))
    .filter((l) => tab === "one_time" ? matchesProduct(l.title) : true);

  return (
    <div className="commercial-enter space-y-9">
      <section className="border-b border-border pb-8">
        <p className="mb-4 text-xs font-medium text-commercial-accent">PAGAMENTOS</p>
        <h1 className="commercial-page-heading">MMpay</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Cria um link de venda com título, capa, descrição e preço. O cliente escolhe como pagar: cartão
          (com Apple Pay e Google Pay), MB WAY ou Klarna em 3 vezes — numa página com a nossa marca.
        </p>
      </section>

      <section aria-label={editingId ? "Editar produto" : "Criar link de pagamento"} className="rounded-2xl border border-border bg-surface-1 p-6">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
          {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingId ? "Editar produto" : "Novo link de venda"}
        </h2>

        <div className="grid gap-5 md:grid-cols-[260px_1fr]">
          <div>
            <span className={labelCls}>Imagem de capa</span>
            {coverUrl ? (
              <div className="relative mt-2">
                <img src={coverUrl} alt="Capa" className="aspect-[16/9] w-full rounded-xl object-cover ring-1 ring-border" />
                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  aria-label="Remover capa"
                  className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 ring-1 ring-border"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="mt-2 flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground hover:border-primary">
                <ImagePlus className="h-6 w-6" />
                {uploading ? "A enviar…" : "Carregar imagem"}
                <input
                  type="file"
                  accept={COVER_MIME_TYPES.join(",")}
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => void onCover(e.target.files?.[0])}
                />
              </label>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <div className="md:col-span-2">
              <span className={labelCls}>Tipo de pagamento</span>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de pagamento">
                {([["one_time", "Pagamento único"], ["subscription", "Assinatura"]] as const).map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={billingType === v} onClick={() => setBillingType(v)}
                    className={cn("rounded-xl border px-4 py-3 text-sm font-medium", billingType === v ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground")}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="mmpay-title">Título</label>
              <input id="mmpay-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Mentoria individual E-commerce" maxLength={120} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="mmpay-price">
                {isFixedPlan ? "Valor total (EUR)" : billingType === "subscription" ? "Valor por cobrança (EUR)" : "Preço (EUR)"}
              </label>
              <input id="mmpay-price" type="text" inputMode="decimal" value={amountEur}
                onChange={(e) => setAmountEur(e.target.value)} placeholder={isFixedPlan ? "Ex.: 1997" : "Ex.: 497"} className={inputCls} />
              {installments && amountCents >= 100 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {cyclesNum}x de {formatMoney(installments[0], "EUR")} {intervalLabel(interval as BillingInterval, countNum)}
                  {installments[0] !== installments[installments.length - 1]
                    ? ` (última: ${formatMoney(installments[installments.length - 1], "EUR")})`
                    : ""}
                </p>
              ) : null}
            </div>
            {billingType === "subscription" ? (
              <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
                <div>
                  <label className={labelCls} htmlFor="mmpay-every">Cobrar a cada</label>
                  <input id="mmpay-every" type="number" min={1} max={24} value={intervalCount} onChange={(e) => setIntervalCount(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="mmpay-interval">Periodicidade</label>
                  <select id="mmpay-interval" value={interval} onChange={(e) => setBillingInterval(e.target.value as BillingInterval)} className={inputCls}>
                    <option value="" disabled>Escolher</option>
                    <option value="week">Semana(s)</option>
                    <option value="month">Mês(es)</option>
                    <option value="year">Ano(s)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="mmpay-duration">Duração</label>
                  <select id="mmpay-duration" value={durationKind} onChange={(e) => setDurationKind(e.target.value as "indefinite" | "fixed")} className={inputCls}>
                    <option value="" disabled>Escolher</option>
                    <option value="indefinite">Tempo indeterminado</option>
                    <option value="fixed">Número de cobranças</option>
                  </select>
                </div>
                {durationKind === "fixed" ? (
                  <div>
                    <label className={labelCls} htmlFor="mmpay-cycles">Total de cobranças</label>
                    <input id="mmpay-cycles" type="number" min={1} max={600} value={cycles} onChange={(e) => setCycles(e.target.value)} className={inputCls} />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="mmpay-desc">Descrição</label>
              <textarea id="mmpay-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                rows={4} maxLength={MAX_DESCRIPTION_LENGTH}
                placeholder="O que o cliente recebe, entregáveis e condições." className={inputCls} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button disabled={!canSubmit || createMutation.isPending || updateMutation.isPending} onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}>
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? (updateMutation.isPending ? "A guardar…" : "Guardar alterações") : (createMutation.isPending ? "A criar…" : "Criar link de pagamento")}
          </Button>
          {editingId ? <Button variant="outline" disabled={updateMutation.isPending || uploading} onClick={resetForm}><X className="h-4 w-4" /> Cancelar</Button> : null}
        </div>
      </section>

      <section aria-label="Links de pagamento criados">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Links criados</h2>
          <div role="tablist" aria-label="Tipo de link" className="flex rounded-full border border-border bg-surface-1 p-1">
            {([["one_time", "Vendas avulsas"], ["subscription", "Assinaturas"]] as const).map(([v, l]) => {
              const count = (linksQuery.data ?? []).filter((x) => (x.billing.type === "subscription") === (v === "subscription")).length;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={tab === v}
                  onClick={() => setTab(v)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l} · {count}
                </button>
              );
            })}
          </div>
          {tab === "one_time" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Produto</span>
              {([["all", "Todos"], ["adesao", "Adesão ao MM Club"], ["mentoria", "Mentoria individual"]] as const).map(([v, l]) => {
                const count = (linksQuery.data ?? [])
                  .filter((x) => x.billing.type !== "subscription")
                  .filter((x) =>
                    v === "all" ||
                    (v === "adesao" && normalizeTitle(x.title).includes("adesao")) ||
                    (v === "mentoria" && normalizeTitle(x.title).includes("mentoria")),
                  ).length;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={productFilter === v}
                    onClick={() => setProductFilter(v)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                      productFilter === v
                        ? "bg-primary/10 text-primary ring-primary/40"
                        : "text-muted-foreground ring-border hover:text-foreground",
                    )}
                  >
                    {l} · {count}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {linksQuery.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-surface-1" />
            ))}
          </div>
        ) : visibleLinks.length === 0 ? (
          <div className="border-y border-border py-16 text-center">
            <Link2 className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">
              {tab === "subscription"
                ? "Ainda não criaste nenhuma assinatura."
                : productFilter === "all" || !(linksQuery.data ?? []).some((x) => x.billing.type !== "subscription")
                  ? "Ainda não criaste nenhuma venda avulsa."
                  : "Nenhuma venda avulsa deste produto."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Cria o primeiro acima e partilha com um cliente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleLinks.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface-1 px-5 py-4">
                {link.coverUrl ? (
                  <img src={link.coverUrl} alt="" className="h-14 w-24 rounded-lg object-cover ring-1 ring-border" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 break-words font-medium">
                    {link.title}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                        link.billing.type === "subscription"
                          ? "bg-primary/10 text-primary ring-primary/30"
                          : "bg-muted text-muted-foreground ring-border",
                      )}
                    >
                      {link.billing.type === "subscription" ? "Assinatura" : "Avulso"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {link.billing.type === "subscription" && link.billing.totalCycles && link.billing.totalCents
                      ? `${formatMoney(link.billing.totalCents, link.currency)} · ${link.billing.totalCycles}x de ${formatMoney(splitInstallments(link.billing.totalCents, link.billing.totalCycles)[0], link.currency)} ${intervalLabel(link.billing.interval, link.billing.intervalCount)}`
                      : `${formatMoney(link.amountCents, link.currency)}${link.billing.type === "subscription" ? ` ${intervalLabel(link.billing.interval, link.billing.intervalCount)} · sem fim` : ""}`}{" "}· {link.paidCount}{" "}
                    {link.paidCount === 1 ? "venda paga" : "vendas pagas"} ·{" "}
                    {new Date(link.createdAt).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">mmclub.pt/pagar/{link.code}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" aria-label={`Editar produto ${link.title}`} disabled={updateMutation.isPending || uploading} onClick={() => edit(link)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => duplicate(link)}>
                    <CopyPlus className="h-4 w-4" /> Duplicar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void copyLink(link.id, link.code)}>
                    {copiedId === link.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedId === link.id ? "Copiado" : "Copiar link"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: link.id, active: !link.active })}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs ring-1",
                      link.active ? "bg-primary/15 text-primary ring-primary/30" : "bg-muted text-muted-foreground ring-border",
                    )}
                  >
                    {link.active ? "Ativo" : "Inativo"}
                  </button>
                  {confirmDeleteId === link.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(link.id)}
                        className="rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive ring-1 ring-destructive/30 disabled:opacity-60"
                      >
                        {deleteMutation.isPending ? "A eliminar…" : "Confirmar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label="Cancelar eliminação"
                        className="rounded-full p-1.5 text-muted-foreground ring-1 ring-border"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(link.id)}
                      aria-label={`Eliminar link ${link.title}`}
                      className="rounded-full p-1.5 text-muted-foreground ring-1 ring-border hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <MmpaySubscriptions />
    </div>
  );
}
