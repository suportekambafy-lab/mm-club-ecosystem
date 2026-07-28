/**
 * Public launch of MM Club — 28/07 às 18:30 (hora de Lisboa, UTC+1).
 * Shared by the waitlist countdown and the launch emails.
 */
export const LAUNCH_AT_ISO = "2026-07-28T18:30:00+01:00";

export const LAUNCH_AT = new Date(LAUNCH_AT_ISO);

export const LAUNCH_LABEL = "28 de julho, 18:30 (Lisboa)";

export function launchCountdown(now: Date = new Date()) {
  const diff = LAUNCH_AT.getTime() - now.getTime();
  const clamped = Math.max(0, diff);
  const totalSeconds = Math.floor(clamped / 1000);
  return {
    isOpen: diff <= 0,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
