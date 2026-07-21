import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveBrandDna } from "@/lib/studio.functions";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ferramentas/studio/marca")({
  component: BrandDnaPage,
});

type Brand = {
  brand_name: string;
  logo_url: string;
  colors: string;
  typography: string;
  segment: string;
  audience: string;
  tone: string;
  website: string;
  socials_instagram: string;
  socials_tiktok: string;
  description: string;
};

const empty: Brand = {
  brand_name: "",
  logo_url: "",
  colors: "",
  typography: "",
  segment: "",
  audience: "",
  tone: "",
  website: "",
  socials_instagram: "",
  socials_tiktok: "",
  description: "",
};

function BrandDnaPage() {
  const { brand, refresh } = useStudio();
  const [form, setForm] = useState<Brand>(empty);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!brand) return;
    const socials = (brand.socials as Record<string, string> | null) ?? {};
    setForm({
      brand_name: String(brand.brand_name ?? ""),
      logo_url: String(brand.logo_url ?? ""),
      colors: Array.isArray(brand.colors) ? (brand.colors as string[]).join(", ") : "",
      typography: String(brand.typography ?? ""),
      segment: String(brand.segment ?? ""),
      audience: String(brand.audience ?? ""),
      tone: String(brand.tone ?? ""),
      website: String(brand.website ?? ""),
      socials_instagram: socials.instagram ?? "",
      socials_tiktok: socials.tiktok ?? "",
      description: String(brand.description ?? ""),
    });
  }, [brand]);

  const save = useServerFn(saveBrandDna);
  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          brand_name: form.brand_name || null,
          logo_url: form.logo_url || null,
          colors: form.colors.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
          typography: form.typography || null,
          segment: form.segment || null,
          audience: form.audience || null,
          tone: form.tone || null,
          website: form.website || null,
          socials: {
            ...(form.socials_instagram ? { instagram: form.socials_instagram } : {}),
            ...(form.socials_tiktok ? { tiktok: form.socials_tiktok } : {}),
          },
          description: form.description || null,
        },
      }),
    onSuccess: () => {
      setSaved(true);
      refresh();
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const set = (k: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-foreground">Brand DNA</h2>
        <p className="text-sm text-muted-foreground">
          Configura uma vez. A IA usará automaticamente em cada imagem e vídeo que gerares.
        </p>
      </div>

      <div className="grid gap-6 rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 md:grid-cols-2">
        <Field label="Nome da marca"><input className={inputCls} value={form.brand_name} onChange={set("brand_name")} /></Field>
        <Field label="Website"><input className={inputCls} value={form.website} onChange={set("website")} placeholder="https://…" /></Field>
        <Field label="Segmento"><input className={inputCls} value={form.segment} onChange={set("segment")} placeholder="Ex.: Beleza premium" /></Field>
        <Field label="Público-alvo"><input className={inputCls} value={form.audience} onChange={set("audience")} placeholder="Ex.: Mulheres 25-45, urbanas" /></Field>
        <Field label="Tom da marca"><input className={inputCls} value={form.tone} onChange={set("tone")} placeholder="Ex.: elegante, direto, sofisticado" /></Field>
        <Field label="Tipografia"><input className={inputCls} value={form.typography} onChange={set("typography")} placeholder="Ex.: Serif moderna" /></Field>
        <Field label="Cores (separadas por vírgula)" full><input className={inputCls} value={form.colors} onChange={set("colors")} placeholder="#111111, #C9A96E, #F5F1EA" /></Field>
        <Field label="Instagram"><input className={inputCls} value={form.socials_instagram} onChange={set("socials_instagram")} placeholder="@marca" /></Field>
        <Field label="TikTok"><input className={inputCls} value={form.socials_tiktok} onChange={set("socials_tiktok")} placeholder="@marca" /></Field>
        <Field label="Logótipo (URL)" full><input className={inputCls} value={form.logo_url} onChange={set("logo_url")} placeholder="https://…" /></Field>
        <Field label="Descrição da marca" full>
          <textarea className={cn(inputCls, "resize-none")} rows={4} value={form.description} onChange={set("description")} placeholder="Uma marca de cuidados premium…" />
        </Field>
      </div>

      <div className="flex justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-primary">
            <Check className="h-4 w-4" /> Guardado
          </span>
        )}
        <button
          type="button"
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
          className={cn("inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground", mut.isPending && "opacity-50")}
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar Brand DNA
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("block", full && "md:col-span-2")}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
