import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Package, Upload, X, Loader2 } from "lucide-react";
import { upsertProduct, deleteProduct } from "@/lib/studio.functions";
import { uploadMedia } from "@/lib/media-upload";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ferramentas/studio/produtos")({
  component: ProdutosPage,
});

type Product = {
  id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  brand_colors: string[];
  photos: string[];
  notes: string | null;
};

function ProdutosPage() {
  const { products, refresh } = useStudio();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useServerFn(deleteProduct);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-foreground">Biblioteca de produtos</h2>
          <p className="text-sm text-muted-foreground">Guarda uma vez. Reutiliza em cada criativo.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface-1 p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Ainda sem produtos. Cria o primeiro.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(products as unknown as Product[]).map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-surface-1 p-4">
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-surface-2">
                  {p.photos?.[0] ? <img src={p.photos[0]} alt="" className="h-full w-full object-cover" /> : <Package className="m-auto h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category ?? "Sem categoria"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{p.photos?.length ?? 0} foto(s)</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setEditing(p)} className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground hover:border-primary/40">
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => confirm(`Eliminar "${p.name}"?`) && delMut.mutate(p.id)}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProductDrawer
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            refresh();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ProductDrawer({ initial, onClose, onSaved }: { initial?: Product; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [colors, setColors] = useState<string>((initial?.brand_colors ?? []).join(", "));
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = useServerFn(upsertProduct);
  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: initial?.id,
          name: name.trim(),
          category: category.trim() || null,
          brand_colors: colors.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
          photos,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: onSaved,
    onError: (e) => setErr((e as Error).message),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? "anon";
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, 10)) {
        const { url } = await uploadMedia("studio-media", f, `${uid}/products`);
        uploaded.push(url);
      }
      setPhotos((prev) => [...prev, ...uploaded].slice(0, 10));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-t-3xl border border-[color:var(--hairline)] bg-background md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <h3 className="font-display text-xl text-foreground">{initial ? "Editar produto" : "Novo produto"}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ex.: Sérum Facial Aurora" />
          </Field>
          <Field label="Categoria">
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="Ex.: Beleza" />
          </Field>
          <Field label="Cores da marca (separadas por vírgula)">
            <input value={colors} onChange={(e) => setColors(e.target.value)} className={inputCls} placeholder="#111111, #C9A96E" />
          </Field>
          <Field label="Notas para a IA">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(inputCls, "resize-none")} placeholder="Ex.: frasco âmbar, gotas visíveis" />
          </Field>

          <Field label="Fotos do produto">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((p, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-[color:var(--hairline)]">
                  <img src={p} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 10 && (
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-surface-1 text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </label>
              )}
            </div>
          </Field>

          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button type="button" onClick={onClose} className="rounded-full border border-border bg-surface-1 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!name.trim() || saveMut.isPending}
            onClick={() => saveMut.mutate()}
            className={cn("rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground", (!name.trim() || saveMut.isPending) && "opacity-50")}
          >
            {saveMut.isPending ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
