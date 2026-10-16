import { describe, expect, it } from "vitest";
import { SALE_BELL_STRIKE_GAP, SALE_BELL_STRIKES, saleBellStrikeEnds, saleBellStrikeTimes } from "./sale-bell";

describe("sale bell", () => {
  it("strikes three times per closed sale", () => {
    expect(saleBellStrikeTimes()).toHaveLength(3);
    expect(SALE_BELL_STRIKES).toBe(3);
  });

  it("spaces the strikes apart so each hit is heard", () => {
    const times = saleBellStrikeTimes();
    expect(times[0]).toBe(0);
    expect(times[1]).toBe(SALE_BELL_STRIKE_GAP);
    expect(times[2]).toBe(SALE_BELL_STRIKE_GAP * 2);
    expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true);
  });

  it("stops each strike before the next one starts and lets the last one ring out", () => {
    const times = saleBellStrikeTimes();
    const ends = saleBellStrikeEnds(times, 5);
    expect(ends[0]).toBeCloseTo(SALE_BELL_STRIKE_GAP, 5);
    expect(ends[1]).toBeCloseTo(SALE_BELL_STRIKE_GAP * 2, 5);
    expect(ends[2]).toBeCloseTo(SALE_BELL_STRIKE_GAP * 2 + 5, 5);
    expect(ends.every((end, i) => end > times[i])).toBe(true);
  });

  it("falls back to a single strike when asked for an invalid count", () => {
    expect(saleBellStrikeTimes(0)).toEqual([0]);
    expect(saleBellStrikeTimes(1)).toEqual([0]);
  });
});
