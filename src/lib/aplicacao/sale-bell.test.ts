import { describe, expect, it } from "vitest";
import {
  SALE_BELL_STRIKE_DECAY,
  SALE_BELL_STRIKE_GAP,
  SALE_BELL_STRIKES,
  saleBellStrikeEnds,
  saleBellStrikePause,
  saleBellStrikeTimes,
} from "./sale-bell";

describe("sale bell", () => {
  it("strikes three times per closed sale", () => {
    expect(SALE_BELL_STRIKES).toBe(3);
    expect(saleBellStrikeTimes()).toHaveLength(3);
  });

  it("spaces the strikes apart so each hit is heard", () => {
    const times = saleBellStrikeTimes();
    expect(times[0]).toBe(0);
    expect(times[1]).toBe(SALE_BELL_STRIKE_GAP);
    expect(times[2]).toBe(SALE_BELL_STRIKE_GAP * 2);
    expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true);
  });

  it("ends every strike before the next one starts, leaving a pause", () => {
    const times = saleBellStrikeTimes();
    const ends = saleBellStrikeEnds(times, 5);
    expect(ends[0]).toBeLessThan(times[1]);
    expect(ends[1]).toBeLessThan(times[2]);
    expect(saleBellStrikePause()).toBeGreaterThan(0.2);
    expect(SALE_BELL_STRIKE_DECAY).toBeLessThan(SALE_BELL_STRIKE_GAP);
  });

  it("cuts each hit short instead of ringing for the whole sample", () => {
    const ends = saleBellStrikeEnds(saleBellStrikeTimes(), 5);
    expect(ends[0]).toBeCloseTo(SALE_BELL_STRIKE_GAP * 0.8, 5);
    expect(ends[2]).toBeCloseTo(SALE_BELL_STRIKE_GAP * 2 + SALE_BELL_STRIKE_DECAY, 5);
    expect(saleBellStrikeEnds([0], 0.5)[0]).toBeCloseTo(0.5, 5);
  });

  it("falls back to a single strike when asked for an invalid count", () => {
    expect(saleBellStrikeTimes(0)).toEqual([0]);
    expect(saleBellStrikeTimes(1)).toEqual([0]);
  });
});
