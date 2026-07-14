import { useRef, useState } from "react";
import { Upload, Link as LinkIcon, X } from "lucide-react";
import { uploadMedia, type MediaBucket } from "@/lib/media-upload";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  bucket: MediaBucket;
  keyPrefix: string; // e.g. "courses/marca-milionaria/cover"
  value: string; // current URL or CSS background
  onChange: (value: string) => void;
  accept?: string; // e.g. "image/*" or "video/*"
  allowLink?: boolean; // show URL input alongside upload
  placeholder?: string;
  helper?: string;
}

export function MediaField({
  label,
  bucket,
  keyPrefix,
  value,
  onChange,
  accept = "image/*",
  allowLink = true,
  placeholder,
  helper,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const { url } = await uploadMedia(bucket, file, keyPrefix);
      onChange(url);
    } catch (e) {
      setErr((e as Error).message ?? "Falha no upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
        {label}
      </span>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/40 disabled:opacity-50",
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            {busy ? "A enviar…" : "Upload de ficheiro"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-2 text-xs text-muted-foreground transition hover:text-foreground"
              title="Limpar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {allowLink && (
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-9 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              placeholder={placeholder ?? "Cola um URL (YouTube, Vimeo, Bunny, .mp4…)"}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        )}

        {helper && <p className="text-[10px] text-muted-foreground">{helper}</p>}
        {err && <p className="text-[11px] text-destructive">{err}</p>}
      </div>
    </div>
  );
}
