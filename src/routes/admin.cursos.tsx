import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Save, RotateCcw, UserCircle2, Sparkles, Loader2, CalendarClock, Plus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminGenerateCourseCover } from "@/lib/course-cover.functions";
import { SectionHeading } from "@/components/mm/section-heading";
import { MediaField } from "@/components/mm/media-field";
import { courses, coursesById, formatCourseRelease } from "@/data/courses";
import { expertsById } from "@/data/experts";
import {
  applyOverrides,
  loadOverrides,
  saveOverrides,
  pushOverridesToServer,
  type Overrides,
  type CourseOverride,
  type ExpertOverride,
} from "@/data/admin-store";
import type { Course } from "@/data/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/cursos")({
  component: AdminCursos,
});

function AdminCursos() {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides());
  const [saved, setSaved] = useState(false);

  const updateCourse = (id: string, patch: Partial<CourseOverride>) => {
    setOverrides((o) => ({
      ...o,
      courses: { ...o.courses, [id]: { ...o.courses[id], ...patch } },
    }));
    setSaved(false);
  };
  const updateExpert = (id: string, patch: Partial<ExpertOverride>) => {
    setOverrides((o) => ({
      ...o,
      experts: { ...o.experts, [id]: { ...o.experts[id], ...patch } },
    }));
    setSaved(false);
  };

  /**
   * Especialistas são individuais por curso: se o especialista atual for
   * partilhado por mais do que um curso, criamos uma cópia exclusiva deste
   * curso antes de aplicar a edição (evita alterar os dois ao mesmo tempo).
   */
  const updateCourseExpert = (
    courseId: string,
    expert: Expert,
    patch: Partial<ExpertOverride>,
  ) => {
    setOverrides((o) => {
      const effectiveExpertId = (cid: string, base: string) => o.courses[cid]?.expertId ?? base;
      const sharedBy = courses.filter(
        (c) => effectiveExpertId(c.id, c.expertId) === expert.id,
      ).length;

      if (sharedBy <= 1) {
        return {
          ...o,
          experts: { ...o.experts, [expert.id]: { ...o.experts[expert.id], ...patch } },
        };
      }

      // Fork: novo especialista só para este curso.
      const forkId = `${expert.id}--${courseId}`;
      const merged = { ...expert, ...(o.experts[expert.id] ?? {}) };
      const fork: Expert = { ...merged, id: forkId, ...patch };
      const existing = (o.newExperts ?? []).some((e) => e.id === forkId);
      return {
        ...o,
        newExperts: existing
          ? (o.newExperts ?? []).map((e) => (e.id === forkId ? fork : e))
          : [...(o.newExperts ?? []), fork],
        courses: { ...o.courses, [courseId]: { ...o.courses[courseId], expertId: forkId } },
      };
    });
    setSaved(false);
  };


  // ------ Criar / remover cursos ------
  const customIds = new Set((overrides.newCourses ?? []).map((c) => c.id));

  const addCourse = () => {
    const title = window.prompt("Título do novo curso");
    if (!title?.trim()) return;
    const slug =
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "curso";
    const id = coursesById[slug] ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;
    const next: Course = {
      id,
      title: title.trim(),
      tagline: "",
      description: "",
      objectiveId: "criar-negocio",
      expertId: courses[0]?.expertId ?? "founder",
      duration: "0m",
      lessonsCount: 0,
      progress: 0,
      visibility: "club",
      cover: "linear-gradient(135deg, #111 0%, #2a2a2a 100%)",
      modules: [],
    };
    setOverrides((o) => ({ ...o, newCourses: [...(o.newCourses ?? []), next] }));
    setSaved(false);
    toast.success(`Curso "${next.title}" criado. Adiciona os módulos em Admin › Aulas.`);
  };

  const removeCourse = (id: string) => {
    if (!window.confirm("Remover este curso e todo o seu conteúdo?")) return;
    setOverrides((o) => {
      const rest = { ...o.modulesByCourse };
      delete rest[id];
      const nextCourses = { ...o.courses };
      delete nextCourses[id];
      return {
        ...o,
        courses: nextCourses,
        modulesByCourse: rest,
        newCourses: (o.newCourses ?? []).filter((c) => c.id !== id),
      };
    });
    setSaved(false);
  };

  // Autosave — persist every edit to localStorage + apply immediately.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      const clean: Overrides = {
        courses: {},
        experts: {},
        lessons: overrides.lessons,
        modulesByCourse: overrides.modulesByCourse,
        newCourses: overrides.newCourses ?? [],
      };
      for (const [id, patch] of Object.entries(overrides.courses)) {
        const filtered = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined && v !== ""),
        );
        if (Object.keys(filtered).length > 0) clean.courses[id] = filtered;
      }
      for (const [id, patch] of Object.entries(overrides.experts)) {
        const filtered = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined && v !== ""),
        );
        if (Object.keys(filtered).length > 0) clean.experts[id] = filtered;
      }
      saveOverrides(clean);
      applyOverrides(clean);
      void pushOverridesToServer(clean);
      setSaved(true);
      const clear = setTimeout(() => setSaved(false), 1500);
      return () => clearTimeout(clear);
    }, 400);
    return () => clearTimeout(t);
  }, [overrides]);

  const handleSave = () => {
    const clean: Overrides = {
      courses: {},
      experts: {},
      lessons: overrides.lessons,
      modulesByCourse: overrides.modulesByCourse,
      newCourses: overrides.newCourses ?? [],
    };
    for (const [id, patch] of Object.entries(overrides.courses)) {
      const filtered = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined && v !== ""),
      );
      if (Object.keys(filtered).length > 0) clean.courses[id] = filtered;
    }
    for (const [id, patch] of Object.entries(overrides.experts)) {
      const filtered = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined && v !== ""),
      );
      if (Object.keys(filtered).length > 0) clean.experts[id] = filtered;
    }
    saveOverrides(clean);
    applyOverrides(clean);
    void pushOverridesToServer(clean);
    setOverrides(clean);
    setSaved(true);
    router.invalidate();
    setTimeout(() => setSaved(false), 2200);
  };

  const handleReset = () => {
    const empty: Overrides = { courses: {}, experts: {}, lessons: {}, modulesByCourse: {}, newCourses: overrides.newCourses ?? [] };
    saveOverrides(empty);
    applyOverrides(empty);
    void pushOverridesToServer(empty);
    setOverrides(empty);
    router.invalidate();
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin › Cursos"
        title="Gestão de cursos."
        description="Edita capa, logotipo, título, descrição e especialista de cada curso."
      />

      <div className="sticky top-24 z-10 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={addCourse}
          className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo curso
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Repor
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          {saved ? "Guardado ✓" : "Guarda automaticamente"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {courses.map((c) => {
          const patch = overrides.courses[c.id] ?? {};
          const merged = { ...c, ...patch };
          const expert = expertsById[c.expertId];
          const ePatch = expert ? overrides.experts[expert.id] ?? {} : {};

          return (
            <div key={c.id} className="rounded-2xl border border-border bg-surface-1 p-5">
              <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
                <div
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-[color:var(--hairline)]"
                  style={{ background: merged.cover }}
                >
                  {merged.logo && (
                    <img loading="lazy" decoding="async" src={merged.logo} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.id}
                  </p>
                  <p className="truncate font-display text-sm font-semibold text-foreground">
                    {merged.title}
                  </p>
                </div>
                {customIds.has(c.id) && (
                  <button
                    type="button"
                    onClick={() => removeCourse(c.id)}
                    title="Remover curso"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <SectionLabel>Curso</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Título">
                  <input
                    className={inputCls}
                    value={patch.title ?? c.title}
                    onChange={(e) => updateCourse(c.id, { title: e.target.value })}
                  />
                </Field>
                <Field label="Tagline">
                  <input
                    className={inputCls}
                    value={patch.tagline ?? c.tagline}
                    onChange={(e) => updateCourse(c.id, { tagline: e.target.value })}
                  />
                </Field>
                <Field label="Descrição">
                  <textarea
                    className={cn(inputCls, "min-h-[80px] resize-y")}
                    value={patch.description ?? c.description}
                    onChange={(e) => updateCourse(c.id, { description: e.target.value })}
                  />
                </Field>
                <Field label="Duração">
                  <input
                    className={inputCls}
                    value={patch.duration ?? c.duration}
                    onChange={(e) => updateCourse(c.id, { duration: e.target.value })}
                  />
                </Field>
                <Field label="Agendamento (data de lançamento)" icon={<CalendarClock className="h-3 w-3" />}>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={toLocalInput(patch.releaseAt ?? c.releaseAt)}
                    onChange={(e) =>
                      updateCourse(c.id, { releaseAt: fromLocalInput(e.target.value) })
                    }
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {(patch.releaseAt ?? c.releaseAt)
                      ? `Fica bloqueado como “Em breve” até ${formatCourseRelease({ ...c, releaseAt: patch.releaseAt ?? c.releaseAt })}.`
                      : "Sem data: o curso está disponível de imediato."}
                  </span>
                </Field>
                <MediaField
                  label="Capa do curso"
                  bucket="course-media"
                  keyPrefix={`courses/${c.id}/cover`}
                  accept="image/*"
                  value={patch.cover ?? c.cover}
                  onChange={(v) => updateCourse(c.id, { cover: v })}
                  placeholder="URL da imagem, gradient CSS, ou usa Upload"
                  helper="Para uma imagem em ecrã completo usa: url(URL) center/cover no-repeat, #000"
                />
                <CourseCoverGenerator
                  courseId={c.id}
                  title={patch.title ?? c.title}
                  tagline={patch.tagline ?? c.tagline}
                  onGenerated={(css) => updateCourse(c.id, { cover: css })}
                />
                <MediaField
                  label="Logotipo do curso"
                  bucket="course-media"
                  keyPrefix={`courses/${c.id}/logo`}
                  accept="image/*"
                  value={patch.logo ?? c.logo ?? ""}
                  onChange={(v) => updateCourse(c.id, { logo: v })}
                  placeholder="URL do logotipo"
                />
              </div>


              {expert && (
                <div className="mt-6 border-t border-border pt-4">
                  <SectionLabel icon={<UserCircle2 className="h-3 w-3" />}>
                    Especialista
                  </SectionLabel>
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Nome do especialista">
                      <input
                        className={inputCls}
                        value={ePatch.name ?? expert.name}
                        onChange={(e) => updateExpert(expert.id, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Função / Cargo">
                      <input
                        className={inputCls}
                        value={ePatch.role ?? expert.role}
                        onChange={(e) => updateExpert(expert.id, { role: e.target.value })}
                      />
                    </Field>
                    <Field label="Sobre o especialista">
                      <textarea
                        className={cn(inputCls, "min-h-[70px] resize-y")}
                        value={ePatch.shortBio ?? expert.shortBio}
                        onChange={(e) => updateExpert(expert.id, { shortBio: e.target.value })}
                      />
                    </Field>
                    <MediaField
                      label="Foto do especialista"
                      bucket="course-media"
                      keyPrefix={`experts/${expert.id}/photo`}
                      accept="image/*"
                      value={ePatch.photo ?? expert.photo}
                      onChange={(v) => updateExpert(expert.id, { photo: v })}
                      placeholder="URL da foto, gradient CSS, ou usa Upload"
                    />
                    <MediaField
                      label="Logotipo do especialista"
                      bucket="course-media"
                      keyPrefix={`experts/${expert.id}/logo`}
                      accept="image/*"
                      value={ePatch.logo ?? expert.logo ?? ""}
                      onChange={(v) => updateExpert(expert.id, { logo: v })}
                      placeholder="URL do logotipo"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CourseCoverGenerator({
  courseId,
  title,
  tagline,
  onGenerated,
}: {
  courseId: string;
  title: string;
  tagline?: string;
  onGenerated: (css: string) => void;
}) {
  const generate = useServerFn(adminGenerateCourseCover);
  const [authorImage, setAuthorImage] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await generate({
        data: {
          courseId,
          title,
          tagline: tagline || undefined,
          authorImageUrl: authorImage || undefined,
        },
      });
      onGenerated(res.css);
      toast.success("Capa gerada no design MM Club.");
    } catch (e) {
      toast.error((e as Error).message ?? "Falha ao gerar capa.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/25 bg-surface-2 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
        <Sparkles className="h-3 w-3" />
        Gerar capa com IA
      </p>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Adiciona a foto do autor e geramos uma capa cinematográfica no nosso design (fundo preto,
        luz dourada). Sem foto, geramos uma capa abstrata MM Club.
      </p>
      <MediaField
        label="Foto do autor (opcional)"
        bucket="course-media"
        keyPrefix={`courses/${courseId}/autor`}
        accept="image/*"
        value={authorImage}
        onChange={setAuthorImage}
        placeholder="URL da foto ou usa Upload"
      />
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {busy ? "A gerar capa…" : "Gerar capa MM Club"}
      </button>
    </div>
  );
}

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
      {icon}
      {children}
    </p>
  );
}
