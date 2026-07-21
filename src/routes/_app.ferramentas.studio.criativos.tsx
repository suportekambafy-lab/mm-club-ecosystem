import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Trash2, Image as ImageIcon, Film } from "lucide-react";
import { listAssets, deleteAsset } from "@/lib/studio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ferramentas/studio/criativos")({
  component: CriativosPage,
});

type AssetRow = {
  id: string;
  kind: "image" | "video";
  url: string;
  thumb_url: string | null;
  format: string | null;
  style: string | null;
  credits_used: number;
  created_at: string;
};

function CriativosPage() {
  const [tab, setTab] = useState<"all" | "image" | "video">("all");
  const fn = useServerFn(listAssets);
  const del = useServerFn(deleteAsset);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["studio", "assets", tab],
    queryFn: () => fn({ data: { kind: tab } }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "assets"] }),
  });

  const rows = (data ?? []) as AssetRow[];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["all", "image", "video"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-medium transition",
              tab === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "all" ? "Todos" : k === "image" ? "Imagens" : "Vídeos"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface-1 p-12 text-center">
          <p className="text-sm text-muted-foreground">Ainda não geraste nenhum criativo. Começa em <span className="text-foreground">IA de Imagens</span>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-black">
              {a.kind === "image" ? (
                <img src={a.thumb_url ?? a.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-surface-2">
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
                <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                  {a.kind === "image" ? <ImageIcon className="inline h-2.5 w-2.5" /> : <Film className="inline h-2.5 w-2.5" />} {a.style ?? ""}
                </span>
                <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">-{a.credits_used}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <a href={a.url} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white backdrop-blur hover:bg-white/20">
                  <Download className="h-2.5 w-2.5" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Eliminar este criativo?")) removeMut.mutate(a.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white backdrop-blur hover:bg-destructive/40"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
