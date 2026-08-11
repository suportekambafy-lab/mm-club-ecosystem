import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Play, X } from "lucide-react";
import { fetchLinkPreview } from "@/lib/link-preview.functions";

const URL_RE = /https?:\/\/[^\s<>()"']+/i;

/** Extrai o primeiro URL de um texto (para pré-visualização). */
export function extractFirstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  if (!m) return null;
  return m[0].replace(/[.,;:!?)\]]+$/, "");
}

interface Props {
  url: string;
  /** Mostra botão de remover (usado no editor). */
  onRemove?: () => void;
  className?: string;
}

export function LinkPreview({ url, onRemove, className }: Props) {
  const [playing, setPlaying] = useState(false);
  const { data } = useQuery({
    queryKey: ["link-preview", url],
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: () => fetchLinkPreview({ data: { url } }),
  });

  if (!data) return null;

  const host = (() => {
    try {
      return new URL(data.url).hostname.replace(/^www\./, "");
    } catch {
      return data.siteName ?? "";
    }
  })();

  return (
    <div
      className={`relative mt-3 overflow-hidden rounded-xl border border-border bg-surface-2 ${className ?? ""}`}
    >
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover pré-visualização"
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition hover:bg-background"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {data.kind === "youtube" && data.embedUrl && playing ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={`${data.embedUrl}&autoplay=1`}
            title={data.title ?? "Vídeo"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      ) : data.image ? (
        <button
          type="button"
          onClick={() => {
            if (data.kind === "youtube" && data.embedUrl) setPlaying(true);
            else window.open(data.url, "_blank", "noopener,noreferrer");
          }}
          className="group relative block w-full"
        >
          <img
            loading="lazy"
            decoding="async"
            src={data.image}
            alt={data.title ?? ""}
            className="aspect-video w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {data.kind === "youtube" && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/70 backdrop-blur transition group-hover:scale-105">
                <Play className="ml-0.5 h-6 w-6 text-foreground" />
              </span>
            </span>
          )}
        </button>
      ) : null}

      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-3.5 py-3 transition hover:bg-surface-1"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {data.siteName ?? host}
          <ExternalLink className="h-3 w-3" />
        </span>
        {data.title && (
          <span className="mt-1 block line-clamp-2 text-sm font-semibold text-foreground">
            {data.title}
          </span>
        )}
        {data.description && (
          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
            {data.description}
          </span>
        )}
      </a>
    </div>
  );
}
