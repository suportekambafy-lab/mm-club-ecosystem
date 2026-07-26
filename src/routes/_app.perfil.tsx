import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CreditCard, ExternalLink, Loader2, LogOut, Mail, Pencil, Save, Sparkles, Trophy, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading } from "@/components/mm/section-heading";
import { courses } from "@/data/courses";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/mm/verified-badge";
import { useAdminIds } from "@/hooks/use-admin-ids";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBillingOverview,
  cancelSubscription,
  resumeSubscription,
  type BillingOverview,
} from "@/lib/billing.functions";
import { formatMoney } from "@/lib/billing/types";



export const Route = createFileRoute("/_app/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — MM Club" },
      { name: "description", content: "O teu perfil no MM Club: dados, progresso e biografia." },
    ],
  }),
  component: ProfilePage,
});

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
};

function ProfilePage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const adminIds = useAdminIds();

  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [subActionLoading, setSubActionLoading] = useState(false);
  const sub = overview?.subscription ?? null;

  const loadBilling = async () => {
    try {
      const data = await getBillingOverview({ data: undefined });
      setOverview(data);
    } catch {
      setOverview(null);
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (mounted) setSubLoading(false);
        return;
      }
      if (!mounted) return;
      await loadBilling();
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSubscription = async () => {
    if (!sub) return;
    setSubActionLoading(true);
    setError(null);
    try {
      if (sub.cancelAtPeriodEnd) {
        await resumeSubscription({ data: { subscriptionId: sub.id } });
        setNotice("Assinatura reativada.");
      } else {
        await cancelSubscription({ data: { subscriptionId: sub.id } });
        setNotice("Cancelamento agendado para o fim do período.");
      }
      await loadBilling();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar o plano.");
    } finally {
      setSubActionLoading(false);
    }
  };




  // Load session + profile
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: s } = await supabase.auth.getUser();
      if (!mounted) return;
      setAuthUser(s.user ?? null);
      if (!s.user) {
        setLoading(false);
        return;
      }
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, cover_url, bio")
        .eq("id", s.user.id)
        .maybeSingle();
      if (!mounted) return;
      if (pErr) setError(pErr.message);
      if (p) {
        setProfile(p);
        setDisplayName(p.display_name ?? "");
        setBio(p.bio ?? "");
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Resolve signed URL for private avatar bucket
  const avatarResolving = Boolean(profile?.avatar_url) && avatarUrl === null;
  const coverResolving = Boolean(profile?.cover_url) && coverUrl === null;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile?.avatar_url) {
        setAvatarUrl(null);
        return;
      }
      // Stored path like "<userId>/avatar-xxxx.jpg"
      const { data, error: sErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(profile.avatar_url, 60 * 60);
      if (cancelled) return;
      if (sErr) {
        setAvatarUrl("");
      } else {
        setAvatarUrl(data.signedUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  // Resolve signed URL for cover
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile?.cover_url) {
        setCoverUrl(null);
        return;
      }
      const { data, error: cErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(profile.cover_url, 60 * 60);
      if (cancelled) return;
      setCoverUrl(cErr ? "" : data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };

  }, [profile?.cover_url]);

  const handleSave = async () => {
    if (!authUser || !profile) return;
    setSaving(true);
    setError(null);
    const trimmedName = displayName.trim() || profile.display_name;
    const trimmedBio = bio.trim();
    const { data, error: uErr } = await supabase
      .from("profiles")
      .update({ display_name: trimmedName, bio: trimmedBio || null })
      .eq("id", authUser.id)
      .select("id, display_name, avatar_url, cover_url, bio")
      .maybeSingle();
    setSaving(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    if (data) setProfile(data);
    // Reflect display_name in auth user metadata for the sidebar/header
    await supabase.auth.updateUser({ data: { display_name: trimmedName } });
    setEditing(false);
    setNotice("Perfil atualizado.");
    setTimeout(() => setNotice(null), 2500);
  };

  const handleAvatar = async (file: File) => {
    if (!authUser) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${authUser.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { data, error: uErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", authUser.id)
      .select("id, display_name, avatar_url, cover_url, bio")
      .maybeSingle();
    setUploading(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    if (data) setProfile(data);
    setNotice("Foto atualizada.");
    setTimeout(() => setNotice(null), 2500);
  };

  const handleCover = async (file: File) => {
    if (!authUser) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("A imagem de capa deve ter no máximo 8 MB.");
      return;
    }
    setUploadingCover(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${authUser.id}/cover-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingCover(false);
      setError(upErr.message);
      return;
    }
    const { data, error: uErr } = await supabase
      .from("profiles")
      .update({ cover_url: path })
      .eq("id", authUser.id)
      .select("id, display_name, avatar_url, cover_url, bio")
      .maybeSingle();
    setUploadingCover(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    if (data) setProfile(data);
    setNotice("Capa atualizada.");
    setTimeout(() => setNotice(null), 2500);
  };


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-[auto_1fr]">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const email = authUser?.email ?? "—";
  const name = profile?.display_name ?? email.split("@")[0];
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const isAdmin = authUser ? adminIds.has(authUser.id) : false;


  const inProgress = courses.filter((c) => c.progress > 0 && c.progress < 1);
  const completed = courses.filter((c) => c.progress >= 1);
  const overall =
    courses.length > 0
      ? Math.round(
          (courses.reduce((sum, c) => sum + c.progress, 0) / courses.length) * 100,
        )
      : 0;

  return (
    <div className="space-y-10">
      <SectionHeading
        title="A tua conta MM Club."
        description="Gere os teus dados, a tua foto e acompanha o teu progresso."
      />

      {notice && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Identity card */}
      <section className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border">
        <div
          className="group relative h-36 sm:h-44 bg-gradient-to-br from-primary/40 via-primary/10 to-transparent"
          style={
            coverUrl
              ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          {coverResolving && (
            <div className="absolute inset-0 animate-pulse bg-surface-2" />
          )}
          <button
            type="button"
            onClick={() => coverFileRef.current?.click()}
            disabled={uploadingCover}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur ring-1 ring-border transition hover:bg-background/90 disabled:opacity-60"
          >
            {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {coverUrl ? "Alterar capa" : "Adicionar capa"}
          </button>
          <input
            ref={coverFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCover(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-col gap-6 px-5 pb-6 sm:px-8 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
            {/* avatar pulled up over cover; name stays below */}
            <div className="relative -mt-14">
              <div
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-surface-2 text-2xl font-semibold text-primary-foreground ring-4 ring-background sm:h-28 sm:w-28"
                style={
                  avatarUrl
                    ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : avatarResolving
                      ? undefined
                      : { background: "var(--primary)" }
                }
              >
                {avatarResolving ? (
                  <div className="h-full w-full animate-pulse bg-surface-3" />
                ) : (
                  !avatarUrl && <span>{initials}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Alterar foto"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background transition hover:bg-gold-soft disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatar(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="min-w-0 pb-1">
              <h2 className="font-display text-2xl leading-tight text-foreground md:text-3xl flex items-center gap-2">
                <span>{name}</span>
                {isAdmin && <VerifiedBadge size={20} title="Admin verificado" />}
              </h2>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
              >
                <Pencil className="h-4 w-4" /> Editar perfil
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDisplayName(profile?.display_name ?? "");
                    setBio(profile?.bio ?? "");
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-3"
                >
                  <X className="h-4 w-4" /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </section>

      {/* Editable details */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome de exibição">
          {editing ? (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Como queres ser chamado"
              className="w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground ring-1 ring-border outline-none transition focus:ring-primary"
            />
          ) : (
            <p className="text-sm text-foreground">{profile?.display_name || "—"}</p>
          )}
        </Field>
        <Field label="Email">
          <p className="text-sm text-muted-foreground">{email}</p>
        </Field>
        <Field label="Biografia" className="md:col-span-2">
          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={280}
              placeholder="Conta um pouco sobre ti, o teu negócio e onde queres chegar."
              className="w-full resize-none rounded-xl bg-background px-4 py-3 text-sm text-foreground ring-1 ring-border outline-none transition focus:ring-primary"
            />
          ) : (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
              {profile?.bio || <span className="text-muted-foreground">Ainda sem biografia.</span>}
            </p>
          )}
          {editing && (
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{bio.length}/280</p>
          )}
        </Field>
      </section>

      {/* Gerenciar plano */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-display text-xl text-foreground md:text-2xl">Gerenciar plano</h2>
          {sub?.status && (
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {sub.status}
            </span>
          )}
        </div>

        <div className="rounded-2xl bg-surface-1 p-5 ring-1 ring-border sm:p-6">
          {subLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : sub ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-display text-lg text-foreground">
                  {sub.productName} · {formatMoney(sub.amountCents, sub.currency)}
                  <span className="text-sm text-muted-foreground">
                    {sub.interval === "year" ? "/ano" : sub.interval === "month" ? "/mês" : ""}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sub.cancelAtPeriodEnd
                    ? "Cancela no final do período atual"
                    : sub.currentPeriodEnd
                      ? `Próxima renovação em ${new Date(sub.currentPeriodEnd).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })}`
                      : "Assinatura ativa"}
                </p>
              </div>

              <button
                type="button"
                onClick={toggleSubscription}
                disabled={subActionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60"
              >
                {subActionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {sub.cancelAtPeriodEnd ? "Reativar plano" : "Cancelar plano"}
              </button>

            </div>
          ) : isAdmin ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-display text-lg text-foreground">Admin · Acesso total</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Como administrador do MM Club, tens acesso vitalício a todos os cursos, lives e ferramentas.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-display text-lg text-foreground">Sem plano ativo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ativa o teu acesso completo ao MM Club para desbloquear todos os cursos, lives e ferramentas.
                </p>
              </div>
              <Link
                to="/checkout"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
              >
                Ver planos
              </Link>
            </div>
          )}

        </div>
      </section>

      {/* Progress */}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-display text-xl text-foreground md:text-2xl">Progresso</h2>
          <span className="text-xs text-muted-foreground">
            {completed.length}/{courses.length} concluídos
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Progresso geral" value={`${overall}%`} icon={<Trophy className="h-4 w-4" />} />
          <Stat label="Em curso" value={String(inProgress.length)} />
          <Stat label="Cursos concluídos" value={String(completed.length)} />
        </div>

        <div className="rounded-2xl bg-surface-1 ring-1 ring-border">
          {courses.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-4 px-5 py-4",
                i > 0 && "border-t border-border",
              )}
            >
              <div
                className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-[color:var(--hairline)]"
                style={{ background: c.cover }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round(c.progress * 100)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                {Math.round(c.progress * 100)}%
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-surface-1 p-5 ring-1 ring-border", className)}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
        {label}
      </p>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-1 p-5 ring-1 ring-border">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl text-foreground">{value}</p>
    </div>
  );
}

function formatPlanLabel(priceId: string | null): string {
  if (!priceId) return "Plano MM Club";
  const map: Record<string, string> = {
    mm_club_start_monthly: "MM Club · Mensal",
    mm_club_plus_semestral: "MM Club Plus · Semestral",
    mm_club_elite_anual: "MM Club Elite · Anual",
    monthly_plan: "MM Club · Mensal",
    semestral_plan: "MM Club Plus · Semestral",
    annual_plan: "MM Club Elite · Anual",
    monthly: "MM Club · Mensal",
    semestral: "MM Club Plus · Semestral",
    annual: "MM Club Elite · Anual",
    annual_yearly: "MM Club Elite · Anual",
  };

  if (map[priceId]) return map[priceId];
  return priceId
    .replace(/^mm_club_/, "MM Club ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

