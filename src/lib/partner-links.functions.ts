/**
 * Convite de parceiro (Shopify) — registo de quem vê, quem clica e quantos
 * pagaram, agrupado por módulo. As contas pagas vêm do painel de afiliado
 * (não há retorno automático), por isso são introduzidas à mão no admin.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PartnerPlacement = "dashboard" | "lesson-start" | "lesson-end" | "shorts";

export type PartnerModuleRow = {
  key: string;
  label: string;
  courseTitle: string | null;
  impressions: number;
  clicks: number;
  uniqueClickers: number;
  paidCount: number;
  revenueCents: number;
  note: string | null;
};

export type PartnerClicker = {
  userId: string;
  name: string;
  email: string | null;
  moduleLabel: string;
  lessonTitle: string | null;
  placement: string;
  clicks: number;
  lastAt: string;
};

export type PartnerLinkStats = {
  totals: { impressions: number; clicks: number; uniqueClickers: number; paidCount: number; revenueCents: number };
  byPlacement: Array<{ placement: string; impressions: number; clicks: number }>;
  modules: PartnerModuleRow[];
  clickers: PartnerClicker[];
};

export type CreditBuyer = {
  paymentId: string;
  userId: string | null;
  name: string;
  email: string | null;
  product: string;
  amountCents: number;
  currency: string;
  credits: number;
  paidAt: string | null;
  status: string;
};

export type CreditPurchases = {
  totals: { buyers: number; purchases: number; amountCents: number; credits: number };
  rows: CreditBuyer[];
};

/** Registra uma exposição ou um clique no convite de parceiro. */
export const trackPartnerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data?: {
      kind?: "impression" | "click";
      placement?: string;
      courseId?: string | null;
      courseTitle?: string | null;
      moduleId?: string | null;
      moduleTitle?: string | null;
      lessonId?: string | null;
      lessonTitle?: string | null;
    }) => ({
      kind: data?.kind === "click" ? ("click" as const) : ("impression" as const),
      placement: String(data?.placement ?? "dashboard").slice(0, 60),
      courseId: data?.courseId ? String(data.courseId).slice(0, 120) : null,
      courseTitle: data?.courseTitle ? String(data.courseTitle).slice(0, 200) : null,
      moduleId: data?.moduleId ? String(data.moduleId).slice(0, 120) : null,
      moduleTitle: data?.moduleTitle ? String(data.moduleTitle).slice(0, 200) : null,
      lessonId: data?.lessonId ? String(data.lessonId).slice(0, 120) : null,
      lessonTitle: data?.lessonTitle ? String(data.lessonTitle).slice(0, 200) : null,
    }),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("partner_link_events").insert({
      user_id: context.userId,
      partner: "shopify",
      kind: data.kind,
      placement: data.placement,
      course_id: data.courseId,
      course_title: data.courseTitle,
      module_id: data.moduleId,
      module_title: data.moduleTitle,
      lesson_id: data.lessonId,
      lesson_title: data.lessonTitle,
    });
    if (error) return { ok: false };
    return { ok: true };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Normaliza a chave do módulo (quando não há módulo, agrupa pelo momento). */
function moduleKeyOf(row: { module_title: string | null; placement: string }): string {
  const title = (row.module_title ?? "").trim();
  if (title) return title.toLowerCase();
  return `__${row.placement}`;
}

function moduleLabelOf(row: { module_title: string | null; placement: string }): string {
  const title = (row.module_title ?? "").trim();
  if (title) return title;
  if (row.placement === "shorts") return "MM Shorts";
  if (row.placement === "dashboard") return "Painel (sem módulo)";
  return "Sem módulo";
}

export const getPartnerLinkStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerLinkStats> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: events }, { data: conversions }] = await Promise.all([
      supabaseAdmin
        .from("partner_link_events")
        .select(
          "user_id, kind, placement, course_title, module_title, lesson_title, created_at",
        )
        .eq("partner", "shopify")
        .order("created_at", { ascending: false })
        .limit(20000),
      supabaseAdmin.from("partner_conversions").select("*").eq("partner", "shopify"),
    ]);

    const list = events ?? [];
    const modules = new Map<
      string,
      PartnerModuleRow & { clickerSet: Set<string> }
    >();
    const placements = new Map<string, { impressions: number; clicks: number }>();
    const clickers = new Map<string, PartnerClicker>();
    const allClickers = new Set<string>();
    let impressions = 0;
    let clicks = 0;

    for (const e of list) {
      const key = moduleKeyOf(e);
      let row = modules.get(key);
      if (!row) {
        row = {
          key,
          label: moduleLabelOf(e),
          courseTitle: e.course_title ?? null,
          impressions: 0,
          clicks: 0,
          uniqueClickers: 0,
          paidCount: 0,
          revenueCents: 0,
          note: null,
          clickerSet: new Set<string>(),
        };
        modules.set(key, row);
      }
      if (!row.courseTitle && e.course_title) row.courseTitle = e.course_title;

      const p = placements.get(e.placement) ?? { impressions: 0, clicks: 0 };
      if (e.kind === "click") {
        clicks += 1;
        row.clicks += 1;
        p.clicks += 1;
        if (e.user_id) {
          row.clickerSet.add(e.user_id);
          allClickers.add(e.user_id);
          const ck = `${e.user_id}:${key}`;
          const existing = clickers.get(ck);
          if (existing) existing.clicks += 1;
          else
            clickers.set(ck, {
              userId: e.user_id,
              name: "Membro",
              email: null,
              moduleLabel: row.label,
              lessonTitle: e.lesson_title ?? null,
              placement: e.placement,
              clicks: 1,
              lastAt: e.created_at,
            });
        }
      } else {
        impressions += 1;
        row.impressions += 1;
        p.impressions += 1;
      }
      placements.set(e.placement, p);
    }

    // Contas pagas (introduzidas à mão a partir do painel de afiliado).
    let paidTotal = 0;
    let revenueTotal = 0;
    for (const c of conversions ?? []) {
      paidTotal += c.paid_count ?? 0;
      revenueTotal += c.revenue_cents ?? 0;
      const row = modules.get(c.module_key);
      if (row) {
        row.paidCount = c.paid_count ?? 0;
        row.revenueCents = c.revenue_cents ?? 0;
        row.note = c.note ?? null;
      } else {
        modules.set(c.module_key, {
          key: c.module_key,
          label: c.module_label ?? c.module_key,
          courseTitle: null,
          impressions: 0,
          clicks: 0,
          uniqueClickers: 0,
          paidCount: c.paid_count ?? 0,
          revenueCents: c.revenue_cents ?? 0,
          note: c.note ?? null,
          clickerSet: new Set<string>(),
        });
      }
    }

    // Nomes e emails de quem clicou.
    const ids = [...new Set([...clickers.values()].map((c) => c.userId))];
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? ""]));
      const emails = new Map<string, string | null>();
      await Promise.all(
        ids.slice(0, 200).map(async (id) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id);
          emails.set(id, data?.user?.email ?? null);
        }),
      );
      for (const c of clickers.values()) {
        c.name = names.get(c.userId) || c.email || "Membro";
        c.email = emails.get(c.userId) ?? null;
        if (!names.get(c.userId) && c.email) c.name = c.email;
      }
    }

    const moduleRows = [...modules.values()]
      .map(({ clickerSet, ...row }) => ({ ...row, uniqueClickers: clickerSet.size }))
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

    return {
      totals: {
        impressions,
        clicks,
        uniqueClickers: allClickers.size,
        paidCount: paidTotal,
        revenueCents: revenueTotal,
      },
      byPlacement: [...placements.entries()]
        .map(([placement, v]) => ({ placement, ...v }))
        .sort((a, b) => b.clicks - a.clicks),
      modules: moduleRows,
      clickers: [...clickers.values()].sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      ),
    };
  });

/** Guarda o número de contas pagas de um módulo (dados do painel de afiliado). */
export const savePartnerConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data?: {
      moduleKey?: string;
      moduleLabel?: string;
      paidCount?: number;
      revenueCents?: number;
      note?: string | null;
    }) => ({
      moduleKey: String(data?.moduleKey ?? "").trim(),
      moduleLabel: String(data?.moduleLabel ?? "").trim() || null,
      paidCount: Math.max(0, Math.round(Number(data?.paidCount ?? 0))),
      revenueCents: Math.max(0, Math.round(Number(data?.revenueCents ?? 0))),
      note: data?.note ? String(data.note).slice(0, 400) : null,
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (!data.moduleKey) throw new Error("Módulo obrigatório");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("partner_conversions").upsert(
      {
        partner: "shopify",
        module_key: data.moduleKey,
        module_label: data.moduleLabel,
        paid_count: data.paidCount,
        revenue_cents: data.revenueCents,
        note: data.note,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "partner,module_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Quem comprou pacotes de créditos MM Studio. */
export const getCreditPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditPurchases> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payments } = await supabaseAdmin
      .from("billing_payments")
      .select(
        "id, user_id, amount_cents, currency, status, paid_at, created_at, metadata, price:catalog_prices(id, slug, grants_credits, product:catalog_products(name, kind))",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    const rows: CreditBuyer[] = [];
    const buyers = new Set<string>();
    let amountCents = 0;
    let credits = 0;

    for (const p of payments ?? []) {
      const price = (p as any).price;
      if (price?.product?.kind !== "credit_pack") continue;
      const paid = p.status === "paid";
      const grantedCredits = Number(price?.grants_credits ?? 0);
      rows.push({
        paymentId: p.id,
        userId: p.user_id ?? null,
        name: "Membro",
        email: null,
        product: price?.product?.name ?? price?.slug ?? "Pacote de créditos",
        amountCents: p.amount_cents ?? 0,
        currency: p.currency ?? "EUR",
        credits: grantedCredits,
        paidAt: p.paid_at ?? p.created_at ?? null,
        status: p.status,
      });
      if (paid) {
        if (p.user_id) buyers.add(p.user_id);
        amountCents += p.amount_cents ?? 0;
        credits += grantedCredits;
      }
    }

    const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? ""]));
      const emails = new Map<string, string | null>();
      await Promise.all(
        ids.slice(0, 200).map(async (id) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id);
          emails.set(id, data?.user?.email ?? null);
        }),
      );
      for (const r of rows) {
        if (!r.userId) continue;
        r.email = emails.get(r.userId) ?? null;
        r.name = names.get(r.userId) || r.email || "Membro";
      }
    }

    return {
      totals: {
        buyers: buyers.size,
        purchases: rows.filter((r) => r.status === "paid").length,
        amountCents,
        credits,
      },
      rows,
    };
  });
