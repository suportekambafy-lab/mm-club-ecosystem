/**
 * Administrative audit trail.
 *
 * Every admin operation (create, edit, delete, publish, price, catalog,
 * plan, permission, coupon, setting, course, live, broadcast, user,
 * finance) is wrapped by `auditAdmin`, which records the actor, timestamp,
 * IP, user-agent, affected resource, before/after values, the result and
 * the request id. The log table is append-only at the database level.
 */
import { recordAdminAction } from "./runtime.server";
import type { SecurityContext } from "./gate";

export interface AuditContext {
  userId: string;
  claims?: unknown;
  security: SecurityContext;
}

export interface AuditSpec {
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Snapshot before the change (optional). */
  before?: unknown;
  /** Snapshot after the change; may also be returned by the operation. */
  after?: unknown;
}

function actorEmail(context: AuditContext): string | null {
  return (context.claims as { email?: string } | null)?.email ?? null;
}

/**
 * Runs `operation` and writes exactly one immutable audit entry with the
 * outcome — including failures, which are recorded as `failed`.
 */
export async function auditAdmin<T>(
  context: AuditContext,
  spec: AuditSpec,
  operation: () => Promise<T>,
): Promise<T> {
  const sec = context.security;
  try {
    const result = await operation();
    await recordAdminAction({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: spec.action,
      entityType: spec.entityType,
      entityId: spec.entityId ?? null,
      before: spec.before ?? null,
      after: spec.after ?? (result as unknown) ?? null,
      ip: sec.ip,
      userAgent: sec.userAgent,
      geo: [sec.city, sec.country].filter(Boolean).join(", ") || null,
      result: "success",
      requestId: sec.requestId,
    });
    return result;
  } catch (err) {
    await recordAdminAction({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: spec.action,
      entityType: spec.entityType,
      entityId: spec.entityId ?? null,
      before: spec.before ?? null,
      after: { error: err instanceof Error ? err.message : String(err) },
      ip: sec.ip,
      userAgent: sec.userAgent,
      geo: [sec.city, sec.country].filter(Boolean).join(", ") || null,
      result: "failed",
      requestId: sec.requestId,
    });
    throw err;
  }
}

/** Convenience: read a row snapshot for the before/after diff. */
export async function snapshot(
  table: string,
  id: string,
): Promise<unknown | null> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data } = await supabaseAdmin
      .from(table as never)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}
