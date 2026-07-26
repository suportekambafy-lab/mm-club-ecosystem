import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, Loader2, AlertCircle, Clock, Search, Play } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { supabase } from "@/integrations/supabase/client";
import { courses } from "@/data/courses";
import { applyOverrides, loadOverrides } from "@/data/admin-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/transcricoes")({
  component: AdminTranscricoes,
});

type TranscriptRow = {
  course_id: string;
  lesson_id: string;
  course_title: string | null;
  lesson_title: string | null;
  status: string;
  language: string | null;
  model: string | null;
  error: string | null;
  duration_seconds: number | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
};

type Row = {
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  hasVideo: boolean;
  status: "ready" | "embedding" | "transcribing" | "error" | "pending";
  error: string | null;
  duration: number | null;
  updatedAt: string | null;
  createdAt: string | null;
  language: string | null;
  model: string | null;
};

type Filter = "all" | "ready" | "transcribing" | "embedding" | "error" | "pending";

function statusMeta(status: Row["status"]) {
  switch (status) {
    case "ready":
      return { label: "Concluída", icon: CheckCircle2, tone: "text-emerald-400", bg: "bg-emerald-500/10 ring-emerald-500/30" };
    case "embedding":
      return { label: "A indexar", icon: Loader2, tone: "text-sky-400", bg: "bg-sky-500/10 ring-sky-500/30", spin: true };
    case "transcribing":
      return { label: "A processar", icon: Loader2, tone: "text-admin-accent", bg: "bg-admin-accent/10 ring-admin-accent/30", spin: true };
    case "error":
      return { label: "Falhou", icon: AlertCircle, tone: "text-red-400", bg: "bg-red-500/10 ring-red-500/30" };
    case "pending":
    default:
      return { label: "Pendente", icon: Clock, tone: "text-muted-foreground", bg: "bg-muted/30 ring-[color:var(--hairline)]" };
  }
}

function formatDuration(s: number | null) {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function AdminTranscricoes() {
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [overridesLoaded, setOverridesLoaded] = useState(false);

  useEffect(() => {
    applyOverrides(loadOverrides());
    setOverridesLoaded(true);
  }, []);

  const fetchRows = async () => {
    const { data, error } = await supabase
      .from("lesson_transcripts")
      .select("course_id,lesson_id,course_title,lesson_title,status,language,model,error,duration_seconds,video_url,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (!error && data) setRows(data as TranscriptRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel("admin-transcricoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_transcripts" }, () => fetchRows())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const merged: Row[] = useMemo(() => {
    if (!overridesLoaded) return [];
    const map = new Map<string, TranscriptRow>();
    for (const r of rows) map.set(`${r.course_id}::${r.lesson_id}`, r);

    const list: Row[] = [];
    for (const c of courses) {
      for (const mod of c.modules ?? []) {
        for (const l of mod.lessons) {
          const key = `${c.id}::${l.id}`;
          const t = map.get(key);
          const hasVideo = Boolean(l.videoUrl);
          list.push({
            courseId: c.id,
            lessonId: l.id,
            courseTitle: c.title,
            lessonTitle: l.title,
            hasVideo,
            status: (t?.status as Row["status"]) ?? "pending",
            error: t?.error ?? null,
            duration: t?.duration_seconds ?? null,
            updatedAt: t?.updated_at ?? null,
            createdAt: t?.created_at ?? null,
            language: t?.language ?? null,
            model: t?.model ?? null,
          });
          map.delete(key);
        }
      }
    }
    // Orphan transcripts (lesson removed from data)
    for (const t of map.values()) {
      list.push({
        courseId: t.course_id,
        lessonId: t.lesson_id,
        courseTitle: t.course_title ?? t.course_id,
        lessonTitle: (t.lesson_title ?? t.lesson_id) + " (removida)",
        hasVideo: Boolean(t.video_url),
        status: (t.status as Row["status"]) ?? "pending",
        error: t.error,
        duration: t.duration_seconds,
        updatedAt: t.updated_at,
        createdAt: t.created_at,
        language: t.language,
        model: t.model,
      });
    }
    // Sort: processing → error → pending → ready
    const order: Record<Row["status"], number> = { transcribing: 0, embedding: 1, error: 2, pending: 3, ready: 4 };
    list.sort((a, b) => {
      const d = order[a.status] - order[b.status];
      if (d !== 0) return d;
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });
    return list;
  }, [rows, overridesLoaded]);

  const counts = useMemo(() => {
    const c = { total: merged.length, ready: 0, transcribing: 0, embedding: 0, error: 0, pending: 0 };
    for (const r of merged) c[r.status] += 1;
    return c;
  }, [merged]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return merged.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!needle) return true;
      return (
        r.lessonTitle.toLowerCase().includes(needle) ||
        r.courseTitle.toLowerCase().includes(needle) ||
        r.lessonId.toLowerCase().includes(needle)
      );
    });
  }, [merged, filter, q]);

  const refresh = () => {
    setRefreshing(true);
    fetchRows();
  };

  const chips: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: "Todas", count: counts.total },
    { id: "transcribing", label: "A processar", count: counts.transcribing },
    { id: "embedding", label: "A indexar", count: counts.embedding },
    { id: "error", label: "Falhou", count: counts.error },
    { id: "pending", label: "Pendente", count: counts.pending },
    { id: "ready", label: "Concluída", count: counts.ready },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="MM Intelligence"
          title="Estado das transcrições"
          description="Cada aula com vídeo é transcrita e indexada automaticamente em segundo plano."
        />
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {chips.map((c) => {
          const meta = c.id === "all" ? null : statusMeta(c.id as Row["status"]);
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={cn(
                "rounded-2xl border border-border bg-surface-1 p-4 text-left transition hover:bg-surface-2",
                active && "ring-2 ring-primary/50",
              )}
            >
              <div className="flex items-center gap-2">
                {meta && <meta.icon className={cn("h-3.5 w-3.5", meta.tone, meta.spin && "animate-spin")} />}
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{c.count}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar por aula ou curso…"
          className="w-full rounded-full border border-border bg-surface-1 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-1">
        <div className="hidden grid-cols-[minmax(0,1fr)_140px_100px_120px_170px] gap-4 border-b border-border px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:grid">
          <span>Aula</span>
          <span>Estado</span>
          <span>Duração</span>
          <span>Modelo</span>
          <span>Atualizado</span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">A carregar…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma aula neste filtro.</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const meta = statusMeta(r.status);
              return (
                <li
                  key={`${r.courseId}::${r.lessonId}`}
                  className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_140px_100px_120px_170px] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {r.hasVideo ? (
                        <Play className="h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                      )}
                      <p className="truncate text-sm font-medium">{r.lessonTitle}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.courseTitle} · <span className="font-mono">{r.lessonId}</span>
                    </p>
                    {r.error && (
                      <p className="mt-1 line-clamp-2 rounded-md bg-red-500/5 px-2 py-1 text-[11px] text-red-300/90">
                        {r.error}
                      </p>
                    )}
                  </div>
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                        meta.bg,
                        meta.tone,
                      )}
                    >
                      <meta.icon className={cn("h-3 w-3", meta.spin && "animate-spin")} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDuration(r.duration)}</div>
                  <div className="text-xs text-muted-foreground">{r.model ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    <div>{formatDate(r.updatedAt)}</div>
                    {r.createdAt && r.createdAt !== r.updatedAt && (
                      <div className="text-[10px] opacity-70">criado {formatDate(r.createdAt)}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Atualiza automaticamente a cada 15 segundos e em tempo real via realtime.
      </p>
    </div>
  );
}
