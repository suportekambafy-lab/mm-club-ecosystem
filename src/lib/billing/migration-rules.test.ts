import { describe, expect, it } from "vitest";
import { MIGRATION_DEBT_VERIFY_DAYS, migrationPrepaidDays, isPaddleCardVerification } from "./migration-rules";

const now = Date.parse("2026-10-13T12:00:00Z");

describe("migrationPrepaidDays", () => {
  it("a verificação Paddle de 0 € não renova nem regulariza a subscrição existente", () => {
    expect(isPaddleCardVerification("paddle", 0, "subscription-existing")).toBe(true);
  });
  it("a cobrança real posterior não é uma verificação de cartão", () => {
    expect(isPaddleCardVerification("paddle", 2990, "subscription-existing")).toBe(false);
  });
  it("a entrada nova em trial mantém a ativação normal", () => {
    expect(isPaddleCardVerification("paddle", 0, null)).toBe(false);
  });
  it("quem já pagou o mês só é cobrado no fim do período", () => {
    expect(migrationPrepaidDays("2026-11-02T12:00:00Z", now)).toBe(20);
  });
  it("período terminado → cobra logo", () => {
    expect(migrationPrepaidDays("2026-10-10T00:00:00Z", now)).toBe(0);
  });
  it("sem data → cobra logo", () => {
    expect(migrationPrepaidDays(null, now)).toBe(0);
  });
  it("quem está em dívida verifica o cartão a 0 € e é cobrado no dia seguinte", () => {
    expect(MIGRATION_DEBT_VERIFY_DAYS).toBe(1);
  });
});
