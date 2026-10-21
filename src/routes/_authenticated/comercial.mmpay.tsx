import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ImagePlus, Link2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createMmpayLink, listMmpayLinks, setMmpayLinkActive, uploadMmpayCover } from "@/lib/mmpay.functions";
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

  const linksQuery = useQuery({ queryKey: ["mmpay-links"], queryFn: () => listMmpayLinks() });
  const amountCents = Math.round(Number(amountEur.replace(",", ".")) * 100);

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
        data: { title: title.trim(), description: description.trim() || null, amountCents, coverUrl },
      }),
    onSuccess: (link) => {
      toast.success(`Link criado: /pagar/${link.code}`);
      setTitle("");
      setAmountEur("");
      setDescription("");
      setCoverUrl(null);
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

  const canSubmit = title.trim().length > 0 && amountCents >= 100 && !uploading;

  return (
    <div className="commercial-enter space-y-9">
      <section className="border-b border-border pb-8">
        <p className="mb-4 text-xs font-medium text-commercial-accent">PAGAMENTOS</p>
        <h1 className="commercial-page-heading">MMpay</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Cria um link de venda com título, capa, descrição e preço. O cliente paga com cartão, Apple Pay,
          Google Pay ou MB WAY numa página com a nossa marca.
        </p>
      </section>

      <section aria-label="Criar link de pagamento" className="rounded-2xl border border-border bg-surface-1 p-6">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
          <Plus className="h-4 w-4" /> Novo link de venda
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
            <div>
              <label className={labelCls} htmlFor="mmpay-title">Título</label>
              <input id="mmpay-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Mentoria individual E-commerce" maxLength={120} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="mmpay-price">Preço (EUR)</label>
              <input id="mmpay-price" type="text" inputMode="decimal" value={amountEur}
                onChange={(e) => setAmountEur(e.target.value)} placeholder="Ex.: 497" className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="mmpay-desc">Descrição</label>
              <textarea id="mmpay-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                rows={4} maxLength={MAX_DESCRIPTION_LENGTH}
                placeholder="O que o cliente recebe, entregáveis e condições." className={inputCls} />
            </div>
          </div>
        </div>

        <Button className="mt-6" disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? "A criar…" : "Criar link de pagamento"}
        </Button>
      </section>

      <section aria-label="Links de pagamento criados">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Links criados</h2>
          <span className="text-sm text-muted-foreground">{linksQuery.data?.length ?? 0} links</span>
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
            <p className="mt-1 text-sm text-muted-foreground">Cria o primeiro acima e partilha com um cliente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(linksQuery.data ?? []).map((link) => (
              <div key={link.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface-1 px-5 py-4">
                {link.coverUrl ? (
                  <img src={link.coverUrl} alt="" className="h-14 w-24 rounded-lg object-cover ring-1 ring-border" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{link.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMoney(link.amountCents, link.currency)} · {link.paidCount}{" "}
                    {link.paidCount === 1 ? "venda paga" : "vendas pagas"} ·{" "}
                    {new Date(link.createdAt).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">mmclub.pt/pagar/{link.code}</p>
                </div>
                <div className="flex items-center gap-2">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
