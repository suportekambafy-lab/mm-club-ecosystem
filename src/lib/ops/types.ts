/** Client-safe shapes for the billing health dashboard. */
export type HealthLevel = "ok" | "warn" | "down";

export type HealthCheck = {
  id: string;
  label: string;
  level: HealthLevel;
  detail: string;
};

export type WebhookLogItem = {
  id: string;
  gateway: string;
  gatewayPaymentId: string | null;
  outcome: string;
  error: string | null;
  durationMs: number | null;
  receivedAt: string;
};

export type BillingHealth = {
  generatedAt: string;
  checks: HealthCheck[];
  queue: {
    pending: number;
    due: number;
    running: number;
    failed: number;
    dead: number;
    doneLast24h: number;
    avgProcessingMs: number | null;
    oldestPendingAt: string | null;
    byConsumer: { consumer: string; pending: number; failed: number }[];
  };
  cron: {
    lastRunAt: string | null;
    ok: boolean | null;
    durationMs: number | null;
    runs: number;
    minutesAgo: number | null;
  };
  webhooks: {
    last24h: number;
    processed24h: number;
    rejected24h: number;
    errors24h: number;
    lastReceivedAt: string | null;
    avgDurationMs: number | null;
    recent: WebhookLogItem[];
  };
  payments: {
    paid24h: number;
    failed24h: number;
    recovered24h: number;
    volumeCents24h: number;
  };
  emails: {
    sent24h: number;
    failed24h: number;
  };
  ledger: {
    entries: number;
    inconsistentUsers: number;
    lastEntryAt: string | null;
  };
  gateway: {
    name: string;
    environment: string | null;
    reachable: boolean;
    latencyMs: number | null;
    error: string | null;
  };
};
