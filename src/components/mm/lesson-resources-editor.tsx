import { useRef, useState } from "react";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/media-upload";
import type { LessonLink, LessonMaterial } from "@/data/types";

const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80";
const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50";

export function LessonResourcesEditor({
  keyPrefix,
  description,
  links,
  materials,
  onChange,
}: {
  keyPrefix: string;
  description?: string;
  links?: LessonLink[];
  materials?: LessonMaterial[];
  onChange: (patch: {
    description?: string;
    links?: LessonLink[];
    materials?: LessonMaterial[];
  }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const ls = links ?? [];
  const ms = materials ?? [];

  const upload = async (files: FileList) => {
    setBusy(true);
    try {
      const added: LessonMaterial[] = [];
      for (const file of Array.from(files)) {
        const { url } = await uploadMedia(
          "course-media",
          file,
          `${keyPrefix}/materiais`,
          "document",
        );
        added.push({ name: file.name, url, size: file.size });
      }
      onChange({ materials: [...ms, ...added] });
      toast.success(
        added.length === 1 ? "Material adicionado" : `${added.length} materiais adicionados`,
      );
    } catch (e) {
      toast.error((e as Error).message ?? "Falha no upload");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-border/70 bg-surface-1 p-3.5">
      <label className="block">
        <span className={labelCls}>Descrição da aula</span>
        <textarea
          rows={4}
          className={`${inputCls} resize-y leading-relaxed`}
          value={description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="O que o aluno vai aprender nesta aula…"
        />
      </label>

      <div>
        <span className={labelCls}>Links</span>
        <div className="space-y-2">
          {ls.map((l, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <input
                className={`${inputCls} sm:w-1/3`}
                value={l.label ?? ""}
                placeholder="Nome do link"
                onChange={(e) => {
                  const next = ls.map((x, j) => (j === i ? { ...x, label: e.target.value } : x));
                  onChange({ links: next });
                }}
              />
              <input
                className={inputCls}
                value={l.url}
                placeholder="https://…"
                onChange={(e) => {
                  const next = ls.map((x, j) => (j === i ? { ...x, url: e.target.value } : x));
                  onChange({ links: next });
                }}
              />
              <button
                type="button"
                onClick={() => onChange({ links: ls.filter((_, j) => j !== i) })}
                title="Remover link"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ links: [...ls, { label: "", url: "" }] })}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Adicionar link
          </button>
        </div>
      </div>

      <div>
        <span className={labelCls}>Materiais (PDF, ZIP, DOC, XLS, PPT…)</span>
        <div className="space-y-2">
          {ms.map((m, i) => (
            <div
              key={`${m.url}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
            >
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                value={m.name}
                onChange={(e) => {
                  const next = ms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x));
                  onChange({ materials: next });
                }}
              />
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[11px] text-primary hover:underline"
              >
                Abrir
              </a>
              <button
                type="button"
                onClick={() => onChange({ materials: ms.filter((_, j) => j !== i) })}
                title="Remover material"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/40 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {busy ? "A enviar…" : "Upload de materiais"}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) void upload(files);
            }}
          />
        </div>
      </div>
    </div>
  );
}
