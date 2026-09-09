/**
 * Inteligência de recuperação de subscrição (winback).
 *
 * O motor de cobranças (dunning) trata do dinheiro: tentativas de pagamento,
 * tolerância, suspensão. Este módulo trata da *pessoa*: manda a mensagem certa
 * no momento certo, com um motivo real para voltar — uma live que vem a
 * caminho, aulas do Legacy fechadas, o progresso interrompido, a comunidade
 * activa — e só depois, como último recurso, o marco de dias em dívida.
 *
 * Regras invioláveis:
 *  - só membros SEM acesso válido (nunca incomodamos quem já pagou);
 *  - no máximo um email de recuperação a cada 72 horas por pessoa;
 *  - cada gatilho é enviado uma única vez (idempotência por `ref`).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { courses } from "@/data/courses";
import type { Course } from "@/data/types";

const LAPSED_STATUSES = ["past_due", "grace_period", "suspended", "expired"] as const;
const ACTIVE_STATUSES = ["trialing", "active"] as const;
const COOLDOWN_HOURS = 72;
const MILESTONES = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90] as const;
const LEGACY_COURSE_ID = "marca-milionaria-legacy";
const MAX_BATCH = 300;

export type WinbackVariant = "live" | "lessons" | "progress" | "community" | "milestone";

export type WinbackResult = {
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
  byVariant: Record<string, number>;
};

const DAY = 86_400_000;

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));
}

function weekKey(d = new Date()): string {
  const t = new Date(d);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function money(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(
    cents / 100,
  );
}

/** "hoje às 20:30", "amanhã às 20:30" ou "quinta, 11 set às 20:30". */
function whenLabel(iso: string): string {
  const when = new Date(iso);
  const time = when.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
  const dayKey = (d: Date) =>
    d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
  const now = new Date();
  const tomorrow = new Date(now.getTime() + DAY);
  if (dayKey(when) === dayKey(now)) return `hoje às ${time}`;
  if (dayKey(when) === dayKey(tomorrow)) return `amanhã às ${time}`;
  const label = when.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Lisbon",
  });
  return `${label} às ${time}`;
}

async function alreadySent(userId: string, ref: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "winback")
    .eq("ref", ref)
    .eq("status", "sent")
    .maybeSingle();
  return Boolean(data);
}

async function inCooldown(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_HOURS * 3_600_000).toISOString();
  const { data } = await supabaseAdmin
    .from("email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "winback")
    .eq("status", "sent")
    .gte("sent_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}

/** Curso com as capas/aulas já com os ajustes do admin aplicados. */
async function loadCourses(): Promise<Course[]> {
  const { data } = await supabaseAdmin
    .from("admin_overrides")
    .select("data")
    .eq("id", "courses")
    .maybeSingle();
  const ov = (data?.data ?? {}) as {
    courses?: Record<string, Partial<Course>>;
    newCourses?: Course[];
  };
  return [...courses, ...(ov.newCourses ?? [])].map((c) => ({
    ...c,
    ...(ov.courses?.[c.id] ?? {}),
  }));
}

function lessonCount(course: Course | undefined): number {
  if (!course?.modules) return 0;
  return course.modules.reduce((n, m) => n + m.lessons.length, 0);
}

function lessonTitle(
  all: Course[],
  courseId: string,
  lessonId: string,
): { courseTitle: string; lessonTitle: string; total: number } | null {
  const course = all.find((c) => c.id === courseId);
  if (!course) return null;
  for (const m of course.modules ?? []) {
    const l = m.lessons.find((x) => x.id === lessonId);
    if (l)
      return {
        courseTitle: course.title,
        lessonTitle: l.title,
        total: lessonCount(course),
      };
  }
  return null;
}

/**
 * Corre a inteligência de recuperação para todos os membros sem acesso válido.
 * Pensado para pg_cron diário — é seguro correr várias vezes por dia.
 */
export async function runWinbackIntelligence(
  limit = MAX_BATCH,
): Promise<WinbackResult> {
  const { sendEmail, emailTemplates, getUserEmailAndName } = await import(
    "@/lib/email.server"
  );
  const { courseCoverImage } = await import("@/lib/course-cover");

  const out: WinbackResult = {
    candidates: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    byVariant: {},
  };

  const { data: subs, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("user_id, status, current_period_end, updated_at, trial_end")
    .limit(5000);
  if (error) throw new Error(error.message);

  const active = new Set<string>();
  type Row = {
    user_id: string;
    status: string;
    current_period_end: string | null;
    updated_at: string | null;
  };
  const lapsed = new Map<string, Row>();
  for (const raw of (subs ?? []) as Row[]) {
    if (!raw.user_id) continue;
    if ((ACTIVE_STATUSES as readonly string[]).includes(raw.status)) {
      active.add(raw.user_id);
      continue;
    }
    if (!(LAPSED_STATUSES as readonly string[]).includes(raw.status)) continue;
    const prev = lapsed.get(raw.user_id);
    // Mantemos a mais recente — é a que descreve a dívida actual.
    if (!prev || String(raw.updated_at ?? "") > String(prev.updated_at ?? "")) {
      lapsed.set(raw.user_id, raw);
    }
  }

  const candidates = [...lapsed.values()]
    .filter((r) => !active.has(r.user_id))
    .slice(0, limit);
  out.candidates = candidates.length;

  const all = await loadCourses();
  const legacy = all.find((c) => c.id === LEGACY_COURSE_ID);

  // ---- contexto partilhado (uma consulta para todos) --------------------
  const { data: liveRows } = await supabaseAdmin
    .from("lives")
    .select("id, title, starts_at, cover_url, status")
    .eq("is_test", false)
    .gte("starts_at", new Date().toISOString())
    .lte("starts_at", new Date(Date.now() + 3 * DAY).toISOString())
    .order("starts_at", { ascending: true })
    .limit(1);
  const nextLive = (liveRows ?? [])[0] as
    | { id: string; title: string; starts_at: string; cover_url: string | null }
    | undefined;

  const { count: postsCount } = await supabaseAdmin
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 7 * DAY).toISOString());

  for (const row of candidates) {
    const userId = row.user_id;

    // Acesso é decidido pelos entitlements, nunca pelo estado de pagamento.
    const { data: hasAccess } = await supabaseAdmin.rpc("has_feature", {
      _user_id: userId,
      _feature: "academy.access",
    });
    if (hasAccess) {
      out.skipped += 1;
      continue;
    }

    if (await inCooldown(userId)) {
      out.skipped += 1;
      continue;
    }

    const user = await getUserEmailAndName(userId);
    if (!user) {
      out.skipped += 1;
      continue;
    }

    const days = Math.max(
      1,
      daysSince(row.current_period_end ?? row.updated_at),
    );

    // Dívida em aberto, para a mensagem ser concreta.
    const { data: invoice } = await supabaseAdmin
      .from("billing_invoices")
      .select("total_cents, currency, status")
      .eq("user_id", userId)
      .neq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const debt = invoice
      ? money(invoice.total_cents as number, String(invoice.currency ?? "EUR"))
      : null;

    // Aula onde ficou + percentagem concluída.
    const { data: lastProgress } = await supabaseAdmin
      .from("lesson_progress")
      .select("course_id, lesson_id")
      .eq("user_id", userId)
      .order("last_watched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const p = lastProgress as { course_id: string; lesson_id: string } | null;
    const titles = p ? lessonTitle(all, p.course_id, p.lesson_id) : null;
    let percent = 0;
    if (p && titles?.total) {
      const { count } = await supabaseAdmin
        .from("lesson_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("course_id", p.course_id)
        .eq("completed", true);
      percent = Math.min(
        99,
        Math.round(((count ?? 0) / titles.total) * 100),
      );
    }

    // ---- gatilhos por ordem de força ----------------------------------
    type Candidate = { variant: WinbackVariant; ref: string; build: () => { subject: string; html: string } };
    const plan: Candidate[] = [];

    if (nextLive) {
      plan.push({
        variant: "live",
        ref: `live:${nextLive.id}`,
        build: () =>
          emailTemplates.winback({
            name: user.name,
            variant: "live",
            days,
            debt,
            live: {
              title: nextLive.title,
              whenLabel: whenLabel(nextLive.starts_at),
              cover: nextLive.cover_url,
            },
          }),
      });
    }

    if (legacy) {
      plan.push({
        variant: "lessons",
        ref: `lessons:${LEGACY_COURSE_ID}:${weekKey()}`,
        build: () =>
          emailTemplates.winback({
            name: user.name,
            variant: "lessons",
            days,
            debt,
            course: {
              courseId: legacy.id,
              title: legacy.title,
              cover: courseCoverImage(legacy),
            },
            lessonsCount: lessonCount(legacy),
          }),
      });
    }

    if (titles && percent > 0) {
      plan.push({
        variant: "progress",
        ref: `progress:${weekKey()}`,
        build: () =>
          emailTemplates.winback({
            name: user.name,
            variant: "progress",
            days,
            debt,
            progress: {
              courseTitle: titles.courseTitle,
              lessonTitle: titles.lessonTitle,
              percent,
            },
          }),
      });
    }

    if ((postsCount ?? 0) >= 3) {
      plan.push({
        variant: "community",
        ref: `community:${weekKey()}`,
        build: () =>
          emailTemplates.winback({
            name: user.name,
            variant: "community",
            days,
            debt,
            posts: postsCount ?? 0,
          }),
      });
    }

    const milestone = [...MILESTONES].reverse().find((m) => days >= m);
    if (milestone) {
      plan.push({
        variant: "milestone",
        ref: `day${milestone}`,
        build: () =>
          emailTemplates.winback({
            name: user.name,
            variant: "milestone",
            days,
            debt,
          }),
      });
    }

    // O primeiro gatilho ainda não usado ganha. Marcos de dias funcionam como
    // rede de segurança: se todos os outros já foram enviados, ainda há voz.
    let chosen: Candidate | null = null;
    for (const c of plan) {
      if (!(await alreadySent(userId, c.ref))) {
        chosen = c;
        break;
      }
    }
    if (!chosen) {
      out.skipped += 1;
      continue;
    }

    const tpl = chosen.build();
    const res = await sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      userId,
      kind: "winback",
      ref: chosen.ref,
    }).catch(() => ({ sent: false, skipped: false }));

    if (res.sent) {
      out.sent += 1;
      out.byVariant[chosen.variant] = (out.byVariant[chosen.variant] ?? 0) + 1;
    } else if ((res as { skipped?: boolean }).skipped) out.skipped += 1;
    else out.failed += 1;
  }

  return out;
}
