/**
 * Admin Finance API — every function is gated on the `admin` role.
 * Thin wrappers only: all logic lives in `src/lib/admin/finance.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { secured } from "@/lib/security/gate";

import type {
  AdminSubscriptionRow,
  CatalogProductRow,
  CouponRow,
  CustomerDetail,
  FinanceOverview,
  SearchHit,
  SubscriptionStateRow,
} from "@/lib/admin/finance-types";
import type { RecoveryOverview } from "@/lib/admin/recovery-types";
import type { IntelligenceOverview } from "@/lib/admin/intelligence-types";
import type { SubscriptionStatus } from "@/lib/billing/types";

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const getFinanceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ range: z.string().max(20).optional() })
      .default({})
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<FinanceOverview> => {
    await assertAdmin(context as never);
    const { collectFinanceOverview } = await import(
      "@/lib/admin/finance.server"
    );
    const allowed = [
      "today",
      "yesterday",
      "7d",
      "30d",
      "month",
      "prev_month",
      "90d",
      "year",
      "all",
    ];
    const range = (
      allowed.includes(data.range ?? "") ? data.range : "30d"
    ) as FinanceRange;
    return collectFinanceOverview(range);
  });


export const listAdminSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.string().max(30).nullable().optional(),
        search: z.string().max(120).nullable().optional(),
      })
      .default({})
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminSubscriptionRow[]> => {
    await assertAdmin(context as never);
    const { listSubscriptions } = await import("@/lib/admin/finance.server");
    return listSubscriptions({
      status: (data.status as SubscriptionStatus | null) ?? null,
      search: data.search ?? null,
    });
  });

export const getCustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CustomerDetail> => {
    await assertAdmin(context as never);
    const { collectCustomerDetail } = await import(
      "@/lib/admin/finance.server"
    );
    return collectCustomerDetail(data.userId);
  });

export const searchBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ term: z.string().min(2).max(120) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    await assertAdmin(context as never);
    const { globalSearch } = await import("@/lib/admin/finance.server");
    return globalSearch(data.term);
  });

export const listAdminCoupons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CouponRow[]> => {
    await assertAdmin(context as never);
    const { listCoupons } = await import("@/lib/admin/finance.server");
    return listCoupons();
  });

export const createCoupon = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "finance.createCoupon",
      admin: true,
      write: true,
      limit: { bucket: "coupon-create", max: 60, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(2)
          .max(40)
          .regex(/^[A-Za-z0-9_-]+$/, "Apenas letras, números, _ e -"),
        name: z.string().trim().max(120).nullable().optional(),
        percentOff: z.number().min(1).max(100).nullable().optional(),
        amountOffCents: z.number().int().min(1).max(1_000_000).nullable().optional(),
        trialDaysOverride: z.number().int().min(1).max(365).nullable().optional(),
        duration: z.enum(["once", "repeating", "forever"]).default("once"),
        durationInMonths: z.number().int().min(1).max(60).nullable().optional(),
        maxRedemptions: z.number().int().min(1).max(100_000).nullable().optional(),
        validUntil: z.string().datetime().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { auditAdmin } = await import("@/lib/security/audit.server");
    return auditAdmin(
      context as never,
      {
        action: "coupon.create",
        entityType: "billing_coupons",
        entityId: data.code.toUpperCase(),
        after: data,
      },
      async () => {
        const { error } = await supabaseAdmin.from("billing_coupons").insert({
          code: data.code.toUpperCase(),
          name: data.name ?? null,
          percent_off: data.percentOff ?? null,
          amount_off_cents: data.amountOffCents ?? null,
          trial_days_override: data.trialDaysOverride ?? null,
          duration: data.duration,
          duration_in_months: data.durationInMonths ?? null,
          max_redemptions: data.maxRedemptions ?? null,
          valid_until: data.validUntil ?? null,
          active: true,
        });
        if (error) {
          throw new Error(
            error.code === "23505"
              ? "Já existe um cupão com esse código."
              : error.message,
          );
        }
        return { ok: true };
      },
    );
  });

/** Shared implementation for the "flip the active flag" admin toggles. */
function activeToggle(options: {
  name: string;
  table: "billing_coupons" | "catalog_products" | "catalog_prices";
  action: string;
  bucket: string;
}) {
  return createServerFn({ method: "POST" })
    .middleware([
      ...secured({
        name: options.name,
        admin: true,
        write: true,
        limit: { bucket: options.bucket, max: 120, windowSeconds: 3600 },
      }),
    ])
    .inputValidator((input: unknown) =>
      z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
    )
    .handler(async ({ data, context }) => {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const { auditAdmin, snapshot } = await import(
        "@/lib/security/audit.server"
      );
      const before = await snapshot(options.table, data.id);
      return auditAdmin(
        context as never,
        {
          action: options.action,
          entityType: options.table,
          entityId: data.id,
          before,
          after: { active: data.active },
        },
        async () => {
          const { error } = await supabaseAdmin
            .from(options.table)
            .update({ active: data.active })
            .eq("id", data.id);
          if (error) throw new Error(error.message);
          return { ok: true };
        },
      );
    });
}

export const setCouponActive = activeToggle({
  name: "finance.setCouponActive",
  table: "billing_coupons",
  action: "coupon.set_active",
  bucket: "coupon-toggle",
});

export const listAdminCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogProductRow[]> => {
    await assertAdmin(context as never);
    const { listCatalogAdmin } = await import("@/lib/admin/finance.server");
    return listCatalogAdmin();
  });

export const setProductActive = activeToggle({
  name: "finance.setProductActive",
  table: "catalog_products",
  action: "catalog.product.set_active",
  bucket: "product-toggle",
});

export const setPriceActive = activeToggle({
  name: "finance.setPriceActive",
  table: "catalog_prices",
  action: "catalog.price.set_active",
  bucket: "price-toggle",
});

/** Cancels or resumes any member's subscription from the backoffice. */
export const adminCancelSubscription = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "finance.cancelSubscription",
      admin: true,
      write: true,
      limit: { bucket: "admin-cancel", max: 60, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().uuid(),
        userId: z.string().uuid(),
        immediate: z.boolean().default(false),
        reason: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { auditAdmin, snapshot } = await import(
      "@/lib/security/audit.server"
    );
    const before = await snapshot("billing_subscriptions", data.subscriptionId);
    return auditAdmin(
      context as never,
      {
        action: "subscription.cancel",
        entityType: "billing_subscriptions",
        entityId: data.subscriptionId,
        before,
        after: { immediate: data.immediate, reason: data.reason ?? "admin" },
      },
      async () => {
        const { cancelSubscription } = await import(
          "@/lib/billing/commands.server"
        );
        await cancelSubscription({
          subscriptionId: data.subscriptionId,
          userId: data.userId,
          immediate: data.immediate,
          reason: data.reason ?? "admin",
        });
        const { drainQueue } = await import("@/lib/queue/worker.server");
        await drainQueue(10);
        return { ok: true };
      },
    );
  });

export const adminResumeSubscription = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "finance.resumeSubscription",
      admin: true,
      write: true,
      limit: { bucket: "admin-resume", max: 60, windowSeconds: 3600 },
    }),
  ])
  .inputValidator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { auditAdmin, snapshot } = await import(
      "@/lib/security/audit.server"
    );
    const before = await snapshot("billing_subscriptions", data.subscriptionId);
    return auditAdmin(
      context as never,
      {
        action: "subscription.resume",
        entityType: "billing_subscriptions",
        entityId: data.subscriptionId,
        before,
      },
      async () => {
        const { resumeSubscription } = await import(
          "@/lib/billing/commands.server"
        );
        await resumeSubscription({
          subscriptionId: data.subscriptionId,
          userId: data.userId,
        });
        const { drainQueue } = await import("@/lib/queue/worker.server");
        await drainQueue(10);
        return { ok: true };
      },
    );
  });


/** Operational state of every subscription + the entitlements of each account. */
export const listSubscriptionStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionStateRow[]> => {
    await assertAdmin(context as never);
    const { listSubscriptionStates: run } = await import(
      "@/lib/admin/finance.server"
    );
    return run();
  });

/** Revenue Recovery Engine — dunning metrics and the open-debt worklist. */
export const getRecoveryOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecoveryOverview> => {
    await assertAdmin(context as never);
    const { collectRecoveryOverview } = await import(
      "@/lib/admin/recovery.server"
    );
    return collectRecoveryOverview();
  });

/** Pulls the next scheduled attempt for a member forward to "now". */
export const forceRecoveryAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { triggerRecoveryNow } = await import(
      "@/lib/billing/recovery/engine.server"
    );
    await triggerRecoveryNow(data.userId, "admin_manual");
    const { drainQueue } = await import("@/lib/queue/worker.server");
    await drainQueue(10);
    return { ok: true };
  });

/** Revenue Intelligence Engine — profiles, score evolution and explainability. */
export const getIntelligenceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntelligenceOverview> => {
    await assertAdmin(context as never);
    const { collectIntelligenceOverview } = await import(
      "@/lib/admin/intelligence.server"
    );
    return collectIntelligenceOverview();
  });

/** Rebuilds a member's payment profile and re-scores their open debt. */
export const rescoreMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { rescoreOpenCycles } = await import(
      "@/lib/billing/recovery/engine.server"
    );
    return rescoreOpenCycles(data.userId, "manual");
  });
