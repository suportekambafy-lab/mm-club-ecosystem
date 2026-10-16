import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const CALL_TIME_ZONE = "Europe/Lisbon";
export type ScheduledCall = { id: string; nome: string | null; whatsapp: string | null; call_scheduled_at: string };
export function parseCallDateTime(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = fromZonedTime(value, CALL_TIME_ZONE);
  if (!Number.isFinite(date.getTime()) || formatInTimeZone(date, CALL_TIME_ZONE, "yyyy-MM-dd'T'HH:mm") !== value) return null;
  return date.toISOString();
}
export function callCountdown(at: string, now: number): string {
  const seconds = Math.ceil((Date.parse(at) - now) / 1000);
  if (seconds <= 0) return "Hora da call";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return `${days ? `${days}d ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function callReminderStage(at: string, now: number): "soon" | "now" | null {
  const delta = Date.parse(at) - now;
  if (delta <= 0 && delta > -5 * 60_000) return "now";
  if (delta > 0 && delta <= 15 * 60_000) return "soon";
  return null;
}