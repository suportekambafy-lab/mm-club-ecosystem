import { describe, expect, it } from "vitest";
import { MIGRATION_DEBT_VERIFY_DAYS, migrationPrepaidDays } from "./migration-rules";

const now = Date.parse("2026-10-13T12:00:00Z");

describe("migrationPrepaidDays", () => {
  it("quem já pagou o mês só é cobrado no fim do período", () => {
    expect(migrationPrepaidDays("2026-11-02T12:00:00Z", now)).toBe(20);
  });
  it("período terminado → cobra logo", () => {
    expect(migrationPrepaidDays("2026-10-10T00:00:00Z", now)).toBe(0);
  });
  it("sem data → cobra logo", () => {
    expect(migrationPrepaidDays(null, now)).toBe(0);
  });
});
