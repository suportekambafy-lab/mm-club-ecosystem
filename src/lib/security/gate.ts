/**
 * The MM Club Security Gate.
 *
 * One common chain that every protected server function goes through:
 *
 *   Authentication -> Authorization -> Rate limit -> Logical WAF
 *   -> Emergency mode -> Input validation -> Business rules -> Handler
 *
 * A function only declares its policy; it never re-implements security.
 * Any failure inside the gate denies the request (fail-closed) and is
 * written to the security event log.
 */
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  EMERGENCY_DENY,
  GENERIC_AUTH_DENY,
  GENERIC_DENY,
  GENERIC_LIMIT_DENY,
  READ_ONLY_DENY,
  SecurityError,
  type RateLimitRule,
  type SecurityPolicy,
  type WafRule,
} from "./policy";

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

async function requestMeta() {
  const { getRequest, getRequestIP } = await import(
    "@tanstack/react-start/server"
  );
  let ip: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    ip = null;
  }
  let userAgent: string | null = null;
  let route: string | null = null;
  let country: string | null = null;
  let city: string | null = null;
  let requestId = crypto.randomUUID();
  try {
    const req = getRequest();
    userAgent = req?.headers.get("user-agent") ?? null;
    route = req ? new URL(req.url).pathname : null;
    country = req?.headers.get("cf-ipcountry") ?? null;
    city = req?.headers.get("cf-ipcity") ?? null;
    requestId =
      req?.headers.get("cf-ray") ??
      req?.headers.get("x-request-id") ??
      requestId;
  } catch {
    /* no request context */
  }
  return { ip, userAgent, route, country, city, requestId };
}

/**
 * Builds the gate middleware for a policy. Compose it with
 * `securedMiddleware(policy)` rather than using it directly.
 */
export interface SecurityContext {
  ip: string | null;
  userAgent: string | null;
  route: string | null;
  country: string | null;
  city: string | null;
  requestId: string;
  policy: string;
}

/** Runs the whole chain. Throws SecurityError on any denial. */
async function runGate(
  policy: SecurityPolicy,
  context: unknown,
): Promise<SecurityContext> {
  {

      const ctx = context as unknown as {
        userId?: string;
        supabase?: {
          rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
        };
      };
      const meta = await requestMeta();
      const userId = ctx.userId ?? null;

      const runtime = await import("./runtime.server");

      const deny = async (
        code: string,
        message: string,
        reason: string,
        severity: "info" | "warn" | "critical" = "warn",
        metadata: Record<string, unknown> = {},
      ): Promise<never> => {
        await runtime.recordSecurityEvent({
          kind: code,
          severity,
          userId,
          ip: meta.ip,
          userAgent: meta.userAgent,
          route: meta.route,
          outcome: "blocked",
          reason,
          metadata: { policy: policy.name, ...metadata },
        });
        throw new SecurityError(code, message);
      };

      // 1. Authentication is handled by requireSupabaseAuth (signature,
      //    expiry, issuer and subject are verified there). Defence in depth:
      if (policy.auth !== false && !userId) {
        await deny("auth_missing", GENERIC_AUTH_DENY, "no verified session");
      }

      // 2. Authorization — always server-side, never from the frontend.
      if (policy.admin) {
        const { data: isAdmin } = (await ctx.supabase!.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        })) as { data: boolean | null };
        if (!isAdmin) {
          await deny(
            "authz_denied",
            GENERIC_DENY,
            "admin role required",
            "critical",
          );
        }
        await runtime.recordSecurityEvent({
          kind: "admin_access",
          severity: "info",
          userId,
          ip: meta.ip,
          userAgent: meta.userAgent,
          route: meta.route,
          outcome: "allowed",
          reason: policy.name,
        });
      }

      if (policy.feature) {
        const { data: hasFeature } = (await ctx.supabase!.rpc("has_feature", {
          _user_id: userId,
          _feature: policy.feature,
        })) as { data: boolean | null };
        if (!hasFeature) {
          await deny(
            "entitlement_denied",
            GENERIC_DENY,
            `missing feature ${policy.feature}`,
          );
        }
      }

      // 3. Emergency Mode (kill switch).
      if (policy.emergency === "block") {
        const state = await runtime.getEmergencyState();
        if (state.enabled) {
          await deny(
            "emergency_block",
            EMERGENCY_DENY,
            state.reason ?? "emergency mode active",
            "critical",
          );
        }
      }

      // 4. Rate limits, per user and per IP.
      for (const rule of asArray<RateLimitRule>(policy.limit)) {
        const scope = rule.scope ?? "both";
        const subjects: string[] = [];
        if (scope !== "ip" && userId) subjects.push(`user:${userId}`);
        if (scope !== "user" && meta.ip) subjects.push(`ip:${meta.ip}`);
        for (const subject of subjects) {
          let count = 0;
          try {
            count = await runtime.bumpCounter(
              rule.bucket,
              subject,
              rule.windowSeconds,
            );
          } catch {
            await deny(
              "rate_limiter_unavailable",
              GENERIC_LIMIT_DENY,
              "limiter unavailable",
              "critical",
            );
          }
          if (count > rule.max) {
            await deny(
              "rate_limited",
              GENERIC_LIMIT_DENY,
              `${rule.bucket} over limit`,
              "warn",
              { bucket: rule.bucket, count, max: rule.max, subject },
            );
          }
        }
      }

      // 5. Logical WAF — abusive *behaviour*, not just volume.
      for (const rule of asArray<WafRule>(policy.waf)) {
        if (!userId) continue;
        let count = 0;
        try {
          count = await runtime.bumpCounter(
            `waf:${rule.bucket}`,
            `user:${userId}`,
            rule.windowSeconds,
          );
        } catch {
          await deny(
            "waf_unavailable",
            GENERIC_LIMIT_DENY,
            "waf unavailable",
            "critical",
          );
        }
        if (count > rule.max) {
          await deny(
            "waf_blocked",
            GENERIC_LIMIT_DENY,
            `suspicious pattern: ${rule.bucket}`,
            "critical",
            { bucket: rule.bucket, count, max: rule.max },
          );
        }
      }

      // 6. Input validation and business rules run inside the handler,
      //    after this gate has approved the caller.
      return {
        ip: meta.ip,
        userAgent: meta.userAgent,
        route: meta.route,
        policy: policy.name,
      };
  }
}

/** Gate for authenticated functions (auth -> authz -> limits -> WAF). */
export function securityGate(policy: SecurityPolicy) {
  return createMiddleware({ type: "function" }).server(
    async ({ next, context }) => {
      const security = await runGate(policy, context);
      return next({ context: { security } });
    },
  );
}

/** Gate for genuinely public endpoints (no session, IP-scoped limits). */
export function publicGate(policy: SecurityPolicy) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const security = await runGate({ ...policy, auth: false }, {});
    return next({ context: { security } });
  });
}

/**
 * The only middleware array a server function should use.
 * Authenticated by default; pass `auth: false` for genuinely public reads.
 */
export function secured<P extends SecurityPolicy>(
  policy: P,
): P["auth"] extends false
  ? readonly [ReturnType<typeof publicGate>]
  : readonly [typeof requireSupabaseAuth, ReturnType<typeof securityGate>] {
  return (
    policy.auth === false
      ? ([publicGate(policy)] as const)
      : ([requireSupabaseAuth, securityGate(policy)] as const)
  ) as never;
}
