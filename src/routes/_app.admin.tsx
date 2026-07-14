import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Save, RotateCcw, ImageIcon, Sparkles, UserCircle2 } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { courses } from "@/data/courses";
import { expertsById } from "@/data/experts";
import {
  applyOverrides,
  loadOverrides,
  saveOverrides,
  type Overrides,
  type CourseOverride,
  type ExpertOverride,
} from "@/data/admin-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin — MM Club" },
      { name: "description", content: "Painel de administração do MM Club." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
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

  const handleSave = () => {
    const clean: Overrides = { courses: {}, experts: {} };
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
    setOverrides(clean);
    setSaved(true);
    router.invalidate();
    setTimeout(() => setSaved(false), 2200);
  };

  const handleReset = () => {
    const empty: Overrides = { courses: {}, experts: {} };
    saveOverrides(empty);
    applyOverrides(empty);
    setOverrides(empty);
    router.invalidate();
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin"
        title="Gestão de cursos."
        description="Edita capa, logotipo, título, descrição e especialista de cada curso. As alterações aplicam-se em tempo real."
      />

      <div className="sticky top-24 z-10 flex items-center justify-end gap-2">
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
          {saved ? "Guardado ✓" : "Guardar"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {courses.map((c) => {
          const patch = overrides.courses[c.id] ?? {};
          const merged = { ...c, ...patch };
          const expert = expertsById[c.expertId];
          const ePatch = expert ? overrides.experts[expert.id] ?? {} : {};
          const eMerged = expert ? { ...expert, ...ePatch } : null;

          return (
            <div key={c.id} className="rounded-2xl border border-border bg-surface-1 p-5">
              {/* Preview header */}
              <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
                <div
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-[color:var(--hairline)]"
                  style={{ background: merged.cover }}
                >
                  {merged.logo && (
                    <img src={merged.logo} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.id}
                  </p>
                  <p className="truncate font-display text-sm font-semibold text-foreground">
                    {merged.title}
                  </p>
                  {eMerged && (
                    <p className="truncate text-xs text-muted-foreground">
                      Especialista:{" "}
                      <span className="text-foreground">{eMerged.name}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Course fields */}
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
                <Field
                  label="Capa (URL da imagem ou CSS background)"
                  icon={<ImageIcon className="h-3 w-3" />}
                >
                  <input
                    className={inputCls}
                    placeholder="https://... ou linear-gradient(...)"
                    value={patch.cover ?? c.cover}
                    onChange={(e) => updateCourse(c.id, { cover: e.target.value })}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Dica: para uma imagem cheia usa{" "}
                    <code className="text-foreground/70">
                      url(URL) center/cover no-repeat, #000
                    </code>
                  </p>
                </Field>
                <Field label="Logotipo (URL)" icon={<Sparkles className="h-3 w-3" />}>
                  <input
                    className={inputCls}
                    placeholder="https://..."
                    value={patch.logo ?? c.logo ?? ""}
                    onChange={(e) => updateCourse(c.id, { logo: e.target.value })}
                  />
                </Field>
              </div>

              {/* Expert fields (nested under the course) */}
              {expert && (
                <>
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
                      <Field label="Foto (URL ou gradient)">
                        <input
                          className={inputCls}
                          value={ePatch.photo ?? expert.photo}
                          onChange={(e) => updateExpert(expert.id, { photo: e.target.value })}
                        />
                      </Field>
                      <Field label="Logotipo do especialista (URL)">
                        <input
                          className={inputCls}
                          placeholder="https://..."
                          value={ePatch.logo ?? expert.logo ?? ""}
                          onChange={(e) => updateExpert(expert.id, { logo: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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
