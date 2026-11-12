import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Eye,
  Mic,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  adminDeleteMmcastEpisode,
  adminListMmcastEpisodes,
  adminSaveMmcastEpisode,
  adminSetMmcastStatus,
  extractYoutubeId,
  youtubeThumbnail,
  type MmcastEpisode,
} from "@/lib/mmcast.functions";

export const Route = createFileRoute("/admin/mmcast")({
  head: () => ({
    meta: [
      { title: "MMCast — Admin MM Club" },
      { name: "description", content: "Gestão dos episódios do MMCast." },
    ],
  }),
  component: AdminMmcastPage,
});

type FormState = {
  episode_number: string;
  title: string;
  guest_name: string;
  youtube_url: string;
  thumbnail_url: string;
  short_description: string;
  full_description: string;
  category: string;
  published_at: string;
};

const emptyForm: FormState = {
  episode_number: "",
  title: "",
  guest_name: "",
  youtube_url: "",
  thumbnail_url: "",
  short_description: "",
  full_description: "",
  category: "",
  published_at: "",
};

function toForm(ep: MmcastEpisode): FormState {
  return {
    episode_number: String(ep.episode_number),
    title: ep.title,
    guest_name: ep.guest_name ?? "",
    youtube_url: ep.youtube_url,
    thumbnail_url: ep.thumbnail_url ?? "",
    short_description: ep.short_description ?? "",
    full_description: ep.full_description ?? "",
    category: ep.category ?? "",
    published_at: ep.published_at ? ep.published_at.slice(0, 16) : "",
  };
}

function AdminMmcastPage() {
  const [episodes, setEpisodes] = useState<MmcastEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MmcastEpisode | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [publishTarget, setPublishTarget] = useState<MmcastEpisode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MmcastEpisode | null>(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setEpisodes(await adminListMmcastEpisodes());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar episódios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    const nextNumber =
      episodes.reduce((max, e) => Math.max(max, e.episode_number), 0) + 1;
    setForm({ ...emptyForm, episode_number: String(nextNumber) });
    setFormOpen(true);
  };

  const openEdit = (ep: MmcastEpisode) => {
    setEditing(ep);
    setForm(toForm(ep));
    setFormOpen(true);
  };

  const videoId = extractYoutubeId(form.youtube_url);
  const effectiveThumb = form.thumbnail_url.trim() || (videoId ? youtubeThumbnail(videoId) : "");

  const save = async () => {
    const number = Number(form.episode_number);
    if (!Number.isInteger(number) || number < 1) {
      toast.error("Indica um número de episódio válido.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("O título é obrigatório.");
      return;
    }
    if (!videoId) {
      toast.error("Não consegui extrair o ID do vídeo desse URL do YouTube.");
      return;
    }
    setSaving(true);
    try {
      await adminSaveMmcastEpisode({
        data: {
          id: editing?.id,
          episode_number: number,
          title: form.title,
          guest_name: form.guest_name || null,
          youtube_url: form.youtube_url,
          youtube_video_id: videoId,
          thumbnail_url: form.thumbnail_url || null,
          short_description: form.short_description || null,
          full_description: form.full_description || null,
          category: form.category || null,
          published_at: form.published_at
            ? new Date(form.published_at).toISOString()
            : null,
        },
      });
      toast.success(editing ? "Episódio atualizado." : "Episódio criado em rascunho.");
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  };

  const confirmPublish = async () => {
    if (!publishTarget) return;
    setActing(true);
    try {
      const res = await adminSetMmcastStatus({
        data: { id: publishTarget.id, publish: true },
      });
      toast.success(
        res.notified > 0
          ? `Episódio publicado — ${res.notified} alunos notificados.`
          : "Episódio publicado.",
      );
      setPublishTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setActing(false);
    }
  };

  const unpublish = async (ep: MmcastEpisode) => {
    setActing(true);
    try {
      await adminSetMmcastStatus({ data: { id: ep.id, publish: false } });
      toast.success("Episódio despublicado — já não aparece aos alunos.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível despublicar.");
    } finally {
      setActing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActing(true);
    try {
      await adminDeleteMmcastEpisode({ data: { id: deleteTarget.id } });
      toast.success("Episódio eliminado.");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível eliminar.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Mic className="h-4 w-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.24em]">
              Podcast oficial
            </p>
          </div>
          <h1 className="mt-1 font-display text-2xl text-foreground">MMCast</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cria, edita e publica episódios. Ao publicar, todos os alunos ativos
            são notificados.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Adicionar episódio
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : episodes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface-1 px-6 py-16 text-center">
          <Mic className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Ainda não há episódios. Cria o primeiro.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {episodes.map((ep) => (
            <li
              key={ep.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4 sm:flex-row sm:items-center"
            >
              <div className="relative h-20 w-full shrink-0 overflow-hidden rounded-xl sm:w-36">
                {ep.thumbnail_url ? (
                  <img
                    src={ep.thumbnail_url}
                    alt={ep.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-2 text-muted-foreground">
                    <Mic className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-primary">
                    EP {ep.episode_number}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      ep.status === "published"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-amber-500/15 text-amber-500",
                    )}
                  >
                    {ep.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                  {ep.published_at && (
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(ep.published_at), "d MMM yyyy", { locale: pt })}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-1 font-medium text-foreground">
                  {ep.title}
                </p>
                {ep.guest_name && (
                  <p className="text-xs text-muted-foreground">
                    Com {ep.guest_name}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ep.status === "published" && (
                  <a
                    href={`/mmcast/${ep.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(ep)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                {ep.status === "published" ? (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => void unpublish(ep)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-500 transition hover:bg-amber-500/10"
                  >
                    <UploadCloud className="h-3.5 w-3.5 rotate-180" /> Despublicar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPublishTarget(ep)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    <Upload className="h-3.5 w-3.5" /> Publicar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(ep)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Formulário criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar episódio ${editing.episode_number}` : "Adicionar novo episódio"}
            </DialogTitle>
            <DialogDescription>
              O episódio fica em rascunho até ser publicado. Só então os alunos
              são notificados.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">Número do episódio</span>
              <input
                type="number"
                min={1}
                value={form.episode_number}
                onChange={(e) => setForm({ ...form, episode_number: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm outline-none focus:border-primary/50"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">Categoria</span>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Empreendedorismo"
                className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm outline-none focus:border-primary/50"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-foreground">Título do episódio</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm outline-none focus:border-primary/50"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-foreground">Nome do convidado</span>
              <input
                type="text"
                value={form.guest_name}
                onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm outline-none focus:border-primary/50"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-foreground">URL do vídeo do YouTube</span>
              <input
                type="url"
                value={form.youtube_url}
                onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=…"
                className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm outline-none focus:border-primary/50"
              />
              {videoId && (
                <p className="text-[11px] text-muted-foreground">
                  ID do vídeo detetado: <span className="font-mono">{videoId}</span>
                </p>
              )}
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-foreground">
                URL da thumbnail <span className="text-muted-foreground">(vazio = automática do YouTube)</span>
              </span>
              <input
                type="url"
                value={form.thumbnail_url}
                onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm outline-none focus:border-primary/50"
              />
              {effectiveThumb && (
                <img
                  src={effectiveThumb}
                  alt="Pré-visualização da thumbnail"
                  className="mt-2 aspect-video w-full max-w-xs rounded-xl object-cover"
                />
              )}
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-foreground">Descrição curta</span>
              <textarea
                rows={2}
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-foreground">Descrição completa</span>
              <textarea
                rows={5}
                value={form.full_description}
                onChange={(e) => setForm({ ...form, full_description: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-foreground">
                Data de publicação <span className="text-muted-foreground">(vazio = momento da publicação)</span>
              </span>
              <input
                type="datetime-local"
                value={form.published_at}
                onChange={(e) => setForm({ ...form, published_at: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm outline-none focus:border-primary/50"
              />
            </label>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "A guardar…" : editing ? "Guardar alterações" : "Criar episódio"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de publicação */}
      <AlertDialog open={!!publishTarget} onOpenChange={(o) => !o && setPublishTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar este episódio?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende publicar este episódio? Todos os
              alunos ativos do MMClub serão notificados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={acting} onClick={() => void confirmPublish()}>
              {acting ? "A publicar…" : "Publicar e notificar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de eliminação */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar este episódio?</AlertDialogTitle>
            <AlertDialogDescription>
              O episódio “{deleteTarget?.title}” será removido da biblioteca.
              Esta ação não pode ser anulada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={acting}
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {acting ? "A eliminar…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
