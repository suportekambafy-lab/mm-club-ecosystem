/** Number of times the sale bell strikes for one closed sale. */
export const SALE_BELL_STRIKES = 3;

/** Seconds between the start of one strike and the next. */
export const SALE_BELL_STRIKE_GAP = 1.4;

/**
 * Start offsets (in seconds, relative to the first strike) for each bell strike.
 * The recorded bell is a single hit with a long decay, so strikes are spaced apart
 * and each one is faded out just before the next begins.
 */
export function saleBellStrikeTimes(strikes = SALE_BELL_STRIKES, gap = SALE_BELL_STRIKE_GAP): number[] {
  if (!Number.isInteger(strikes) || strikes < 1) return [0];
  if (!Number.isFinite(gap) || gap <= 0) return Array.from({ length: strikes }, () => 0);
  return Array.from({ length: strikes }, (_, i) => Math.round(i * gap * 1000) / 1000);
}

/** When each strike should stop ringing: the next strike starts, or the tail rings out. */
export function saleBellStrikeEnds(
  strikeTimes: number[],
  duration: number,
  gap = SALE_BELL_STRIKE_GAP,
): number[] {
  return strikeTimes.map((start, i) => (i === strikeTimes.length - 1 ? start + duration : start + gap));
}
