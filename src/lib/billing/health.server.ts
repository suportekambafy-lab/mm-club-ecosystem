/**
 * Billing health snapshot. Read-only aggregation over the queue, webhook log,
 * heartbeats, payments, emails and the ledger.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getGateway, DEFAULT_GATEWAY } from "./gateway/index.server";
import type { BillingHealth, HealthCheck, HealthLevel } from "@/lib/ops/types";

const DAY_MS = 24 * 60 * 60 * 1000;

async function count(
  table: string,
  build: (q: any) => any,
): Promise<number> {
  const { count: n } = await build(
    supabaseAdmin.from(table as never).select("*", {
      count: "exact",
      head: true,
    }),
  );
  return n ?? 0;
}

export async function collectBillingHealth(): Promise<BillingHealth> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const since24h = new Date(now - DAY_MS).toISOString();

  // ---- Queue -------------------------------------------------------------
  const [pending, due, running, failed, dead, doneLast24h] = await Promise.all([
    count("job_queue", (q) => q.eq("status", "pending")),
    count("job_queue", (q) => q.eq("status", "pending").lte("run_after", nowIso)),
    count("job_queue", (q) => q.eq("status", "running")),
    count("job_queue", (q) => q.eq("status", "failed")),
    count("job_queue", (q) => q.eq("status", "dead")),
    count("job_queue", (q) =>
      q.eq("status", "done").gte("completed_at", since24h),
    ),
  ]);

  const { data: doneRows } = await supabaseAdmin
    .from("job_queue")
    .select("created_at, completed_at")
    .eq("status", "done")
    .gte("completed_at", since24h)
    .limit(300);

  const durations = (doneRows ?? [])
    .map((r) =>
      r.completed_at && r.created_at
        ? new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()
        : null,
    )
    .filter((n): n is number => n != null && n >= 0);
  const avgProcessingMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const { data: oldestPending } = await supabaseAdmin
    .from("job_queue")
    .select("run_after")
    .eq("status", "pending")
    .order("run_after", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: openJobs } = await supabaseAdmin
    .from("job_queue")
    .select("consumer, status")
    .in("status", ["pending", "failed", "dead"])
    .limit(500);

  const byConsumerMap = new Map<
    string,
    { consumer: string; pending: number; failed: number }
  >();
  for (const row of openJobs ?? []) {
    const entry = byConsumerMap.get(row.consumer) ?? {
      consumer: row.consumer,
      pending: 0,
      failed: 0,
    };
    if (row.status === "pending") entry.pending += 1;
    else entry.failed += 1;
    byConsumerMap.set(row.consumer, entry);
  }

  // ---- Cron heartbeat ----------------------------------------------------
  const { data: hb } = await supabaseAdmin
    .from("ops_heartbeats")
    .select("last_run_at, ok, duration_ms, runs")
    .eq("key", "billing-tick")
    .maybeSingle();

  const minutesAgo = hb?.last_run_at
    ? Math.round((now - new Date(hb.last_run_at).getTime()) / 60000)
    : null;

  // ---- Webhooks ----------------------------------------------------------
  const { data: webhookRows } = await supabaseAdmin
    .from("ops_webhook_log")
    .select("id, gateway, gateway_payment_id, outcome, error, duration_ms, received_at")
    .gte("received_at", since24h)
    .order("received_at", { ascending: false })
    .limit(200);

  const wh = webhookRows ?? [];
  const whDurations = wh
    .map((r) => r.duration_ms)
    .filter((n): n is number => typeof n === "number");

  const { data: lastWebhook } = await supabaseAdmin
    .from("ops_webhook_log")
    .select("received_at")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ---- Payments ----------------------------------------------------------
  const { data: payRows } = await supabaseAdmin
    .from("billing_payments")
    .select("status, amount_cents, created_at")
    .gte("created_at", since24h)
    .limit(500);

  const paid24h = (payRows ?? []).filter((p) => p.status === "paid").length;
  const failedPayments24h = (payRows ?? []).filter(
    (p) => p.status === "failed" || p.status === "expired",
  ).length;
  const volumeCents24h = (payRows ?? [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  const recovered24h = await count("domain_events", (q) =>
    q.eq("type", "PaymentRecovered").gte("occurred_at", since24h),
  );

  // ---- Emails ------------------------------------------------------------
  const [emailsSent, emailsFailed] = await Promise.all([
    count("email_log", (q) => q.eq("status", "sent").gte("sent_at", since24h)),
    count("email_log", (q) => q.neq("status", "sent").gte("sent_at", since24h)),
  ]);

  // ---- Ledger consistency ------------------------------------------------
  const { data: ledgerRows } = await supabaseAdmin
    .from("billing_ledger_entries")
    .select("user_id, direction, amount_cents, balance_after, created_at")
    .order("created_at", { ascending: true })
    .limit(2000);

  const runningByUser = new Map<string, number>();
  const brokenUsers = new Set<string>();
  for (const row of ledgerRows ?? []) {
    const signed =
      row.direction === "credit" ? row.amount_cents : -row.amount_cents;
    const next = (runningByUser.get(row.user_id) ?? 0) + signed;
    runningByUser.set(row.user_id, next);
    if (row.balance_after != null && row.balance_after !== next) {
      brokenUsers.add(row.user_id);
    }
  }
  const lastEntryAt =
    (ledgerRows ?? []).length > 0
      ? (ledgerRows ?? [])[(ledgerRows ?? []).length - 1].created_at
      : null;
  const ledgerEntries = await count("billing_ledger_entries", (q) => q);

  // ---- Gateway reachability ---------------------------------------------
  const gw = getGateway(DEFAULT_GATEWAY);
  let reachable = false;
  let latencyMs: number | null = null;
  let gwError: string | null = null;
  let environment: string | null = null;
  const gwStart = Date.now();
  try {
    environment = gw.environment;
    // Cheap authenticated read: a non-existent payment still proves the
    // credentials and the network path are healthy.
    await gw.getPayment("tr_health_probe").catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // A 404 from the gateway means we reached it and were authenticated.
      if (/\[40[04]\]/.test(msg)) return null;
      throw err;
    });
    reachable = true;
  } catch (err) {
    gwError = err instanceof Error ? err.message : String(err);
  }
  latencyMs = Date.now() - gwStart;

  // ---- Checks ------------------------------------------------------------
  const checks: HealthCheck[] = [];
  const push = (
    id: string,
    label: string,
    level: HealthLevel,
    detail: string,
  ) => checks.push({ id, label, level, detail });

  push(
    "cron",
    "Cron / worker",
    minutesAgo == null
      ? "down"
      : minutesAgo > 20
        ? "down"
        : minutesAgo > 10
          ? "warn"
          : "ok",
    minutesAgo == null
      ? "Nunca executado"
      : `Última execução há ${minutesAgo} min`,
  );

  push(
    "queue",
    "Fila de jobs",
    dead > 0 || failed > 5 ? "down" : failed > 0 || due > 25 ? "warn" : "ok",
    `${due} por processar · ${failed} falhados · ${dead} mortos`,
  );

  push(
    "webhooks",
    "Webhooks",
    wh.filter((r) => r.outcome === "error").length > 0
      ? "warn"
      : lastWebhook?.received_at
        ? "ok"
        : "warn",
    lastWebhook?.received_at
      ? `Último recebido ${new Date(lastWebhook.received_at).toLocaleString("pt-PT")}`
      : "Nenhum webhook registado ainda",
  );

  push(
    "gateway",
    `Gateway ${gw.name}`,
    reachable ? "ok" : "down",
    reachable
      ? `Disponível (${environment}) · ${latencyMs} ms`
      : (gwError ?? "Indisponível"),
  );

  push(
    "ledger",
    "Livro-razão",
    brokenUsers.size > 0 ? "down" : "ok",
    brokenUsers.size > 0
      ? `${brokenUsers.size} utilizador(es) com saldo inconsistente`
      : `${ledgerEntries} entradas consistentes`,
  );

  push(
    "email",
    "Emails",
    emailsFailed > 3 ? "warn" : "ok",
    `${emailsSent} enviados · ${emailsFailed} falhados (24h)`,
  );

  return {
    generatedAt: nowIso,
    checks,
    queue: {
      pending,
      due,
      running,
      failed,
      dead,
      doneLast24h,
      avgProcessingMs,
      oldestPendingAt: oldestPending?.run_after ?? null,
      byConsumer: [...byConsumerMap.values()].sort(
        (a, b) => b.pending + b.failed - (a.pending + a.failed),
      ),
    },
    cron: {
      lastRunAt: hb?.last_run_at ?? null,
      ok: hb?.ok ?? null,
      durationMs: hb?.duration_ms ?? null,
      runs: Number(hb?.runs ?? 0),
      minutesAgo,
    },
    webhooks: {
      last24h: wh.length,
      processed24h: wh.filter((r) => r.outcome === "processed").length,
      rejected24h: wh.filter((r) => r.outcome === "rejected").length,
      errors24h: wh.filter((r) => r.outcome === "error").length,
      lastReceivedAt: lastWebhook?.received_at ?? null,
      avgDurationMs: whDurations.length
        ? Math.round(whDurations.reduce((a, b) => a + b, 0) / whDurations.length)
        : null,
      recent: wh.slice(0, 20).map((r) => ({
        id: r.id,
        gateway: r.gateway,
        gatewayPaymentId: r.gateway_payment_id,
        outcome: r.outcome,
        error: r.error,
        durationMs: r.duration_ms,
        receivedAt: r.received_at,
      })),
    },
    payments: {
      paid24h,
      failed24h: failedPayments24h,
      recovered24h,
      volumeCents24h,
    },
    emails: { sent24h: emailsSent, failed24h: emailsFailed },
    ledger: {
      entries: ledgerEntries,
      inconsistentUsers: brokenUsers.size,
      lastEntryAt,
    },
    gateway: {
      name: gw.name,
      environment,
      reachable,
      latencyMs,
      error: gwError,
    },
  };
}
