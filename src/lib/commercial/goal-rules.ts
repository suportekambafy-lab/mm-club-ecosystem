/**
 * Regras da "Meta do mês" mostrada no topo da visão geral comercial.
 * O objetivo é definido por mês (chave "AAAA-MM") e vale em euros, em cêntimos.
 */

/** Objetivo aplicado a qualquer mês sem objetivo próprio definido. */
export const DEFAULT_MONTHLY_GOAL_EUR_CENTS = 2_000_000;

/** Objetivos por mês, em cêntimos de euro. */
export const MONTHLY_GOAL_EUR_CENTS: Record<string, number> = {
  "2026-11": 20_000_00 / 10 * 100 / 100,
};

export function monthlyGoalEurCents(monthKey: string): number {
  return MONTHLY_GOAL_EUR_CENTS[monthKey] ?? DEFAULT_MONTHLY_GOAL_EUR_CENTS;
}

export type MonthlyWindow = { monthKey: string; startIso: string; endIso: string };

const TIME_ZONE = "Europe/Lisbon";

function zoneParts(date: Date, timeZone: string): Record<string, string> {
  const value: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date)) {
    if (part.type !== "literal") value[part.type] = part.value;
  }
  return value;
}

/** Quantos milissegundos o fuso está à frente de UTC naquele instante. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const v = zoneParts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour) % 24, Number(v.minute), Number(v.second));
  return asUtc - utcMs;
}

/** Instante UTC em que o dia pede-meia-noite no fuso dado. */
function instantInZone(year: number, month: number, day: number, timeZone: string): number {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - zoneOffsetMs(guess, timeZone);
  const second = guess - zoneOffsetMs(first, timeZone);
  return second === first ? first : Math.min(first, second);
}

/** Janela do mês no fuso de Lisboa: início incluído, fim excluído. */
export function monthlyWindow(date: Date, timeZone = TIME_ZONE): MonthlyWindow {
  const v = zoneParts(date, timeZone);
  const year = Number(v.year);
  const month = Number(v.month);
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  return {
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    startIso: new Date(instantInZone(year, month, 1, timeZone)).toISOString(),
    endIso: new Date(instantInZone(endYear, endMonth, 1, timeZone)).toISOString(),
  };
}

export type GoalProgress = { percent: number; remainingCents: number; reached: boolean };

/** Percentagem inteira (0-100), quanto falta e se a meta foi atingida. */
export function summarizeGoal(revenueCents: number, goalCents: number): GoalProgress {
  if (goalCents <= 0) return { percent: 0, remainingCents: 0, reached: false };
  return {
    percent: Math.min(100, Math.floor((revenueCents / goalCents) * 100)),
    remainingCents: Math.max(0, goalCents - revenueCents),
    reached: revenueCents >= goalCents,
  };
}
