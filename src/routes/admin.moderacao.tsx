/**
 * Painel de revisão do agente de moderação: histórico com evidências,
 * reversão de decisões e decisão de recursos apresentados pelos membros.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Gavel,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldQuestion,
  Paperclip,
  Check,
  X,
  MicOff,
  Ban,
  AlertTriangle,
  Undo2,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import {
  listModerationActions,
  revertModerationAction,
  decideAppeal,
  searchMembersForModeration,
  listActiveSanctions,
  applyManualSanction,
  liftSanction,
  type ModerationActionRow,
  type MemberSanctionRow,
} from "@/lib/moderation-review.functions";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/mm/member-avatar";

export const Route = createFileRoute("/admin/moderacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Moderação — MM Admin" },
      {
        name: "description",
        content:
          "Revisão das decisões do agente de moderação do MM Club: evidências, reversões e recursos dos membros.",
      },
      { property: "og:title", content: "Moderação — MM Admin" },
      {
        property: "og:description",
        content: "Histórico do agente de moderação, sanções aplicadas e recursos em análise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ModerationPage,
});

const FILTERS = [
  { key: "all", label: "Tudo" },
  { key: "appealed", label: "Recursos pendentes" },
  { key: "removed", label: "Removidos" },
  { key: "reverted", label: "Revertidos" },
  { key: "allowed", label: "Aprovados" },
] as const;

const KIND_LABEL: Record<string, string> = {
  community_post: "Publicação",
  community_comment: "Comentário",
  community_chat: "Chat da comunidade",
  short: "Short",
  short_comment: "Comentário de Short",
  live_chat: "Chat da live",
};

const SANCTION_LABEL: Record<string, string> = {
  warning: "Aviso",
  mute: "Silenciado",
  ban: "Banido",
};

function ago(iso: string) {
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true });
}

function ModerationPage() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const load = useServerFn(listModerationActions);
  const revert = useServerFn(revertModerationAction);
  const decide = useServerFn(decideAppeal);

  const listQ = useQuery({
    queryKey: ["admin", "moderation", status, search],
    queryFn: () => load({ data: { status, search, limit: 80 } }),
    staleTime: 15_000,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "moderation"] });

  const revertM = useMutation({
    mutationFn: (vars: { actionId: string; note: string }) => revert({ data: vars }),
    onSuccess: () => {
      toast.success("Decisão revertida e sanção levantada.");
      refresh();
    },
    onError: () => toast.error("Não foi possível reverter a decisão."),
  });

  const decideM = useMutation({
    mutationFn: (vars: { appealId: string; decision: "accepted" | "rejected"; note: string }) =>
      decide({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.decision === "accepted" ? "Recurso aceite." : "Recurso recusado.");
      refresh();
    },
    onError: () => toast.error("Não foi possível registar a decisão."),
  });

  const rows = listQ.data ?? [];
  const pendingAppeals = rows.filter((r) => r.appeal?.status === "pending").length;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-xl tracking-wide">
          <Gavel className="h-5 w-5" /> Moderação
        </h1>
        <p className="text-sm text-muted-foreground">
          Revê o que o agente decidiu, vê a evidência guardada e reverte quando for injusto.
          {pendingAppeals > 0 ? ` ${pendingAppeals} recurso(s) à espera de decisão.` : ""}
        </p>
      </header>

      <MemberSanctionsPanel />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                status === f.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar no texto ou motivo"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>
      </div>

      {listQ.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-surface-1" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface-1 p-6 text-sm text-muted-foreground">
          Nada para revisar neste filtro.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <ActionCard
              key={row.id}
              row={row}
              note={notes[row.id] ?? ""}
              onNote={(v) => setNotes((s) => ({ ...s, [row.id]: v }))}
              busy={revertM.isPending || decideM.isPending}
              onRevert={() => revertM.mutate({ actionId: row.id, note: notes[row.id] ?? "" })}
              onDecide={(decision) =>
                row.appeal &&
                decideM.mutate({ appealId: row.appeal.id, decision, note: notes[row.id] ?? "" })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionCard({
  row,
  note,
  onNote,
  busy,
  onRevert,
  onDecide,
}: {
  row: ModerationActionRow;
  note: string;
  onNote: (v: string) => void;
  busy: boolean;
  onRevert: () => void;
  onDecide: (decision: "accepted" | "rejected") => void;
}) {
  const removed = row.action === "remove";
  const appeal = row.appeal;

  return (
    <article className="rounded-2xl border border-border bg-surface-1 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-semibold",
            row.reverted_at
              ? "bg-muted text-muted-foreground"
              : removed
                ? "bg-destructive/15 text-destructive"
                : "bg-emerald-500/15 text-emerald-600",
          )}
        >
          {row.reverted_at ? "Revertido" : removed ? "Removido" : "Aprovado"}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          {KIND_LABEL[row.kind] ?? row.kind}
        </span>
        {row.category ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            {row.category}
            {row.severity ? ` · ${row.severity}` : ""}
          </span>
        ) : null}
        {row.sanction ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            {SANCTION_LABEL[row.sanction.kind] ?? row.sanction.kind} · nível {row.sanction.level}
            {row.sanction.lifted_at ? " · levantada" : ""}
          </span>
        ) : null}
        <span className="ml-auto text-muted-foreground">{ago(row.created_at)}</span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <MemberAvatar
          name={row.author_name ?? "Membro"}
          avatarUrl={row.author_avatar}
          size={36}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">{row.author_name ?? "Membro removido"}</p>
          {row.excerpt ? (
            <p className="whitespace-pre-wrap rounded-lg bg-background/60 p-3 text-sm text-foreground/90">
              {row.excerpt}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sem texto associado.</p>
          )}
          {row.image_url ? (
            <a href={row.image_url} target="_blank" rel="noreferrer" className="block w-fit">
              <img
                src={row.image_url}
                alt="Evidência do conteúdo moderado"
                className="max-h-52 rounded-lg border border-border object-cover"
                loading="lazy"
              />
            </a>
          ) : null}
          {row.reason ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Agente:</span> {row.reason}
            </p>
          ) : null}
          {row.review_note ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Nota da revisão:</span> {row.review_note}
            </p>
          ) : null}

          {appeal ? (
            <div className="space-y-1.5 rounded-xl border border-border bg-background/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <ShieldQuestion className="h-3.5 w-3.5" />
                Recurso do membro · {appeal.status === "pending" ? "em análise" : appeal.status === "accepted" ? "aceite" : "recusado"} · {ago(appeal.created_at)}
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{appeal.message}</p>
              {appeal.attachment_url ? (
                <a
                  href={appeal.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium underline"
                >
                  <Paperclip className="h-3.5 w-3.5" /> Ver anexo do membro
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="Nota da revisão (opcional)"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground/40"
            />
            {appeal?.status === "pending" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide("accepted")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Aceitar recurso
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide("rejected")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Recusar
                </button>
              </>
            ) : null}
            {removed && !row.reverted_at ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRevert}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reverter decisão
              </button>
            ) : null}
            {row.reverted_at ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Revertido {ago(row.reverted_at)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------------- Sanções manuais de membros ---------------- */

function sanctionSummary(row: MemberSanctionRow) {
  const s = row.sanction;
  if (!s) return "Sem sanção ativa";
  if (s.kind === "ban") return "Banido definitivamente";
  if (s.kind === "mute")
    return s.expires_at
      ? `Silenciado até ${new Date(s.expires_at).toLocaleDateString("pt-PT")}`
      : "Silenciado";
  return "Aviso registado";
}

function MemberSanctionsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<MemberSanctionRow | null>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(7);

  const doSearch = useServerFn(searchMembersForModeration);
  const loadActive = useServerFn(listActiveSanctions);
  const sanction = useServerFn(applyManualSanction);
  const lift = useServerFn(liftSanction);

  const activeQ = useQuery({
    queryKey: ["admin", "moderation", "sanctions"],
    queryFn: () => loadActive(),
    staleTime: 15_000,
  });

  const searchQ = useQuery({
    queryKey: ["admin", "moderation", "members", search],
    queryFn: () => doSearch({ data: { search } }),
    enabled: search.trim().length >= 2,
    staleTime: 10_000,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "moderation"] });

  const applyM = useMutation({
    mutationFn: (vars: { userId: string; kind: "warning" | "mute" | "ban"; days: number | null; reason: string }) =>
      sanction({ data: vars }),
    onSuccess: () => {
      toast.success("Sanção aplicada e membro notificado.");
      setTarget(null);
      setReason("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível aplicar a sanção."),
  });

  const liftM = useMutation({
    mutationFn: (sanctionId: string) => lift({ data: { sanctionId } }),
    onSuccess: () => {
      toast.success("Sanção levantada.");
      refresh();
    },
    onError: () => toast.error("Não foi possível levantar a sanção."),
  });

  const apply = (kind: "warning" | "mute" | "ban") => {
    if (!target) return;
    if (reason.trim().length < 5) {
      toast.error("Escreve o motivo (mín. 5 caracteres).");
      return;
    }
    applyM.mutate({
      userId: target.user_id,
      kind,
      days: kind === "mute" ? days : null,
      reason: reason.trim(),
    });
  };

  const active = activeQ.data ?? [];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface-1 p-4">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Membros e sanções
        </h2>
        <p className="text-xs text-muted-foreground">
          Silencia, avisa ou bane definitivamente. Silenciados não publicam, não comentam, não reagem — e as
          publicações deles nunca geram notificações nem emails até a sanção terminar.
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Procurar membro pelo nome"
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-foreground/40"
        />
      </div>

      {search.trim().length >= 2 ? (
        <div className="space-y-1.5">
          {searchQ.isLoading ? (
            <p className="text-xs text-muted-foreground">A procurar…</p>
          ) : (searchQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum membro encontrado.</p>
          ) : (
            (searchQ.data ?? []).map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => setTarget(m)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                  target?.user_id === m.user_id
                    ? "border-foreground bg-muted"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <MemberAvatar
                  name={m.display_name ?? "Membro"}
                  avatarUrl={m.avatar_url}
                  size={32}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.display_name ?? "Membro"}</span>
                  <span className="block text-xs text-muted-foreground">{sanctionSummary(m)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {target ? (
        <div className="space-y-3 rounded-xl border border-border bg-background/60 p-3">
          <p className="text-sm font-medium">
            Ação sobre <span className="font-semibold">{target.display_name ?? "membro"}</span>
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Motivo (fica no histórico e é enviado ao membro)"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Dias de silenciamento:</span>
            {[3, 7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  days === d ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={applyM.isPending}
              onClick={() => apply("warning")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Avisar
            </button>
            <button
              type="button"
              disabled={applyM.isPending}
              onClick={() => apply("mute")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {applyM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MicOff className="h-3.5 w-3.5" />}
              Silenciar {days}d
            </button>
            <button
              type="button"
              disabled={applyM.isPending}
              onClick={() => apply("ban")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" /> Banir definitivamente
            </button>
            {target.sanction ? (
              <button
                type="button"
                disabled={liftM.isPending}
                onClick={() => liftM.mutate(target.sanction!.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" /> Levantar sanção atual
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Sanções ativas ({active.length})
        </p>
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguém sancionado neste momento.</p>
        ) : (
          active.map((m) => (
            <div
              key={m.sanction!.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs"
            >
              <span className="font-medium">{m.display_name ?? "Membro"}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                {sanctionSummary(m)} · nível {m.sanction!.level}
              </span>
              <button
                type="button"
                disabled={liftM.isPending}
                onClick={() => liftM.mutate(m.sanction!.id)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-semibold transition hover:bg-muted disabled:opacity-50"
              >
                <Undo2 className="h-3 w-3" /> Levantar
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
