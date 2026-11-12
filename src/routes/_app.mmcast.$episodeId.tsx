import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mic, UserRound } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineAlert } from "@/components/mm/inline-alert";
import {
  getMmcastEpisode,
  type MmcastEpisode,
} from "@/lib/mmcast.functions";

export const Route = createFileRoute("/_app/mmcast/$episodeId")({
  head: () => ({
    meta: [
      { title: "Episódio — MMCast" },
      {
        name: "description",
        content: "Assiste ao episódio completo do MMCast dentro do MM Club.",
      },
      { property: "og:title", content: "Episódio — MMCast" },
      {
        property: "og:description",
        content: "Assiste ao episódio completo do MMCast dentro do MM Club.",
      },
      { property: "og:type", content: "video.episode" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MmcastEpisodePage,
});

function MmcastEpisodePage() {
  const { episodeId } = Route.useParams();
  const [episode, setEpisode] = useState<MmcastEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMmcastEpisode({ data: { id: episodeId } })
      .then((ep) => {
        if (cancelled) return;
        setEpisode(ep);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erro ao carregar o episódio.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [episodeId, reloadKey]);

  if (loading) {
    return (
      <div className="section-stack">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="aspect-video w-full rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="section-stack">
        <BackLink />
        <InlineAlert
          surface="mmcast"
          onRetry={() => {
            setError(null);
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
        >
          {error ?? "Episódio não encontrado."}
        </InlineAlert>
      </div>
    );
  }

  const date = (() => {
    try {
      return format(
        new Date(episode.published_at ?? episode.created_at),
        "d 'de' MMMM 'de' yyyy",
        { locale: pt },
      );
    } catch {
      return "";
    }
  })();

  return (
    <div className="section-stack">
      <BackLink />

      {/* Player incorporado — o vídeo corre dentro do MM Club */}
      <div className="overflow-hidden rounded-3xl border border-border bg-black">
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${episode.youtube_video_id}?rel=0`}
            title={episode.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </div>

      <div className="px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
            Episódio {episode.episode_number}
          </span>
          {episode.category && (
            <span className="rounded-full border border-border bg-surface-1 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {episode.category}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>

        <h1 className="mt-3 font-display text-2xl leading-snug text-foreground md:text-3xl">
          {episode.title}
        </h1>

        {episode.guest_name && (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground/80">
            <UserRound className="h-4 w-4 text-primary" />
            Com {episode.guest_name}
          </p>
        )}

        {(episode.full_description || episode.short_description) && (
          <div className="mt-5 rounded-3xl border border-border bg-surface-1 p-5 md:p-6">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Mic className="h-4 w-4" />
              <p className="text-[10px] font-medium uppercase tracking-[0.24em]">
                Sobre este episódio
              </p>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {episode.full_description ?? episode.short_description}
            </p>
          </div>
        )}

        <div className="mt-5">
          <a
            href={episode.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Ver também no YouTube ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/mmcast"
      className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar à biblioteca MMCast
    </Link>
  );
}
