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
          "id, status, trial_end, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, created_at, product:catalog_products(name, slug), price:catalog_prices!billing_subscriptions_price_id_fkey(slug, amount_cents, currency, interval)",
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

// ------------------------------------------------------- payment methods

export const addPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        origin: z.string().url(),
        returnPath: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { startAddPaymentMethod } = await import(
      "@/lib/billing/payment-methods.server"
    );
    return startAddPaymentMethod({
      userId: context.userId,
      email: (context.claims as { email?: string } | null)?.email ?? null,
      origin: data.origin,
      returnPath: data.returnPath,
    });
  });

export const syncPaymentMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncPaymentMethods: cmd } = await import(
      "@/lib/billing/payment-methods.server"
    );
    await cmd(context.userId);
    return { ok: true };
  });

export const setDefaultPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ paymentMethodId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setDefaultPaymentMethod: cmd } = await import(
      "@/lib/billing/payment-methods.server"
    );
    await cmd({ userId: context.userId, paymentMethodId: data.paymentMethodId });
    return { ok: true };
  });

export const removePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ paymentMethodId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { removePaymentMethod: cmd } = await import(
      "@/lib/billing/payment-methods.server"
    );
    await cmd({ userId: context.userId, paymentMethodId: data.paymentMethodId });
    return { ok: true };
  });


// ------------------------------------------------- guest checkout (no account)

/**
 * Pay first, account after: starts a checkout for a visitor with no account.
 * The auth user is only created once the gateway confirms the payment.
 */
export const startGuestCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email().max(200),
        name: z.string().max(120).nullable().optional(),
        priceSlug: z.string().min(1).max(120),
        origin: z.string().url(),
        couponCode: z.string().max(60).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { startGuestCheckout: cmd } = await import("@/lib/billing/guest.server");
    return cmd({
      email: data.email,
      name: data.name ?? null,
      priceSlug: data.priceSlug,
      origin: data.origin,
      couponCode: data.couponCode ?? null,
    });
  });

/** Status of a guest checkout intent (used by the return page to poll). */
export const getGuestCheckoutStatus = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ intentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: intent } = await supabaseAdmin
      .from("billing_checkout_intents")
      .select("id, email, status, account_created, gateway, gateway_payment_id")
      .eq("id", data.intentId)
      .maybeSingle();
    if (!intent) return { found: false as const };

    // Reconcile straight away so the user does not wait for the webhook.
    if (intent.status !== "provisioned" && intent.gateway_payment_id) {
      const { handleGatewayPayment } = await import(
        "@/lib/billing/commands.server"
      );
      await handleGatewayPayment(
        intent.gateway!,
        intent.gateway_payment_id,
      ).catch((e) => console.error("[getGuestCheckoutStatus]", e));
      const { drainQueue } = await import("@/lib/queue/worker.server");
      await drainQueue(25);
    }

    const { data: fresh } = await supabaseAdmin
      .from("billing_checkout_intents")
      .select("status, account_created, email")
      .eq("id", data.intentId)
      .maybeSingle();

    return {
      found: true as const,
      email: fresh?.email ?? intent.email,
      status: fresh?.status ?? intent.status,
      ready: (fresh?.status ?? intent.status) === "provisioned",
      accountCreated: Boolean(fresh?.account_created ?? intent.account_created),
    };
  });
