/**
 * API Abuse Detection and Billing Fraud Detection.
 *
 * Behavioural analysis on top of the volume rate limits. Nothing here ever
 * blocks a valid payment: the output is always an administrative alert
 * plus a security event.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { raiseAlert, recordSecurityEvent } from "./runtime.server";

const HOUR = 3_600_000;

function since(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

export interface AbuseFinding {
  code: string;
  level: "warn" | "critical";
  title: string;
  detail: string;
  subject: string | null;
}

/** API abuse: volume, diversity and repetition patterns per subject. */
export async function detectApiAbuse(): Promise<AbuseFinding[]> {
  const findings: AbuseFinding[] = [];
  const { data: counters } = await supabaseAdmin
    .from("security_counters")
    .select("bucket, subject, count, window_start")
    .gte("window_start", since(HOUR))
    .limit(5000);

  const bySubject = new Map<string, { total: number; buckets: Set<string>; top: [string, number] }>();
  for (const row of counters ?? []) {
    const cur = bySubject.get(row.subject) ?? {
      total: 0,
      buckets: new Set<string>(),
      top: ["", 0] as [string, number],
    };
    cur.total += row.count;
    cur.buckets.add(row.bucket);
    if (row.count > cur.top[1]) cur.top = [row.bucket, row.count];
    bySubject.set(row.subject, cur);
  }

  for (const [subject, agg] of bySubject) {
    if (agg.total >= 400) {
      findings.push({
        code: "api_volume",
        level: "critical",
        title: "Volume anormal de pedidos",
        detail: `${subject} fez ${agg.total} pedidos na última hora.`,
        subject,
      });
    }
    if (agg.buckets.size >= 12) {
      findings.push({
        code: "api_scan",
        level: "warn",
        title: "Varrimento de várias APIs",
        detail: `${subject} chamou ${agg.buckets.size} endpoints diferentes numa hora.`,
        subject,
      });
    }
    if (agg.top[1] >= 120) {
      findings.push({
        code: "api_repeat",
        level: "warn",
        title: "Chamadas repetidas à mesma API",
        detail: `${subject} chamou "${agg.top[0]}" ${agg.top[1]} vezes numa hora.`,
        subject,
      });
    }
    if (
      (agg.buckets.has("checkout") || agg.buckets.has("guest-checkout")) &&
      agg.total >= 15
    ) {
      findings.push({
        code: "checkout_burst",
        level: "critical",
        title: "Muitos checkouts em poucos minutos",
        detail: `${subject} iniciou vários checkouts em sequência.`,
        subject,
      });
    }
    if (agg.buckets.has("plan-change") && agg.top[1] >= 5) {
      findings.push({
        code: "plan_churn",
        level: "warn",
        title: "Mudança constante de plano",
        detail: `${subject} alterou o plano ${agg.top[1]} vezes numa hora.`,
        subject,
      });
    }
    if (agg.buckets.has("signup") && agg.top[1] >= 5) {
      findings.push({
        code: "signup_flood",
        level: "critical",
        title: "Criação repetida de contas",
        detail: `${subject} criou várias contas numa hora.`,
        subject,
      });
    }
  }
  return findings;
}

/** Billing-specific fraud signals. Alerts only — never blocks a payment. */
export async function detectBillingFraud(): Promise<AbuseFinding[]> {
  const findings: AbuseFinding[] = [];
  const day = since(24 * HOUR);

  const [intents, invoices, payments, methods] = await Promise.all([
    supabaseAdmin
      .from("billing_checkout_intents")
      .select("email, price_id, status, created_at")
      .gte("created_at", day)
      .limit(2000),
    supabaseAdmin
      .from("billing_invoices")
      .select("user_id, created_at")
      .gte("created_at", day)
      .limit(2000),
    supabaseAdmin
      .from("billing_payments")
      .select("user_id, status, created_at")
      .gte("created_at", day)
      .limit(3000),
    supabaseAdmin
      .from("billing_payment_methods")
      .select("user_id, brand, last4, created_at")
      .limit(5000),
  ]);

  // Repeated identical checkouts.
  const intentKeys = new Map<string, number>();
  for (const i of intents.data ?? []) {
    const k = `${i.email}|${i.price_id}`;
    intentKeys.set(k, (intentKeys.get(k) ?? 0) + 1);
  }
  for (const [k, n] of intentKeys) {
    if (n >= 5) {
      findings.push({
        code: "duplicate_checkouts",
        level: "warn",
        title: "Checkouts iguais repetidos",
        detail: `${n} checkouts idênticos em 24h (${k.split("|")[0]}).`,
        subject: k.split("|")[0],
      });
    }
  }

  // Abnormal invoice creation.
  const invByUser = new Map<string, number>();
  for (const inv of invoices.data ?? []) {
    invByUser.set(inv.user_id, (invByUser.get(inv.user_id) ?? 0) + 1);
  }
  for (const [userId, n] of invByUser) {
    if (n >= 8) {
      findings.push({
        code: "invoice_burst",
        level: "warn",
        title: "Criação anormal de faturas",
        detail: `${n} faturas emitidas em 24h para a mesma conta.`,
        subject: userId,
      });
    }
  }

  // Excess of failed retries.
  const failByUser = new Map<string, number>();
  for (const p of payments.data ?? []) {
    if (p.status === "failed" || p.status === "expired") {
      failByUser.set(p.user_id, (failByUser.get(p.user_id) ?? 0) + 1);
    }
  }
  for (const [userId, n] of failByUser) {
    if (n >= 5) {
      findings.push({
        code: "payment_retries",
        level: "critical",
        title: "Excesso de tentativas de pagamento falhadas",
        detail: `${n} pagamentos falhados em 24h na mesma conta.`,
        subject: userId,
      });
    }
  }

  // Card reuse across accounts + too many cards on one account.
  const cardAccounts = new Map<string, Set<string>>();
  const cardsByUser = new Map<string, number>();
  const recentMethodChanges = new Map<string, number>();
  for (const m of methods.data ?? []) {
    const card = `${m.brand ?? "?"}-${m.last4 ?? "?"}`;
    if (m.last4) {
      const set = cardAccounts.get(card) ?? new Set<string>();
      set.add(m.user_id);
      cardAccounts.set(card, set);
    }
    cardsByUser.set(m.user_id, (cardsByUser.get(m.user_id) ?? 0) + 1);
    if (m.created_at >= day) {
      recentMethodChanges.set(
        m.user_id,
        (recentMethodChanges.get(m.user_id) ?? 0) + 1,
      );
    }
  }
  for (const [card, accounts] of cardAccounts) {
    if (accounts.size >= 3) {
      findings.push({
        code: "card_shared",
        level: "critical",
        title: "Mesmo cartão em várias contas",
        detail: `Cartão ${card} associado a ${accounts.size} contas diferentes.`,
        subject: card,
      });
    }
  }
  for (const [userId, n] of cardsByUser) {
    if (n >= 6) {
      findings.push({
        code: "many_cards",
        level: "warn",
        title: "Muitos cartões na mesma conta",
        detail: `${n} métodos de pagamento associados à mesma conta.`,
        subject: userId,
      });
    }
  }
  for (const [userId, n] of recentMethodChanges) {
    if (n >= 4) {
      findings.push({
        code: "method_churn",
        level: "warn",
        title: "Alterações frequentes de método de pagamento",
        detail: `${n} métodos adicionados em 24h.`,
        subject: userId,
      });
    }
  }

  return findings;
}

/** Runs both detectors and persists alerts + events. */
export async function runAbuseSweep(): Promise<{
  api: AbuseFinding[];
  billing: AbuseFinding[];
}> {
  const [api, billing] = await Promise.all([
    detectApiAbuse(),
    detectBillingFraud(),
  ]);
  const stamp = new Date().toISOString().slice(0, 13); // hourly dedupe
  for (const f of [...api, ...billing]) {
    await raiseAlert({
      category: api.includes(f) ? "api_abuse" : "billing_fraud",
      level: f.level,
      title: f.title,
      detail: f.detail,
      subject: f.subject,
      dedupeKey: `${f.code}:${f.subject ?? "-"}:${stamp}`,
      metadata: { code: f.code },
    });
    await recordSecurityEvent({
      kind: f.code,
      severity: f.level,
      outcome: "allowed",
      reason: f.detail,
    });
  }
  return { api, billing };
}
