import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Copy, Plus, Trash2, Radio, Loader2, Video, Upload, CalendarClock, Sparkles, Scissors, Mail, FlaskConical, Pencil } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import {
  adminListLives,
  adminCreateLive,
  adminDeleteLive,
  adminGetLiveIngest,
  adminSendLiveStartEmails,
  adminUpdateLive,
} from "@/lib/lives.functions";

import { adminGetGuestLink } from "@/lib/live-guest.functions";
import { uploadMedia } from "@/lib/media-upload";
import { toast } from "sonner";

const GUEST_LINK_ORIGIN = "https://mmclub.pt";


async function copyText(value: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type LiveRow = Awaited<ReturnType<typeof adminListLives>>[number];


export const Route = createFileRoute("/admin/lives/")({
  head: () => ({
    meta: [
      { title: "Admin Lives — MM Club" },
      { name: "description", content: "Gerir sessões ao vivo, transmissões e salas interativas do MM Club." },
      { property: "og:title", content: "Admin Lives — MM Club" },
      { property: "og:description", content: "Gerir sessões ao vivo, transmissões e salas interativas do MM Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLives,
});

function AdminLives() {
  const list = useServerFn(adminListLives);
  const create = useServerFn(adminCreateLive);
  const del = useServerFn(adminDeleteLive);
  const getIngest = useServerFn(adminGetLiveIngest);
  const guestLink = useServerFn(adminGetGuestLink);
  const sendLiveEmails = useServerFn(adminSendLiveStartEmails);
  const [emailBusy, setEmailBusy] = useState<string | null>(null);

  const [rows, setRows] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [testLiveId, setTestLiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ingest, setIngest] = useState<{ id: string; url: string; key: string } | null>(null);
  const [guestUrl, setGuestUrl] = useState<{ id: string; url: string } | null>(null);
  const [guestBusy, setGuestBusy] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "club" | "premium">("club");
  const [schedule, setSchedule] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [speakerUrl, setSpeakerUrl] = useState("");
  const [uploadingSpeaker, setUploadingSpeaker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const speakerFileRef = useRef<HTMLInputElement>(null);

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

  async function handleSpeakerUpload(file: File) {
    setError(null);
    setUploadingSpeaker(true);
    try {
      const { url } = await uploadMedia("course-media", file, "lives-speakers");
      setSpeakerUrl(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingSpeaker(false);
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
        speaker_image_url: speakerUrl || undefined,
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
      setSpeakerUrl("");
      if (fileRef.current) fileRef.current.value = "";
      if (speakerFileRef.current) speakerFileRef.current.value = "";
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  // Cria uma live de teste: invisível para membros, sem emails nem notificações.
  async function handleCreateTest() {
    setError(null);
    setCreatingTest(true);
    try {
      const stamp = new Date().toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const res = await create({
        data: {
          title: `Live de teste — ${stamp}`,
          description: "Sessão interna para testar funcionalidades das lives.",
          visibility: "premium" as const,
          is_test: true,
        },
      });
      setTestLiveId(res.id);
      toast.success("Live de teste criada. Ninguém foi notificado.");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingTest(false);
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

  async function handleSendLiveEmails(id: string) {
    setEmailBusy(id);
    try {
      const r = await sendLiveEmails({ data: { id } });
      toast.success(`Emails enviados: ${r.sent} (ignorados ${r.skipped}, falhas ${r.failed})`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEmailBusy(null);
    }
  }

  async function handleGuestLink(id: string, rotate = false) {
    setError(null);
    setGuestBusy(id);
    try {
      const r = await guestLink({ data: { liveId: id, rotate } });
      const url = `${GUEST_LINK_ORIGIN}${r.path}`;
      setGuestUrl({ id, url });
      const copied = await copyText(url);
      toast[copied ? "success" : "message"](
        copied ? "Link de convidado copiado" : "Link gerado — copia manualmente abaixo",
      );

    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuestBusy(null);
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

      {guestUrl && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5">
          <p className="font-display text-sm text-amber-300">Link de convidado</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Quem abrir este link entra na sala interativa apenas com o nome, sem conta MM Club. O link foi copiado para a
            área de transferência.
          </p>
          <div className="mt-3">
            <IngestField label="Link" value={guestUrl.url} />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleGuestLink(guestUrl.id, true)}
              className="text-xs text-amber-300 underline"
            >
              Gerar novo link (invalida o anterior)
            </button>
            <button type="button" onClick={() => setGuestUrl(null)} className="text-xs text-muted-foreground underline">
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-sm text-foreground">
              <FlaskConical className="h-4 w-4 text-primary" /> Live de teste
            </p>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Cria uma sessão só para testar funcionalidades (sala interativa, partilha de ecrã, convidados, chat,
              gravação). Fica escondida dos membros e não envia emails, notificações nem push.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateTest}
            disabled={creatingTest}
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
          >
            {creatingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {creatingTest ? "A criar…" : "Criar live de teste"}
          </button>
        </div>

        {testLiveId && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Link
              to="/lives/$liveId/sala"
              params={{ liveId: testLiveId }}
              reloadDocument
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Video className="h-3 w-3" /> Entrar na sala de teste
            </Link>
            <Link
              to="/admin/lives/$liveId/studio"
              params={{ liveId: testLiveId }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
            >
              <Video className="h-3 w-3" /> Estúdio
            </Link>
            <button
              type="button"
              onClick={() => handleGuestLink(testLiveId)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
            >
              <Copy className="h-3 w-3" /> Link de convidado
            </button>
            <button
              type="button"
              onClick={() => setTestLiveId(null)}
              className="text-[11px] text-muted-foreground underline"
            >
              Fechar
            </button>
          </div>
        )}
      </div>


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
                <img loading="lazy" decoding="async" src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
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
                  Sem capa? Geramos automaticamente uma capa cinematográfica MM Club com IA e o nome da live.
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
            Foto do palestrante (opcional)
          </label>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-1">
              {speakerUrl ? (
                <img loading="lazy" decoding="async" src={speakerUrl} alt="Palestrante" className="h-full w-full object-cover" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              {speakerUrl ? (
                <p className="truncate">Foto do palestrante carregada. A IA vai criar a capa com esta pessoa.</p>
              ) : (
                <p>
                  Envia uma foto do palestrante (retrato nítido) e a IA cria a capa MM Club com ele/ela em destaque.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={speakerFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSpeakerUpload(f);
                }}
              />
              <button
                type="button"
                onClick={() => speakerFileRef.current?.click()}
                disabled={uploadingSpeaker}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs hover:border-primary/40 disabled:opacity-60"
              >
                {uploadingSpeaker ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {speakerUrl ? "Trocar" : "Carregar foto"}
              </button>
              {speakerUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setSpeakerUrl("");
                    if (speakerFileRef.current) speakerFileRef.current.value = "";
                  }}
                  className="text-[11px] text-muted-foreground underline"
                >
                  Remover
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
            {creating ? "A criar capa…" : schedule ? "Agendar live" : "Criar e começar"}
          </button>
        </div>
      </form>

      {(() => {
        const testRows = rows.filter((r) => r.is_test);
        const real = rows.filter((r) => !r.is_test);
        const active = real.filter((r) => r.status === "scheduled" || r.status === "live");
        const finished = real.filter((r) => r.status === "ended" || r.status === "published");
        return (
          <>
            {testRows.length > 0 && (
              <LivesSection
                title="Lives de teste (escondidas dos membros)"
                loading={loading}
                rows={testRows}
                emptyText="Sem lives de teste."
                renderActions={(r) => (
                  <>
                    <EditLiveButton row={r} onSaved={refresh} />
                    <Link
                      to="/lives/$liveId/sala"
                      params={{ liveId: r.id }}
                      reloadDocument
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Video className="h-3 w-3" /> Sala de teste
                    </Link>
                    <Link
                      to="/admin/lives/$liveId/studio"
                      params={{ liveId: r.id }}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
                    >
                      <Video className="h-3 w-3" /> Estúdio
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleGuestLink(r.id)}
                      disabled={guestBusy === r.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40 disabled:opacity-60"
                    >
                      {guestBusy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                      Link de convidado
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" /> Apagar
                    </button>
                  </>
                )}
                statusBadge={(r) => `teste · ${r.status}`}
              />
            )}

            <LivesSection
              title="Lives programadas"
              loading={loading}
              rows={active}
              emptyText="Ainda não tens lives agendadas ou a decorrer."
              renderActions={(r) => (
                <>
                  <EditLiveButton row={r} onSaved={refresh} />
                  <Link
                    to="/admin/lives/$liveId/studio"
                    params={{ liveId: r.id }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Video className="h-3 w-3" /> Transmitir do navegador
                  </Link>
                  <Link
                    to="/lives/$liveId/sala"
                    params={{ liveId: r.id }}
                    reloadDocument
                    className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20"
                    title="Modo interativo (Beta) — LiveKit"
                  >
                    <Video className="h-3 w-3" /> Sala interativa · Beta
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleGuestLink(r.id)}
                    disabled={guestBusy === r.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40 disabled:opacity-60"
                    title="Link para convidados externos entrarem só com o nome"
                  >
                    {guestBusy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                    Link de convidado
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendLiveEmails(r.id)}
                    disabled={emailBusy === r.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40 disabled:opacity-60"
                    title="Enviar email “AO VIVO agora” a todos os subscritores"
                  >
                    {emailBusy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                    Avisar por email
                  </button>
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
                </>
              )}
            />
            <LivesSection
              title="Lives terminadas"
              loading={loading}
              rows={finished}
              emptyText="Ainda não há lives terminadas."
              renderActions={(r) => (
                <>
                  <EditLiveButton row={r} onSaved={refresh} />
                  <Link
                    to="/lives/$liveId"
                    params={{ liveId: r.id }}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
                  >
                    Ver gravação
                  </Link>
                  <Link
                    to="/admin/lives/$liveId/editor"
                    params={{ liveId: r.id }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    title="Cortar o início escuro da gravação"
                  >
                    <Scissors className="h-3 w-3" /> Editar gravação
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3 w-3" /> Apagar
                  </button>
                </>
              )}
              statusBadge={(r) => (r.status === "published" ? "Gravação publicada" : "Terminada")}
            />
          </>
        );
      })()}
    </div>
  );
}

function LivesSection({
  title,
  loading,
  rows,
  emptyText,
  renderActions,
  statusBadge,
}: {
  title: string;
  loading: boolean;
  rows: LiveRow[];
  emptyText: string;
  renderActions: (r: LiveRow) => React.ReactNode;
  statusBadge?: (r: LiveRow) => string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1">
      <div className="border-b border-border px-5 py-3">
        <p className="font-display text-sm">{title}</p>
      </div>
      {loading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">A carregar…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{r.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(r.starts_at).toLocaleString("pt-PT")} · {r.visibility}
                  {statusBadge ? ` · ${statusBadge(r)}` : ` · ${r.status}`}
                </p>
              </div>
              {renderActions(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditLiveButton({ row, onSaved }: { row: LiveRow; onSaved: () => void }) {
  const update = useServerFn(adminUpdateLive);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(row.title);
  const [description, setDescription] = useState(row.description ?? "");
  const [expert, setExpert] = useState(row.expert_id ?? "");
  const [visibility, setVisibility] = useState<"public" | "club" | "premium">(
    row.visibility as "public" | "club" | "premium",
  );
  const [duration, setDuration] = useState(row.duration_minutes ?? 60);
  const [startsAt, setStartsAt] = useState(() => toLocalInput(row.starts_at));
  const [coverUrl, setCoverUrl] = useState(row.cover_url ?? "");

  function reset() {
    setTitle(row.title);
    setDescription(row.description ?? "");
    setExpert(row.expert_id ?? "");
    setVisibility(row.visibility as "public" | "club" | "premium");
    setDuration(row.duration_minutes ?? 60);
    setStartsAt(toLocalInput(row.starts_at));
    setCoverUrl(row.cover_url ?? "");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await update({
        data: {
          id: row.id,
          title: title.trim(),
          description: description.trim() || null,
          expert_id: expert.trim() || null,
          starts_at: new Date(startsAt).toISOString(),
          duration_minutes: Number(duration) || 60,
          visibility,
          cover_url: coverUrl.trim() || null,
        },
      });
      toast.success("Live atualizada");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
        title="Editar título, descrição, data e capa"
      >
        <Pencil className="h-3 w-3" /> Editar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface-1 p-5 sm:rounded-2xl">
            <p className="font-display text-base">Editar live</p>
            <div className="mt-4 space-y-3">
              <Field label="Título">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </Field>
              <Field label="Descrição">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Especialista (id)">
                  <input
                    value={expert}
                    onChange={(e) => setExpert(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
                <Field label="Visibilidade">
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as "public" | "club" | "premium")}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="public">Pública</option>
                    <option value="club">Clube</option>
                    <option value="premium">Premium</option>
                  </select>
                </Field>
                <Field label="Data e hora">
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
                <Field label="Duração (min)">
                  <input
                    type="number"
                    min={5}
                    max={600}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
              </div>
              <Field label="Capa (URL)">
                <div className="flex items-center gap-2">
                  <input
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://…"
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Carregar
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const { url } = await uploadMedia("course-media", file, "lives-covers");
                          setCoverUrl(url);
                        } catch (err) {
                          toast.error((err as Error).message);
                        } finally {
                          setUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
              </Field>
              {coverUrl ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={coverUrl}
                  alt="Capa da live"
                  loading="lazy"
                  className="h-32 w-full rounded-lg object-cover"
                />
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || title.trim().length < 3}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
        <input
          readOnly
          value={revealed ? value : "•".repeat(Math.min(value.length, 32))}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          className="flex-1 truncate bg-transparent font-mono text-xs outline-none"
        />
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
          onClick={async () => {
            const ok = await copyText(value);
            setCopied(ok);
            toast[ok ? "success" : "error"](ok ? "Copiado" : "Não foi possível copiar — seleciona o texto");
            if (ok) setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-primary"
        >
          <Copy className="h-3 w-3" /> {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );

}
