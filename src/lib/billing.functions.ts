/**
 * Billing API (v1) — the only surface the UI talks to.
 * Thin wrappers over `src/lib/billing/commands.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  CatalogEntry,
  LedgerEntryView,
  PaymentMethodView,
  SubscriptionStatus,
  SubscriptionView,
  TimelineItem,
} from "@/lib/billing/types";

/** Catalog shape sent to the browser (metadata stays server-side). */
export type CatalogView = Omit<CatalogEntry, "metadata" | "prices"> & {
  badge: string | null;
  prices: CatalogEntry["prices"];
};

/** Public product catalog (no auth): plans and packs available for purchase. */
export const getCatalog = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ kinds: z.array(z.string()).optional() })
      .default({})
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<CatalogView[]> => {
    const { listCatalog } = await import("@/lib/billing/catalog.server");
    const entries = await listCatalog(data.kinds as never);
    return entries.map(({ metadata, ...rest }) => ({
      ...rest,
      badge: typeof metadata?.badge === "string" ? metadata.badge : null,
    }));
  });

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        priceSlug: z.string().min(1).max(120),
        origin: z.string().url(),
        successPath: z.string().max(200).optional(),
        couponCode: z.string().max(60).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { startCheckout: cmd } = await import(
      "@/lib/billing/commands.server"
    );
    const { checkoutUrl } = await cmd({
      userId: context.userId,
      email: (context.claims as { email?: string } | null)?.email ?? null,
      priceSlug: data.priceSlug,
      origin: data.origin,
      successPath: data.successPath,
      couponCode: data.couponCode ?? null,
    });
    return { checkoutUrl };
  });

export type BillingOverview = {
  subscription: SubscriptionView | null;
  features: string[];
  timeline: TimelineItem[];
  ledger: LedgerEntryView[];
  paymentMethods: PaymentMethodView[];
};

export const getBillingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingOverview> => {
    const { supabase, userId } = context;

    const [subRes, timelineRes, ledgerRes, pmRes, featRes] = await Promise.all([
      supabase
        .from("billing_subscriptions")
        .select(
          "id, status, trial_end, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, created_at, product:catalog_products(name, slug), price:catalog_prices(slug, amount_cents, currency, interval)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("billing_timeline")
        .select("id, kind, title, description, amount_cents, currency, occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(30),
      supabase
        .from("billing_ledger_entries")
        .select("id, entry_type, direction, amount_cents, currency, credits_delta, memo, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("billing_payment_methods")
        .select("id, gateway, method, brand, last4, exp_month, exp_year, is_default, status")
        .eq("user_id", userId)
        .neq("status", "revoked"),
      supabase.rpc("resolve_entitlements", { _user_id: userId }),
    ]);

    const s = subRes.data as
      | (Record<string, unknown> & {
          product: { name: string; slug: string } | null;
          price: {
            slug: string;
            amount_cents: number;
            currency: string;
            interval: string;
          } | null;
        })
      | null;

    return {
      subscription: s
        ? {
            id: s.id as string,
            status: s.status as SubscriptionStatus,
            productName: s.product?.name ?? "MM Club",
            productSlug: s.product?.slug ?? "mm_club",
            priceSlug: s.price?.slug ?? "",
            amountCents: s.price?.amount_cents ?? 0,
            currency: s.price?.currency ?? "EUR",
            interval: (s.price?.interval ?? "month") as SubscriptionView["interval"],
            trialEnd: (s.trial_end as string) ?? null,
            currentPeriodStart: (s.current_period_start as string) ?? null,
            currentPeriodEnd: (s.current_period_end as string) ?? null,
            cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
            cancelledAt: (s.cancelled_at as string) ?? null,
            createdAt: s.created_at as string,
          }
        : null,
      features: (featRes.data ?? []).map(
        (f: { feature_key: string }) => f.feature_key,
      ),
      timeline: (timelineRes.data ?? []).map((t) => ({
        id: t.id,
        kind: t.kind,
        title: t.title,
        description: t.description,
        amountCents: t.amount_cents,
        currency: t.currency,
        occurredAt: t.occurred_at,
      })),
      ledger: (ledgerRes.data ?? []).map((l) => ({
        id: l.id,
        entryType: l.entry_type as LedgerEntryView["entryType"],
        direction: l.direction as LedgerEntryView["direction"],
        amountCents: l.amount_cents,
        currency: l.currency,
        creditsDelta: l.credits_delta,
        memo: l.memo,
        createdAt: l.created_at,
      })),
      paymentMethods: (pmRes.data ?? []).map((m) => ({
        id: m.id,
        gateway: m.gateway,
        method: m.method,
        brand: m.brand,
        last4: m.last4,
        expMonth: m.exp_month,
        expYear: m.exp_year,
        isDefault: m.is_default,
        status: m.status,
      })),
    };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().uuid(),
        immediate: z.boolean().optional(),
        reason: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { cancelSubscription: cmd } = await import(
      "@/lib/billing/commands.server"
    );
    await cmd({
      subscriptionId: data.subscriptionId,
      userId: context.userId,
      immediate: data.immediate,
      reason: data.reason ?? null,
    });
    const { drainQueue } = await import("@/lib/queue/worker.server");
    await drainQueue(10);
    return { ok: true };
  });

export const resumeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ subscriptionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resumeSubscription: cmd } = await import(
      "@/lib/billing/commands.server"
    );
    await cmd({
      subscriptionId: data.subscriptionId,
      userId: context.userId,
    });
    const { drainQueue } = await import("@/lib/queue/worker.server");
    await drainQueue(10);
    return { ok: true };
  });

/** Reconciles a payment right after the gateway redirect (no webhook wait). */
export const syncCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: pending } = await supabaseAdmin
      .from("billing_payments")
      .select("gateway, gateway_payment_id")
      .eq("user_id", context.userId)
      .in("status", ["pending", "authorized"])
      .order("created_at", { ascending: false })
      .limit(3);

    const { handleGatewayPayment } = await import(
      "@/lib/billing/commands.server"
    );
    for (const p of pending ?? []) {
      await handleGatewayPayment(p.gateway, p.gateway_payment_id).catch((e) =>
        console.error("[syncCheckout]", e),
      );
    }
    const { drainQueue } = await import("@/lib/queue/worker.server");
    await drainQueue(25);
    return { ok: true };
  });
