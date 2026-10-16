import { describe, expect, it } from "vitest";
import { SALE_BELL_STRIKES, SALE_BELL_STRIKE_GAP_MS, SALE_BELL_STRIKE_TIMEOUT_MS } from "./sale-bell";

describe("sale bell", () => {
  it("plays the sound three times per closed sale", () => {
    expect(SALE_BELL_STRIKES).toBe(3);
  });

  it("leaves a short pause between strikes", () => {
    expect(SALE_BELL_STRIKE_GAP_MS).toBeGreaterThan(0);
    expect(SALE_BELL_STRIKE_GAP_MS).toBeLessThan(1000);
  });

  it("never hangs waiting for one strike to finish", () => {
    expect(SALE_BELL_STRIKE_TIMEOUT_MS).toBeGreaterThan(SALE_BELL_STRIKE_GAP_MS);
  });
});
