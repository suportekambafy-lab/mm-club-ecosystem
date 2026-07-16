import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Copy, Plus, Trash2, Radio, Loader2, Video } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import {
  adminListLives,
  adminCreateLive,
  adminDeleteLive,
  adminGetLiveIngest,
} from "@/lib/lives.functions";

type LiveRow = Awaited<ReturnType<typeof adminListLives>>[number];

export const Route = createFileRoute("/admin/lives")({
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

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || undefined,
      expert_id: String(fd.get("expert_id") ?? "") || undefined,
      starts_at: new Date(String(fd.get("starts_at"))).toISOString(),
      duration_minutes: Number(fd.get("duration_minutes") ?? 60),
      visibility: (fd.get("visibility") as "public" | "club" | "premium") ?? "club",
      cover_url: String(fd.get("cover_url") ?? "") || undefined,
    };
    setCreating(true);
    try {
      const res = await create({ data: payload });
      setIngest({ id: res.id, url: res.rtmps.url, key: res.rtmps.streamKey });
      (e.target as HTMLFormElement).reset();
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
        description="Programa lives e obtém as credenciais RTMPS para o OBS."
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
        className="grid gap-4 rounded-2xl border border-border bg-surface-1 p-5 md:grid-cols-2"
      >
        <Field label="Título" name="title" required />
        <Field label="ID do especialista (opcional)" name="expert_id" />
        <Field label="Data e hora" name="starts_at" type="datetime-local" required />
        <Field label="Duração (min)" name="duration_minutes" type="number" defaultValue="60" required />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Visibilidade</label>
          <select
            name="visibility"
            defaultValue="club"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            <option value="public">Aberta</option>
            <option value="club">MM Club</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <Field label="Cover URL (opcional)" name="cover_url" />
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Descrição</label>
          <textarea
            name="description"
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar live
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

function Field(props: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{props.label}</label>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        defaultValue={props.defaultValue}
        className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
      />
    </div>
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
