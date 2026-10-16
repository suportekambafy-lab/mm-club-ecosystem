/** Number of times the sale bell strikes for one closed sale. */
export const SALE_BELL_STRIKES = 3;

/** Seconds between the start of one strike and the next. */
export const SALE_BELL_STRIKE_GAP = 1.05;

/** Each hit fades to silence in this many seconds, leaving a clear pause before the next. */
export const SALE_BELL_STRIKE_DECAY = 0.8;

/**
 * Start offsets (in seconds, relative to the first strike) for each bell strike.
 * The recorded bell is one long hit, so every strike is cut short and spaced apart:
 * three separate "tini" instead of one continuous ring.
 */
export function saleBellStrikeTimes(strikes = SALE_BELL_STRIKES, gap = SALE_BELL_STRIKE_GAP): number[] {
  if (!Number.isInteger(strikes) || strikes < 1) return [0];
  if (!Number.isFinite(gap) || gap <= 0) return Array.from({ length: strikes }, () => 0);
  return Array.from({ length: strikes }, (_, i) => Math.round(i * gap * 1000) / 1000);
}

/** When each strike stops. Every strike ends before the next one starts. */
export function saleBellStrikeEnds(
  strikeTimes: number[],
  duration: number,
  gap = SALE_BELL_STRIKE_GAP,
  decay = SALE_BELL_STRIKE_DECAY,
): number[] {
  const length = Math.max(0.1, Math.min(duration, decay));
  return strikeTimes.map((start, i) =>
    i === strikeTimes.length - 1 ? start + length : start + Math.min(length, gap * 0.8),
  );
}

/** Silence left between two strikes, in seconds. */
export function saleBellStrikePause(gap = SALE_BELL_STRIKE_GAP, decay = SALE_BELL_STRIKE_DECAY): number {
  return Math.max(0, gap - Math.min(gap * 0.8, decay));
}
