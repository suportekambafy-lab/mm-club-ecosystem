/** Number of times the sale bell strikes for one closed sale. */
export const SALE_BELL_STRIKES = 3;

/** Seconds between the start of one strike and the next. */
export const SALE_BELL_STRIKE_GAP = 1.4;

/** How long the final strike is allowed to ring out, in seconds. */
export const SALE_BELL_TAIL = 2.6;

/**
 * Start offsets (in seconds, relative to the first strike) for each bell strike.
 * The recorded bell is a single hit with a long decay, so the strikes are spaced
 * apart and each one is faded out just before the next begins.
 */
export function saleBellStrikeTimes(strikes = SALE_BELL_STRIKES, gap = SALE_BELL_STRIKE_GAP): number[] {
  if (!Number.isInteger(strikes) || strikes < 1) return [0];
  if (!Number.isFinite(gap) || gap <= 0) return Array.from({ length: strikes }, () => 0);
  return Array.from({ length: strikes }, (_, i) => Math.round(i * gap * 1000) / 1000);
}

/** When each strike stops: the next one starts, or the last one rings out and fades. */
export function saleBellStrikeEnds(
  strikeTimes: number[],
  duration: number,
  gap = SALE_BELL_STRIKE_GAP,
  tail = SALE_BELL_TAIL,
): number[] {
  return strikeTimes.map((start, i) =>
    i === strikeTimes.length - 1 ? start + Math.min(duration, tail) : start + gap,
  );
}
