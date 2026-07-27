export type LiveLike = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
  created_at?: string;
};

export type LiveReminder = {
  id: string;
  liveId: string;
  title: string;
  subtitle: string;
  href: string;
  createdAt: number;
  priority: number;
};

type Stage = {
  key: string;
  /** minutes before start when this stage becomes active */
  minutes: number;
  subtitle: string;
  priority: number;
};

const STAGES: Stage[] = [
  { key: "5m", minutes: 5, subtitle: "Começa dentro de 5 minutos — entra já na sala", priority: 19 },
  { key: "15m", minutes: 15, subtitle: "Começa dentro de 15 minutos", priority: 18 },
  { key: "30m", minutes: 30, subtitle: "Falta meia hora para começar", priority: 17 },
  { key: "1h", minutes: 60, subtitle: "Falta 1 hora para começar", priority: 16 },
  { key: "3h", minutes: 180, subtitle: "Hoje, daqui a cerca de 3 horas", priority: 14 },
  { key: "24h", minutes: 1440, subtitle: "Acontece nas próximas 24 horas", priority: 12 },
];

function fmtTime(d: Date) {
  try {
    return new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return "";
  }
}

/**
 * Builds the reminder timeline for lives: an announcement plus escalating
 * reminders at 24h / 3h / 1h / 30min / 15min / 5min and one when it goes live.
 * Each stage has its own stable id so it shows up as a new unread item.
 */
export function buildLiveReminders(lives: LiveLike[], now = Date.now()): LiveReminder[] {
  const out: LiveReminder[] = [];

  for (const live of lives) {
    const startsMs = new Date(live.starts_at).getTime();
    if (!Number.isFinite(startsMs)) continue;
    const href = "/lives";

    if (live.status === "live") {
      out.push({
        id: `live:${live.id}:now`,
        liveId: live.id,
        title: `${live.title} está a decorrer`,
        subtitle: "A transmissão começou — entra agora",
        href,
        createdAt: Math.min(now, startsMs),
        priority: 20,
      });
      continue;
    }

    if (live.status !== "scheduled") continue;

    // Started less than an hour ago but still marked scheduled
    if (startsMs <= now) {
      if (now - startsMs <= 3600_000) {
        out.push({
          id: `live:${live.id}:starting`,
          liveId: live.id,
          title: `${live.title} vai começar`,
          subtitle: `Hora marcada: ${fmtTime(new Date(startsMs))}`,
          href,
          createdAt: startsMs,
          priority: 19,
        });
      }
      continue;
    }

    const minutesLeft = (startsMs - now) / 60000;
    const stage = STAGES.find((s) => minutesLeft <= s.minutes);
    if (stage) {
      out.push({
        id: `live:${live.id}:${stage.key}`,
        liveId: live.id,
        title: live.title,
        subtitle: `${stage.subtitle} · ${fmtTime(new Date(startsMs))}`,
        href,
        createdAt: startsMs - stage.minutes * 60000,
        priority: stage.priority,
      });
      continue;
    }

    // Further away: announcement only
    const createdMs = new Date(live.created_at ?? live.starts_at).getTime();
    const days = Math.max(1, Math.round((startsMs - now) / 86400000));
    out.push({
      id: `live:${live.id}:announce`,
      liveId: live.id,
      title: live.title,
      subtitle: `Agendada para daqui a ${days} dia${days === 1 ? "" : "s"} · ${fmtTime(new Date(startsMs))}`,
      href,
      createdAt: Number.isFinite(createdMs) ? createdMs : now,
      priority: 10,
    });
  }

  return out.sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
}
