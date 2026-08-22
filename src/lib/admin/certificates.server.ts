/**
 * Certificados & sequências (streaks) — admin only, server only.
 * Lê com service role e cruza com perfis.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminCertificate = {
  code: string;
  courseId: string;
  courseTitle: string;
  memberName: string;
  hours: number;
  lessonsTotal: number;
  issuedAt: string;
  userId: string;
  avatarUrl: string | null;
};

export type AdminStreak = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  weekMinutes: number;
  totalMinutes: number;
  lessonsCompleted: number;
  lastActiveDay: string | null;
};

export type CertificatesOverview = {
  certificates: AdminCertificate[];
  streaks: AdminStreak[];
  totals: {
    certificates: number;
    membersWithCertificate: number;
    activeStreaks: number;
    weekMinutes: number;
  };
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function streakFrom(days: Set<string>): { current: number; longest: number } {
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    if (prev) {
      const diff = (Date.parse(day) - Date.parse(prev)) / 86_400_000;
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = day;
  }
  // corrente: conta a partir de hoje (ou ontem) para trás
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  let current = 0;
  while (cursor && days.has(cursor)) {
    current += 1;
    cursor = dayKey(new Date(Date.parse(cursor) - 86_400_000));
  }
  return { current, longest };
}

export async function collectCertificatesOverview(): Promise<CertificatesOverview> {
  const [{ data: certRows }, { data: activityRows }] = await Promise.all([
    supabaseAdmin
      .from("course_certificates")
      .select("code, course_id, course_title, member_name, hours, lessons_total, issued_at, user_id")
      .order("issued_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("learning_activity")
      .select("user_id, day, minutes, lessons_completed")
      .order("day", { ascending: false })
      .limit(20_000),
  ]);

  const certs = (certRows ?? []) as Array<{
    code: string;
    course_id: string;
    course_title: string;
    member_name: string;
    hours: number;
    lessons_total: number;
    issued_at: string;
    user_id: string;
  }>;
  const activity = (activityRows ?? []) as Array<{
    user_id: string;
    day: string;
    minutes: number;
    lessons_completed: number;
  }>;

  const userIds = [...new Set([...certs.map((c) => c.user_id), ...activity.map((a) => a.user_id)])];
  const nameById = new Map<string, string>();
  const avatarById = new Map<string, string | null>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds.slice(i, i + 200));
    for (const p of data ?? []) {
      nameById.set(p.id, p.display_name || "Aluno");
      avatarById.set(p.id, p.avatar_url ?? null);
    }
  }

  const weekStart = dayKey(new Date(Date.now() - 6 * 86_400_000));
  const byUser = new Map<
    string,
    { days: Set<string>; total: number; week: number; lessons: number; last: string | null }
  >();
  for (const row of activity) {
    const bucket =
      byUser.get(row.user_id) ??
      (byUser.set(row.user_id, { days: new Set(), total: 0, week: 0, lessons: 0, last: null }),
      byUser.get(row.user_id)!);
    bucket.days.add(row.day);
    bucket.total += row.minutes ?? 0;
    bucket.lessons += row.lessons_completed ?? 0;
    if (row.day >= weekStart) bucket.week += row.minutes ?? 0;
    if (!bucket.last || row.day > bucket.last) bucket.last = row.day;
  }

  const streaks: AdminStreak[] = [...byUser.entries()]
    .map(([userId, b]) => {
      const { current, longest } = streakFrom(b.days);
      return {
        userId,
        name: nameById.get(userId) ?? "Aluno",
        avatarUrl: avatarById.get(userId) ?? null,
        currentStreak: current,
        longestStreak: longest,
        weekMinutes: b.week,
        totalMinutes: b.total,
        lessonsCompleted: b.lessons,
        lastActiveDay: b.last,
      };
    })
    .sort((a, b) => b.currentStreak - a.currentStreak || b.weekMinutes - a.weekMinutes);

  return {
    certificates: certs.map((c) => ({
      code: c.code,
      courseId: c.course_id,
      courseTitle: c.course_title,
      memberName: c.member_name,
      hours: Number(c.hours ?? 0),
      lessonsTotal: c.lessons_total ?? 0,
      issuedAt: c.issued_at,
      userId: c.user_id,
      avatarUrl: avatarById.get(c.user_id) ?? null,
    })),
    streaks,
    totals: {
      certificates: certs.length,
      membersWithCertificate: new Set(certs.map((c) => c.user_id)).size,
      activeStreaks: streaks.filter((s) => s.currentStreak > 0).length,
      weekMinutes: streaks.reduce((n, s) => n + s.weekMinutes, 0),
    },
  };
}
