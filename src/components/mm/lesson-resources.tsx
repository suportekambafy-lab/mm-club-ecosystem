import {
  FileText,
  FileArchive,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  ExternalLink,
  Link2,
} from "lucide-react";
import type { LessonLink, LessonMaterial } from "@/data/types";

function iconFor(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return FileText;
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return FileArchive;
  if (/\.(xls|xlsx|csv|numbers)$/.test(n)) return FileSpreadsheet;
  if (/\.(doc|docx|txt|rtf|pages|key|ppt|pptx)$/.test(n)) return FileText;
  return FileIcon;
}

function prettySize(bytes?: number) {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function LessonResources({
  description,
  links,
  materials,
}: {
  description?: string;
  links?: LessonLink[];
  materials?: LessonMaterial[];
}) {
  const cleanLinks = (links ?? []).filter((l) => l.url?.trim());
  const cleanMaterials = (materials ?? []).filter((m) => m.url?.trim());
  const desc = (description ?? "").trim();

  if (!desc && !cleanLinks.length && !cleanMaterials.length) return null;

  return (
    <section className="mt-3 space-y-3">
      {desc && (
        <div className="rounded-2xl bg-surface-2 p-3.5 sm:p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Sobre esta aula
          </h2>
          <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {desc.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}

      {!!cleanMaterials.length && (
        <div className="rounded-2xl bg-surface-2 p-3.5 sm:p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Materiais da aula
          </h2>
          <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cleanMaterials.map((m, i) => {
              const Icon = iconFor(m.name || m.url);
              const size = prettySize(m.size);
              return (
                <li key={`${m.url}-${i}`} className="min-w-0">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface-1 px-3 py-2.5 transition hover:border-primary/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {m.name || "Ficheiro"}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {size ? `Descarregar · ${size}` : "Descarregar"}
                      </span>
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!!cleanLinks.length && (
        <div className="rounded-2xl bg-surface-2 p-3.5 sm:p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Links úteis
          </h2>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {cleanLinks.map((l, i) => (
              <li key={`${l.url}-${i}`} className="min-w-0 max-w-full">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-2 text-[12px] font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{l.label?.trim() || l.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
