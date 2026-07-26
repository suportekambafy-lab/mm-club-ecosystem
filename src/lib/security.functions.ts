/**
 * Security API — admin-only. Every function goes through the Security Gate.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { secured } from "@/lib/security/gate";

export type SecurityEventRow = {
  id: string;
  kind: string;
  severity: string;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  route: string | null;
  outcome: string;
  reason: string | null;
  createdAt: string;
};

export type AdminActionRow = {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: string | null;
  after: string | null;
  ip: string | null;
  userAgent: string | null;
  geo: string | null;
  createdAt: string;
};

export type SecurityAlert = {
  id: string;
  level: "warn" | "critical";
  title: string;
  detail: string;
};

export type SecurityOverview = {
  emergency: { enabled: boolean; reason: string | null; since: string | null };
  counts24h: Record<string, number>;
  failedLogins24h: number;
  blocked24h: number;
  adminAccess24h: number;
  webhookFailures24h: number;
  topIps: Array<{ ip: string; count: number }>;
  alerts: SecurityAlert[];
  events: SecurityEventRow[];
  adminActions: AdminActionRow[];
};

export const getSecurityOverview = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.overview",
      admin: true,
      limit: { bucket: "security-overview", max: 120, windowSeconds: 3600 },
    }),
  ])
  .handler(async (): Promise<SecurityOverview> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { getEmergencyState } = await import("@/lib/security/runtime.server");

    const since = new Date(Date.now() - 86_400_000).toISOString();

    const [emergency, recentRes, actionsRes, dayRes, webhookRes] =
      await Promise.all([
        getEmergencyState(),
        supabaseAdmin
          .from("security_events")
          .select(
            "id, kind, severity, user_id, ip, user_agent, route, outcome, reason, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("admin_action_log")
          .select(
            "id, actor_email, action, entity_type, entity_id, before, after, ip, user_agent, geo, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("security_events")
          .select("kind, outcome, ip")
          .gte("created_at", since)
          .limit(5000),
        supabaseAdmin
          .from("ops_webhook_log")
          .select("outcome")
          .gte("received_at", since)
          .limit(2000),
      ]);

    const day = dayRes.data ?? [];
    const counts: Record<string, number> = {};
    const ipCounts = new Map<string, number>();
    for (const row of day) {
      counts[row.kind] = (counts[row.kind] ?? 0) + 1;
      if (row.ip && row.outcome === "blocked") {
        ipCounts.set(row.ip, (ipCounts.get(row.ip) ?? 0) + 1);
      }
    }

    const failedLogins = counts["login_failed"] ?? 0;
    const blocked = day.filter((r) => r.outcome === "blocked").length;
    const adminAccess = counts["admin_access"] ?? 0;
    const webhookFailures = (webhookRes.data ?? []).filter(
      (w) => w.outcome === "error" || w.outcome === "rejected",
    ).length;

    const topIps = [...ipCounts.entries()]
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const alerts: SecurityAlert[] = [];
    if (emergency.enabled) {
      alerts.push({
        id: "emergency",
        level: "critical",
        title: "Modo de emergência ativo",
        detail: emergency.reason ?? "Operações sensíveis bloqueadas.",
      });
    }
    if (failedLogins >= 20) {
      alerts.push({
        id: "logins",
        level: "warn",
        title: `${failedLogins} tentativas de login falhadas nas últimas 24h`,
        detail: "Pico acima do normal — verifique os IPs em destaque.",
      });
    }
    if ((counts["authz_denied"] ?? 0) >= 5) {
      alerts.push({
        id: "authz",
        level: "critical",
        title: `${counts["authz_denied"]} tentativas de acesso admin negadas`,
        detail: "Alguém está a tentar chegar a funções de administração.",
      });
    }
    if ((counts["waf_blocked"] ?? 0) > 0) {
      alerts.push({
        id: "waf",
        level: "warn",
        title: `${counts["waf_blocked"]} bloqueios por comportamento suspeito`,
        detail: "Padrões repetidos de alteração de plano ou pagamento.",
      });
    }
    if ((counts["rate_limited"] ?? 0) >= 25) {
      alerts.push({
        id: "rate",
        level: "warn",
        title: `${counts["rate_limited"]} pedidos travados por limite de utilização`,
        detail: "Possível abuso automatizado.",
      });
    }
    if (webhookFailures >= 3) {
      alerts.push({
        id: "webhooks",
        level: "critical",
        title: `${webhookFailures} falhas de webhook nas últimas 24h`,
        detail: "Pagamentos podem não estar a ser reconciliados.",
      });
    }
    if (topIps[0] && topIps[0].count >= 30) {
      alerts.push({
        id: "ip",
        level: "critical",
        title: `IP ${topIps[0].ip} com ${topIps[0].count} pedidos bloqueados`,
        detail: "Comportamento compatível com ataque automatizado.",
      });
    }

    return {
      emergency,
      counts24h: counts,
      failedLogins24h: failedLogins,
      blocked24h: blocked,
      adminAccess24h: adminAccess,
      webhookFailures24h: webhookFailures,
      topIps,
      alerts,
      events: (recentRes.data ?? []).map((r) => ({
        id: r.id,
        kind: r.kind,
        severity: r.severity,
        userId: r.user_id,
        ip: r.ip,
        userAgent: r.user_agent,
        route: r.route,
        outcome: r.outcome,
        reason: r.reason,
        createdAt: r.created_at,
      })),
      adminActions: (actionsRes.data ?? []).map((r) => ({
        id: r.id,
        actorEmail: r.actor_email,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        before: r.before ? JSON.stringify(r.before) : null,
        after: r.after ? JSON.stringify(r.after) : null,
        ip: r.ip,
        userAgent: r.user_agent,
        geo: r.geo,
        createdAt: r.created_at,
      })),
    };
  });

/** Kill switch. Takes effect across the whole app in under 5 seconds. */
export const setEmergencyMode = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.setEmergencyMode",
      admin: true,
      limit: { bucket: "emergency-toggle", max: 20, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        reason: z.string().max(300).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setEmergencyState, getEmergencyState, recordAdminAction, recordSecurityEvent } =
      await import("@/lib/security/runtime.server");

    const before = await getEmergencyState();
    const after = await setEmergencyState({
      enabled: data.enabled,
      reason: data.reason ?? null,
      actorId: context.userId,
    });

    await recordAdminAction({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      action: data.enabled ? "emergency_mode.enable" : "emergency_mode.disable",
      entityType: "security_settings",
      entityId: "emergency_mode",
      before,
      after,
      ip: context.security.ip,
      userAgent: context.security.userAgent,
    });
    await recordSecurityEvent({
      kind: data.enabled ? "emergency_enabled" : "emergency_disabled",
      severity: "critical",
      userId: context.userId,
      ip: context.security.ip,
      userAgent: context.security.userAgent,
      outcome: "allowed",
      reason: data.reason ?? null,
    });

    return after;
  });

/**
 * Public, IP-rate-limited signal so failed logins show up in the dashboard.
 * Never stores the email or password — only the fact and the origin.
 */
export const reportAuthFailure = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.reportAuthFailure",
      auth: false,
      limit: { bucket: "auth-failure", max: 40, windowSeconds: 3600, scope: "ip" },
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({ stage: z.enum(["login", "signup", "recovery"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { recordSecurityEvent } = await import("@/lib/security/runtime.server");
    await recordSecurityEvent({
      kind: "login_failed",
      severity: "warn",
      ip: context.security.ip,
      userAgent: context.security.userAgent,
      outcome: "blocked",
      reason: data.stage,
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Read Only Mode                                                      */
/* ------------------------------------------------------------------ */

export const setReadOnlyMode = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.setReadOnlyMode",
      admin: true,
      limit: { bucket: "readonly-toggle", max: 30, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        reason: z.string().max(300).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getReadOnlyState, setReadOnlyState, recordSecurityEvent } =
      await import("@/lib/security/runtime.server");
    const { auditAdmin } = await import("@/lib/security/audit.server");

    const before = await getReadOnlyState();
    const after = await auditAdmin(
      context as never,
      {
        action: data.enabled ? "read_only.enable" : "read_only.disable",
        entityType: "security_settings",
        entityId: "read_only_mode",
        before,
      },
      () =>
        setReadOnlyState({
          enabled: data.enabled,
          reason: data.reason ?? null,
          actorId: context.userId,
        }),
    );
    await recordSecurityEvent({
      kind: data.enabled ? "read_only_enabled" : "read_only_disabled",
      severity: "critical",
      userId: context.userId,
      ip: context.security.ip,
      userAgent: context.security.userAgent,
      outcome: "allowed",
      reason: data.reason ?? null,
    });
    return after;
  });

/** Public read: lets the UI show a maintenance banner and disable writes. */
export const getPlatformModes = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.modes",
      auth: false,
      limit: { bucket: "modes", max: 600, windowSeconds: 3600, scope: "ip" },
    }),
  ])
  .handler(async () => {
    const { getEmergencyState, getReadOnlyState } = await import(
      "@/lib/security/runtime.server"
    );
    const [emergency, readOnly] = await Promise.all([
      getEmergencyState(),
      getReadOnlyState(),
    ]);
    return { emergency, readOnly };
  });

/* ------------------------------------------------------------------ */
/* Session security & device trust                                     */
/* ------------------------------------------------------------------ */

export const registerDeviceSession = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.registerSession",
      limit: { bucket: "session-register", max: 120, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({
        fingerprint: z.string().min(6).max(120),
        sessionToken: z.string().min(10).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { registerSession } = await import("@/lib/security/devices.server");
    return registerSession({
      userId: context.userId,
      fingerprint: data.fingerprint,
      sessionToken: data.sessionToken,
      ip: context.security.ip,
      userAgent: context.security.userAgent,
      country: context.security.country,
      city: context.security.city,
    });
  });

/** Heartbeat: tells the client to sign out when its session was revoked. */
export const checkSession = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.checkSession",
      limit: { bucket: "session-check", max: 600, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z.object({ sessionToken: z.string().min(10).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { touchSession } = await import("@/lib/security/devices.server");
    return touchSession(data.sessionToken);
  });

export const endSession = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.endSession",
      limit: { bucket: "session-end", max: 120, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z.object({ sessionToken: z.string().min(10).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { revokeSession } = await import("@/lib/security/devices.server");
    await revokeSession({ sessionToken: data.sessionToken, reason: "logout" });
    return { ok: true };
  });

/** Self-service or admin: terminate every session of an account. */
export const terminateAllSessions = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.terminateAllSessions",
      limit: { bucket: "session-terminate", max: 30, windowSeconds: 3600 },
      write: true,
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid().nullable().optional(),
        exceptToken: z.string().max(120).nullable().optional(),
      })
      .default({})
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const target = data.userId ?? context.userId;
    if (target !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Forbidden");
    }
    const { revokeAllSessions } = await import(
      "@/lib/security/devices.server"
    );
    const { auditAdmin } = await import("@/lib/security/audit.server");
    const count = await auditAdmin(
      context as never,
      {
        action: "sessions.terminate_all",
        entityType: "user",
        entityId: target,
      },
      () =>
        revokeAllSessions({
          userId: target,
          reason: target === context.userId ? "self" : "admin",
          exceptToken: data.exceptToken ?? null,
        }),
    );
    return { ok: true, count };
  });

export const listDevices = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.listDevices",
      limit: { bucket: "devices-list", max: 200, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({ userId: z.string().uuid().nullable().optional() })
      .default({})
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const target = data.userId ?? context.userId;
    if (target !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Forbidden");
    }
    const { listUserDevices } = await import("@/lib/security/devices.server");
    return listUserDevices(target);
  });

/* ------------------------------------------------------------------ */
/* Score, continuous scan and abuse/fraud sweep                        */
/* ------------------------------------------------------------------ */

export const getSecurityScore = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.score",
      admin: true,
      limit: { bucket: "security-score", max: 200, windowSeconds: 3600 },
    }),
  ])
  .handler(async () => {
    const { latestScan, runSecurityScan } = await import(
      "@/lib/security/score.server"
    );
    const last = await latestScan();
    if (last && Date.now() - new Date(last.createdAt).getTime() < 3_600_000) {
      return last;
    }
    return runSecurityScan("auto");
  });

export const runSecurityScanNow = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.scan",
      admin: true,
      limit: { bucket: "security-scan", max: 30, windowSeconds: 3600 },
    }),
  ])
  .handler(async ({ context }) => {
    const { runSecurityScan } = await import("@/lib/security/score.server");
    const { runAbuseSweep } = await import("@/lib/security/fraud.server");
    const { auditAdmin } = await import("@/lib/security/audit.server");
    return auditAdmin(
      context as never,
      { action: "security.scan", entityType: "security_scans" },
      async () => {
        await runAbuseSweep();
        return runSecurityScan("manual");
      },
    );
  });

export type SecurityAlertRow = {
  id: string;
  category: string;
  level: string;
  title: string;
  detail: string | null;
  subject: string | null;
  status: string;
  createdAt: string;
};

export const listSecurityAlerts = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.alerts",
      admin: true,
      limit: { bucket: "security-alerts", max: 300, windowSeconds: 3600 },
    }),
  ])
  .handler(async (): Promise<SecurityAlertRow[]> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data } = await supabaseAdmin
      .from("security_alerts")
      .select("id, category, level, title, detail, subject, status, created_at")
      .order("created_at", { ascending: false })
      .limit(150);
    return (data ?? []).map((r) => ({
      id: r.id,
      category: r.category,
      level: r.level,
      title: r.title,
      detail: r.detail,
      subject: r.subject,
      status: r.status,
      createdAt: r.created_at,
    }));
  });

export const resolveSecurityAlert = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "security.resolveAlert",
      admin: true,
      limit: { bucket: "security-alert-resolve", max: 200, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { auditAdmin } = await import("@/lib/security/audit.server");
    return auditAdmin(
      context as never,
      { action: "security.alert_resolve", entityType: "security_alerts", entityId: data.id },
      async () => {
        await supabaseAdmin
          .from("security_alerts")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolved_by: context.userId,
          })
          .eq("id", data.id);
        return { ok: true };
      },
    );
  });
