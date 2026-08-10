import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MediaField } from "@/components/mm/media-field";
import { saveProduct } from "@/lib/product-lab.functions";
import { PL_SOURCES, PL_STATUSES, type PlStatus } from "@/lib/product-lab-config";
import { L } from "@/lib/language-guide";
import { cn } from "@/lib/utils";

export interface PlProductInput {
  id?: string;
  name: string;
  image_url: string;
  category: string;
  status: PlStatus;
  sell_price: string;
  cost_price: string;
  market: string;
  supplier: string;
  supplier_url: string;
  source: string;
  product_url: string;
  ad_url: string;
  notes: string;
}

const empty: PlProductInput = {
  name: "",
  image_url: "",
  category: "",
  status: "found",
  sell_price: "",
  cost_price: "",
  market: "",
  supplier: "",
  supplier_url: "",
  source: "",
  product_url: "",
  ad_url: "",
  notes: "",
};

export function productToInput(p: Record<string, unknown>): PlProductInput {
  const s = (k: string) => (p[k] == null ? "" : String(p[k]));
  return {
    id: String(p.id),
    name: s("name"),
    image_url: s("image_url"),
    category: s("category"),
    status: (p.status as PlStatus) ?? "found",
    sell_price: s("sell_price"),
    cost_price: s("cost_price"),
    market: s("market"),
    supplier: s("supplier"),
    supplier_url: s("supplier_url"),
    source: s("source"),
    product_url: s("product_url"),
    ad_url: s("ad_url"),
    notes: s("notes"),
  };
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
      {label}
    </span>
    {children}
  </label>
);

export function ProductDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: PlProductInput | null;
  onSaved?: (id: string) => void;
}) {
  const [form, setForm] = useState<PlProductInput>(initial ?? empty);
  const qc = useQueryClient();
  const save = useServerFn(saveProduct);

  useEffect(() => {
    if (open) setForm(initial ?? empty);
  }, [open, initial]);

  const set = <K extends keyof PlProductInput>(k: K, v: PlProductInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const num = (v: string) => {
    const n = Number(String(v).replace(",", "."));
    return v.trim() === "" || Number.isNaN(n) ? null : n;
  };

  const margin = (() => {
    const sp = num(form.sell_price);
    const cp = num(form.cost_price);
    if (sp == null || cp == null) return null;
    return { value: sp - cp, pct: sp > 0 ? Math.round(((sp - cp) / sp) * 100) : 0 };
  })();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await save({
        data: {
          id: form.id,
          name: form.name.trim(),
          image_url: form.image_url || null,
          category: form.category || null,
          status: form.status,
          sell_price: num(form.sell_price),
          cost_price: num(form.cost_price),
          market: form.market || null,
          supplier: form.supplier || null,
          supplier_url: form.supplier_url || null,
          source: form.source || null,
          product_url: form.product_url || null,
          ad_url: form.ad_url || null,
          notes: form.notes || null,
        },
      });
      return res.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["product-lab"] });
      toast.success(form.id ? "Produto atualizado" : "Produto adicionado");
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (e) => toast.error((e as Error).message ?? L.genericError),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl border-[color:var(--hairline)] bg-surface-1">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {form.id ? "Editar produto" : "Adicionar produto"}
          </DialogTitle>
          <DialogDescription>
            Guarda o que souberes agora — podes completar os restantes campos mais tarde.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Nome do produto">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Massajador cervical" />
          </Field>

          <MediaField
            label="Imagem do produto"
            bucket="studio-media"
            keyPrefix="product-lab"
            value={form.image_url}
            onChange={(v) => set("image_url", v)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria / nicho">
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Bem-estar" />
            </Field>
            <Field label="País / mercado">
              <Input value={form.market} onChange={(e) => set("market", e.target.value)} placeholder="Portugal" />
            </Field>
            <Field label="Preço de venda (€)">
              <Input inputMode="decimal" value={form.sell_price} onChange={(e) => set("sell_price", e.target.value)} placeholder="49.90" />
            </Field>
            <Field label="Custo estimado (€)">
              <Input inputMode="decimal" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} placeholder="12.40" />
            </Field>
          </div>

          <div className="rounded-2xl border border-[color:var(--hairline)] bg-background/50 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Margem estimada: </span>
            <span className={cn("font-medium", margin && margin.value > 0 ? "text-primary" : "text-foreground")}>
              {margin ? `${margin.value.toFixed(2)} € · ${margin.pct}%` : "—"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fornecedor">
              <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
            </Field>
            <Field label="Link do fornecedor">
              <Input value={form.supplier_url} onChange={(e) => set("supplier_url", e.target.value)} placeholder="https://" />
            </Field>
            <Field label="Link do produto">
              <Input value={form.product_url} onChange={(e) => set("product_url", e.target.value)} placeholder="https://" />
            </Field>
            <Field label="Link do anúncio / criativo">
              <Input value={form.ad_url} onChange={(e) => set("ad_url", e.target.value)} placeholder="https://" />
            </Field>
          </div>

          <Field label="Onde encontraste">
            <div className="flex flex-wrap gap-2">
              {PL_SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("source", form.source === s ? "" : s)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    form.source === s
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-[color:var(--hairline)] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Estado">
            <div className="flex flex-wrap gap-2">
              {PL_STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set("status", s.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    form.status === s.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-[color:var(--hairline)] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Observações">
            <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Problema que resolve, público, ideias de ângulo…" />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {L.cancel}
          </Button>
          <Button
            disabled={!form.name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? L.loading : L.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
