/**
 * MMpay — regras das assinaturas (pagamentos recorrentes). Módulo puro.
 * Não há valores, periodicidades nem durações predefinidas: o comercial define tudo.
 */
import { z } from "zod";

export const BILLING_INTERVALS = ["week", "month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export const SUBSCRIPTION_STATUSES = ["pending", "active", "past_due", "cancelled", "completed"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Uma cobrança falhada volta a ser tentada até este número de vezes, com 1 dia de intervalo. */
export const MAX_CHARGE_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 24 * 3600_000;

export const subscriptionTermsSchema = z
  .object({
    interval: z.enum(BILLING_INTERVALS),
    intervalCount: z.number().int().min(1).max(24),
    /** null = tempo indeterminado */
    totalCycles: z.number().int().min(1).max(600).nullable(),
  })
  .strict();
export type SubscriptionTerms = z.infer<typeof subscriptionTermsSchema>;

export function addBillingInterval(from: Date, interval: BillingInterval, count: number): Date {
  const d = new Date(from);
  if (interval === "week") d.setUTCDate(d.getUTCDate() + 7 * count);
  else if (interval === "month") {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + count);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else d.setUTCFullYear(d.getUTCFullYear() + count);
  return d;
}

/**
 * Divide um valor total em `n` prestações inteiras (cêntimos). Os cêntimos que
 * sobram da divisão ficam nas primeiras prestações: 10 000 em 3 → [3334, 3333, 3333].
 * A soma das prestações é sempre exatamente o total.
 */
export function splitInstallments(totalCents: number, installments: number): number[] {
  const n = Math.max(1, Math.floor(installments));
  const base = Math.floor(totalCents / n);
  const extra = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Valores de cada prestação: usa o plano personalizado (`schedule`) quando é válido
 * (mesmo número de prestações e soma igual ao total); senão divide em partes iguais.
 */
export function installmentAmounts(totalCents: number, cycles: number, schedule?: number[] | null): number[] {
  if (schedule && isValidSchedule(schedule, totalCents, cycles)) return [...schedule];
  return splitInstallments(totalCents, cycles);
}

export function isValidSchedule(schedule: number[], totalCents: number, cycles: number): boolean {
  return (
    schedule.length === cycles &&
    schedule.every((c) => Number.isInteger(c) && c >= 100) &&
    schedule.reduce((a, b) => a + b, 0) === totalCents
  );
}

/** 1.ª prestação fixa; o resto do total é dividido em partes iguais pelas restantes. */
export function firstThenSplit(totalCents: number, cycles: number, firstCents: number): number[] {
  if (cycles <= 1) return [totalCents];
  return [firstCents, ...splitInstallments(totalCents - firstCents, cycles - 1)];
}

/** Depois de `chargesDone` cobranças pagas, a assinatura terminou? */
export function isSubscriptionComplete(chargesDone: number, totalCycles: number | null): boolean {
  return totalCycles != null && chargesDone >= totalCycles;
}

/** Estado e próxima data após uma cobrança paga. */
export function afterPaidCharge(input: {
  chargesDone: number;
  totalCycles: number | null;
  interval: BillingInterval;
  intervalCount: number;
  anchor: Date;
}): { status: "active" | "completed"; nextChargeAt: Date | null } {
  if (isSubscriptionComplete(input.chargesDone, input.totalCycles)) return { status: "completed", nextChargeAt: null };
  return { status: "active", nextChargeAt: addBillingInterval(input.anchor, input.interval, input.intervalCount) };
}

/** Após uma falha: tenta de novo amanhã, ou para de tentar ao fim de MAX_CHARGE_ATTEMPTS. */
export function afterFailedCharge(attempt: number, now: Date): { nextChargeAt: Date | null } {
  return { nextChargeAt: attempt >= MAX_CHARGE_ATTEMPTS ? null : new Date(now.getTime() + RETRY_DELAY_MS) };
}

export function intervalLabel(interval: BillingInterval, count: number): string {
  const one = { week: "semana", month: "mês", year: "ano" }[interval];
  const many = { week: "semanas", month: "meses", year: "anos" }[interval];
  return count === 1 ? `por ${one}` : `a cada ${count} ${many}`;
}
