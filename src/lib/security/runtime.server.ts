/**
 * Server-only security runtime: event log, sliding-window counters,
 * logical WAF and the Emergency Mode kill switch.
 *
 * Everything is best-effort on the write path: a failed audit write must
 * never break a legitimate request, but a failed *check* always fails closed.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SecuritySeverity = "info" | "warn" | "critical";

export interface SecurityEventInput {
  kind: string;
  severity?: SecuritySeverity;
  userId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  route?: string | null;
  outcome?: "allowed" | "blocked" | "failed";
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS =
  /pass|token|secret|key|authorization|card|cvv|iban|pan|mandate/i;

/** Strips anything that must never reach the audit log. */
function scrub(value: Record<string, unknown> | undefined) {
  if (!value) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(k)) continue;
    out[k] = typeof v === "string" && v.length > 500 ? v.slice(0, 500) : v;
  }
  return out;
}

export async function recordSecurityEvent(
  input: SecurityEventInput,
): Promise<void> {
  try {
    await supabaseAdmin.from("security_events").insert({
      kind: input.kind,
      severity: input.severity ?? "info",
      user_id: input.userId ?? null,
      actor_email: input.actorEmail ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      route: input.route ?? null,
      outcome: input.outcome ?? "blocked",
      reason: input.reason ?? null,
      metadata: scrub(input.metadata) as never,
    });
  } catch (err) {
    console.error("[security] event write failed", err);
  }
}

/** Atomic sliding-window counter. Returns the count inside the window. */
export async function bumpCounter(
  bucket: string,
  subject: string,
  windowSeconds: number,
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("security_bump_counter", {
    _bucket: bucket,
    _subject: subject,
    _window_seconds: windowSeconds,
  });
  if (error) {
    // Fail closed on the check path: an unavailable limiter must not become
    // an open door for abuse.
    throw new Error("rate_limiter_unavailable");
  }
  return (data as number) ?? 0;
}

export interface EmergencyState {
  enabled: boolean;
  reason: string | null;
  since: string | null;
}

type ModeKey = "emergency_mode" | "read_only_mode";

const modeCache = new Map<ModeKey, { value: EmergencyState; at: number }>();
const MODE_TTL_MS = 3000; // kill switch propagates in under 5 seconds

async function getModeState(key: ModeKey): Promise<EmergencyState> {
  const now = Date.now();
  const cached = modeCache.get(key);
  if (cached && now - cached.at < MODE_TTL_MS) return cached.value;
  try {
    const { data } = await supabaseAdmin
      .from("security_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const value = (data?.value ?? {}) as Partial<EmergencyState>;
    const state: EmergencyState = {
      enabled: value.enabled === true,
      reason: value.reason ?? null,
      since: value.since ?? null,
    };
    modeCache.set(key, { value: state, at: now });
    return state;
  } catch (err) {
    console.error(`[security] ${key} read failed`, err);
    return cached?.value ?? { enabled: false, reason: null, since: null };
  }
}

async function setModeState(
  key: ModeKey,
  input: { enabled: boolean; reason: string | null; actorId: string },
): Promise<EmergencyState> {
  const state: EmergencyState = {
    enabled: input.enabled,
    reason: input.reason,
    since: input.enabled ? new Date().toISOString() : null,
  };
  await supabaseAdmin.from("security_settings").upsert(
    {
      key,
      value: state as never,
      updated_at: new Date().toISOString(),
      updated_by: input.actorId,
    },
    { onConflict: "key" },
  );
  modeCache.set(key, { value: state, at: Date.now() });
  return state;
}

export const getEmergencyState = () => getModeState("emergency_mode");
export const setEmergencyState = (input: {
  enabled: boolean;
  reason: string | null;
  actorId: string;
}) => setModeState("emergency_mode", input);

export const getReadOnlyState = () => getModeState("read_only_mode");
export const setReadOnlyState = (input: {
  enabled: boolean;
  reason: string | null;
  actorId: string;
}) => setModeState("read_only_mode", input);

/**
 * Administrative alert (security / billing fraud). Deduplicated so the same
 * signal inside the same window does not spam the dashboard.
 */
export async function raiseAlert(input: {
  category: string;
  level?: "info" | "warn" | "critical";
  title: string;
  detail?: string | null;
  subject?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from("security_alerts").upsert(
      {
        category: input.category,
        level: input.level ?? "warn",
        title: input.title,
        detail: input.detail ?? null,
        subject: input.subject ?? null,
        user_id: input.userId ?? null,
        metadata: (input.metadata ?? {}) as never,
        dedupe_key: input.dedupeKey ?? `${input.category}:${input.title}`,
        status: "open",
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
  } catch (err) {
    console.error("[security] alert write failed", err);
  }
}


export interface AdminActionInput {
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  geo?: string | null;
}

/** Full before/after trail for every administrative change. */
export async function recordAdminAction(
  input: AdminActionInput,
): Promise<void> {
  try {
    await supabaseAdmin.from("admin_action_log").insert({
      actor_id: input.actorId,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      before: (input.before ?? null) as never,
      after: (input.after ?? null) as never,
      ip: input.ip ?? null,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      geo: input.geo ?? null,
    });
  } catch (err) {
    console.error("[security] admin action write failed", err);
  }
}
