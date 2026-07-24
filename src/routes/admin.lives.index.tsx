import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Copy, Plus, Trash2, Radio, Loader2, Video, Upload, CalendarClock, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import {
  adminListLives,
  adminCreateLive,
  adminDeleteLive,
  adminGetLiveIngest,
} from "@/lib/lives.functions";
import { uploadMedia } from "@/lib/media-upload";

type LiveRow = Awaited<ReturnType<typeof adminListLives>>[number];

export const Route = createFileRoute("/admin/lives/")({
  component: AdminLives,
});

function AdminLives() {
  const list = useServerFn(adminListLives);
  const create = useServerFn(adminCreateLive);
  const del = useServerFn(adminDeleteLive);
  const getIngest = useServerFn(adminGetLiveIngest);

  const [rows, setRows] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingest, setIngest] = useState<{ id: string; url: string; key: string } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "club" | "premium">("club");
  const [schedule, setSchedule] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list();
      setRows(r as LiveRow[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCoverUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadMedia("course-media", file, "lives-covers");
      setCoverUrl(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Adiciona um título.");
      return;
    }
    if (schedule && !startsAt) {
      setError("Escolhe a data e hora do agendamento.");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        starts_at: schedule ? new Date(startsAt).toISOString() : undefined,
        duration_minutes: schedule ? duration : 60,
        visibility,
        cover_url: coverUrl || undefined,
      };
      const res = await create({ data: payload });
      setIngest({ id: res.id, url: res.rtmps.url, key: res.rtmps.streamKey });
      // reset form
      setTitle("");
      setDescription("");
      setSchedule(false);
      setStartsAt("");
      setDuration(60);
      setCoverUrl("");
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleShowIngest(id: string) {
    setError(null);
    try {
      const r = await getIngest({ data: { id } });
      if (r?.cf_rtmps_url && r.cf_stream_key) {
        setIngest({ id, url: r.cf_rtmps_url, key: r.cf_stream_key });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Apagar esta live? Esta ação não pode ser desfeita.")) return;
    try {
      await del({ data: { id } });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin › Lives"
        title="Sessões ao vivo."
        description="Começa uma live imediatamente ou agenda com contador para a comunidade."
      />

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {ingest && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-primary">
            <Radio className="h-4 w-4" />
            <p className="font-display text-sm">Credenciais RTMPS (OBS → Serviços → Personalizado)</p>
          </div>
          <div className="mt-4 space-y-3">
            <IngestField label="Servidor RTMPS" value={ingest.url} />
            <IngestField label="Stream Key" value={ingest.key} secret />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Guarda estas credenciais em local seguro. A gravação é criada automaticamente quando terminares a transmissão.
          </p>
          <button
            type="button"
            onClick={() => setIngest(null)}
            className="mt-4 text-xs text-muted-foreground underline"
          >
            Fechar
          </button>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="space-y-5 rounded-2xl border border-border bg-surface-1 p-5"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Título da live</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ex.: Masterclass — como fechar €10k/mês"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Visibilidade</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm"
            >
              <option value="public">Aberta</option>
              <option value="club">MM Club</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Modo</label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-1">
              <ModeButton active={!schedule} onClick={() => setSchedule(false)} icon={<Radio className="h-3.5 w-3.5" />}>
                Começar agora
              </ModeButton>
              <ModeButton active={schedule} onClick={() => setSchedule(true)} icon={<CalendarClock className="h-3.5 w-3.5" />}>
                Agendar
              </ModeButton>
            </div>
          </div>
        </div>

        {schedule && (
          <div className="grid gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Data e hora</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required={schedule}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Duração (min)</label>
              <input
                type="number"
                min={5}
                max={600}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground md:col-span-2">
              Vai aparecer um contador ao vivo na home e na página de lives até ao início.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Capa</label>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-1">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 px-2 text-center text-[10px] text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span>Auto MM Club</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              {coverUrl ? (
                <p className="truncate">Capa personalizada carregada.</p>
              ) : (
                <p>
                  Sem capa? Geramos automaticamente uma capa MM Club com o nome da live.
                  Podes carregar a tua se preferires.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCoverUpload(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs hover:border-primary/40 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {coverUrl ? "Trocar" : "Carregar capa"}
              </button>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCoverUrl("");
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="text-[11px] text-muted-foreground underline"
                >
                  Usar auto
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">
            Descrição (opcional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {schedule ? "Agendar live" : "Criar e começar"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-surface-1">
        <div className="border-b border-border px-5 py-3">
          <p className="font-display text-sm">Lives programadas</p>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">A carregar…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Ainda não criaste nenhuma live.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(r.starts_at).toLocaleString("pt-PT")} · {r.duration_minutes}m · {r.visibility} · {r.status}
                  </p>
                </div>
                <Link
                  to="/admin/lives/$liveId/studio"
                  params={{ liveId: r.id }}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Video className="h-3 w-3" /> Transmitir do navegador
                </Link>
                <button
                  type="button"
                  onClick={() => handleShowIngest(r.id)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
                >
                  Ver RTMPS
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3 w-3" /> Apagar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      {children}
    </button>
  );
}

function IngestField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(!secret);
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs">
          {revealed ? value : "•".repeat(Math.min(value.length, 32))}
        </code>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="text-[11px] text-muted-foreground underline"
          >
            {revealed ? "Ocultar" : "Mostrar"}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(value)}
          className="inline-flex items-center gap-1 text-[11px] text-primary"
        >
          <Copy className="h-3 w-3" /> Copiar
        </button>
      </div>
    </div>
  );
}
