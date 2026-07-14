import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Save, RotateCcw, PlayCircle } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { MediaField } from "@/components/mm/media-field";
import { courses } from "@/data/courses";
import {
  applyOverrides,
  loadOverrides,
  saveOverrides,
  type Overrides,
  type LessonOverride,
} from "@/data/admin-store";
import { parseVideoUrl } from "@/lib/video-source";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/aulas")({
  component: AdminAulas,
});

function AdminAulas() {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides());
  const [saved, setSaved] = useState(false);
  const [openCourse, setOpenCourse] = useState<string>(courses[0]?.id ?? "");

  const updateLesson = (id: string, patch: Partial<LessonOverride>) => {
    setOverrides((o) => ({
      ...o,
      lessons: { ...o.lessons, [id]: { ...o.lessons[id], ...patch } },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    const clean: Overrides = { courses: {}, experts: {}, lessons: {} };
    for (const [k, v] of Object.entries(overrides.courses)) clean.courses[k] = v;
    for (const [k, v] of Object.entries(overrides.experts)) clean.experts[k] = v;
    for (const [id, patch] of Object.entries(overrides.lessons)) {
      const filtered = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined && v !== ""),
      );
      if (Object.keys(filtered).length > 0) clean.lessons[id] = filtered;
    }
    saveOverrides(clean);
    applyOverrides(clean);
    setOverrides(clean);
    setSaved(true);
    router.invalidate();
    setTimeout(() => setSaved(false), 2200);
  };

  const handleReset = () => {
    const cleared: Overrides = { ...overrides, lessons: {} };
    saveOverrides(cleared);
    applyOverrides(cleared);
    setOverrides(cleared);
    router.invalidate();
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin › Aulas"
        title="Aulas e vídeos."
        description="Edita título, duração e vídeo de cada aula. Podes fazer upload do vídeo ou colar um link do YouTube, Vimeo ou Bunny."
      />

      <div className="sticky top-24 z-10 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Repor aulas
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          {saved ? "Guardado ✓" : "Guardar"}
        </button>
      </div>

      {/* Course tabs */}
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpenCourse(c.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs transition",
              openCourse === c.id
                ? "border-primary/50 bg-primary text-primary-foreground"
                : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
            )}
          >
            {c.title}
          </button>
        ))}
      </div>

      {courses
        .filter((c) => c.id === openCourse)
        .map((c) => (
          <div key={c.id} className="space-y-6">
            {(c.modules ?? []).map((m) => (
              <div key={m.id} className="rounded-2xl border border-border bg-surface-1 p-5">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  {m.title}
                </p>
                <div className="space-y-5">
                  {m.lessons.map((l) => {
                    const patch = overrides.lessons[l.id] ?? {};
                    const merged = { ...l, ...patch };
                    const src = parseVideoUrl(merged.videoUrl);
                    return (
                      <div
                        key={l.id}
                        className="rounded-xl border border-border bg-background p-4"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                            <PlayCircle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-sm font-semibold text-foreground">
                              {merged.title}
                            </p>
                            <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                              {l.id} · {src.kind !== "unknown" ? src.kind : "sem vídeo"}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <label className="md:col-span-2 block">
                            <span className={labelCls}>Título</span>
                            <input
                              className={inputCls}
                              value={patch.title ?? l.title}
                              onChange={(e) => updateLesson(l.id, { title: e.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className={labelCls}>Duração</span>
                            <input
                              className={inputCls}
                              placeholder="12m"
                              value={patch.duration ?? l.duration}
                              onChange={(e) => updateLesson(l.id, { duration: e.target.value })}
                            />
                          </label>
                        </div>

                        <div className="mt-3">
                          <MediaField
                            label="Vídeo da aula"
                            bucket="lesson-videos"
                            keyPrefix={`lessons/${c.id}/${l.id}`}
                            accept="video/*"
                            value={patch.videoUrl ?? l.videoUrl ?? ""}
                            onChange={(v) => updateLesson(l.id, { videoUrl: v })}
                            placeholder="Cola link (YouTube, Vimeo, Bunny) ou faz upload"
                            helper="Suporta YouTube, Vimeo, Bunny.net (iframe.mediadelivery.net) e ficheiros .mp4/.webm."
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {!c.modules?.length && (
              <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-6 text-sm text-muted-foreground">
                Este curso ainda não tem módulos definidos.
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80";
