import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { getLessonTranscriptStatus } from "@/lib/lesson-knowledge.functions";

/**
 * Shows a live progress bar while a long lesson video is being transcribed in
 * blocks by the background worker (one cron tick per minute, 4 blocks/tick).
 */
export function TranscriptProgress({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const fetchStatus = useServerFn(getLessonTranscriptStatus);

  const { data } = useQuery({
    queryKey: ["lesson-transcript-status", courseId, lessonId],
    queryFn: () => fetchStatus({ data: { courseId, lessonId } }),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  if (!data) return null;
  const active = data.status === "partial" || data.status === "transcribing";
  if (!active) return null;

  const done = data.done ?? 0;
  const total = data.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
  const remaining = total > 0 ? Math.max(0, total - done) : null;
  const perTick = data.partsPerTick || 4;
  const etaMin = remaining != null ? Math.max(1, Math.ceil(remaining / perTick)) : null;

  return (
    <div className="shrink-0 rounded-xl bg-surface-2 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground sm:text-sm">
          A preparar a transcrição desta aula
        </p>
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className={
            pct == null
              ? "h-full w-1/3 animate-pulse rounded-full bg-primary"
              : "h-full rounded-full bg-primary transition-all duration-500"
          }
          style={pct == null ? undefined : { width: `${pct}%` }}
        />
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground sm:text-xs">
        {pct == null ? (
          "A dividir o vídeo em blocos…"
        ) : (
          <>
            Bloco {done}/{total} ({pct}%)
            {etaMin != null ? ` · ~${etaMin} min restantes` : ""}
          </>
        )}
      </p>
    </div>
  );
}
