/**
 * Continuous Security Scan + internal Security Score.
 *
 * Runs the database posture inspection plus runtime signals and produces a
 * scored report per area. Executed on demand from the dashboard and
 * automatically by the ops cron after each deploy/migration.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ScoreSection {
  key: string;
  label: string;
  score: number; // 0-100
  findings: string[];
}

export interface SecurityReport {
  id: string | null;
  score: number;
  sections: ScoreSection[];
  findings: string[];
  createdAt: string;
}

type Posture = {
  tables_total: number;
  tables_without_rls: string[];
  tables_without_policies: string[];
  policies_total: number;
  anon_writable_tables: string[];
  functions_without_search_path: string[];
  public_buckets: string[];
  buckets_total: number;
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function runSecurityScan(
  trigger: string = "manual",
): Promise<SecurityReport> {
  const day = new Date(Date.now() - 86_400_000).toISOString();

  const [postureRes, events, webhooks, alerts, methods] = await Promise.all([
    supabaseAdmin.rpc("security_posture_report"),
    supabaseAdmin
      .from("security_events")
      .select("kind, severity, outcome")
      .gte("created_at", day)
      .limit(5000),
    supabaseAdmin
      .from("ops_webhook_log")
      .select("outcome")
      .gte("received_at", day)
      .limit(2000),
    supabaseAdmin
      .from("security_alerts")
      .select("category, level, status")
      .eq("status", "open")
      .limit(500),
    supabaseAdmin
      .from("billing_payments")
      .select("status")
      .gte("created_at", day)
      .limit(2000),
  ]);

  const posture = (postureRes.data ?? {}) as Partial<Posture>;
  const ev = events.data ?? [];
  const count = (kind: string) => ev.filter((e) => e.kind === kind).length;
  const openAlerts = alerts.data ?? [];
  const openBy = (cat: string) =>
    openAlerts.filter((a) => a.category === cat).length;

  const sections: ScoreSection[] = [];
  const push = (
    key: string,
    label: string,
    penalties: Array<[boolean, number, string]>,
  ) => {
    let score = 100;
    const findings: string[] = [];
    for (const [hit, cost, text] of penalties) {
      if (hit) {
        score -= cost;
        findings.push(text);
      }
    }
    sections.push({ key, label, score: clamp(score), findings });
  };

  const failedLogins = count("login_failed");
  push("auth", "Autenticação", [
    [failedLogins >= 50, 25, `${failedLogins} logins falhados nas últimas 24h`],
    [count("new_device") >= 10, 10, "Muitos dispositivos novos em 24h"],
    [count("duplicate_sessions") > 0, 10, "Sessões simultâneas detetadas"],
  ]);

  push("authz", "Autorização", [
    [count("authz_denied") > 0, 20, `${count("authz_denied")} acessos admin negados`],
    [
      (posture.tables_without_policies?.length ?? 0) > 0,
      30,
      `Tabelas com RLS sem políticas: ${(posture.tables_without_policies ?? []).join(", ")}`,
    ],
  ]);

  push("api", "APIs", [
    [count("rate_limited") >= 25, 20, `${count("rate_limited")} pedidos limitados`],
    [count("waf_blocked") > 0, 15, `${count("waf_blocked")} bloqueios do WAF`],
    [openBy("api_abuse") > 0, 20, `${openBy("api_abuse")} alertas de abuso de API por resolver`],
  ]);

  const failedPayments = (methods.data ?? []).filter(
    (p) => p.status === "failed",
  ).length;
  push("billing", "Billing", [
    [openBy("billing_fraud") > 0, 25, `${openBy("billing_fraud")} alertas de fraude por rever`],
    [failedPayments >= 5, 15, `${failedPayments} pagamentos falhados em 24h`],
  ]);

  push("storage", "Storage", [
    [
      (posture.public_buckets?.length ?? 0) > 0,
      40,
      `Buckets públicos: ${(posture.public_buckets ?? []).join(", ")}`,
    ],
    [(posture.buckets_total ?? 0) === 0, 0, ""],
  ]);

  push("uploads", "Uploads", [
    [count("upload_rejected") >= 10, 15, "Muitos uploads rejeitados"],
  ]);

  push("admin", "Admin", [
    [count("admin_access") >= 200, 10, "Volume elevado de acessos admin"],
    [count("emergency_enabled") > 0, 15, "Modo de emergência ativado nas últimas 24h"],
  ]);

  push("database", "Base de dados", [
    [
      (posture.tables_without_rls?.length ?? 0) > 0,
      40,
      `Tabelas sem RLS: ${(posture.tables_without_rls ?? []).join(", ")}`,
    ],
    [
      (posture.anon_writable_tables?.length ?? 0) > 0,
      30,
      `Escrita anónima permitida em: ${(posture.anon_writable_tables ?? []).join(", ")}`,
    ],
    [
      (posture.functions_without_search_path?.length ?? 0) > 0,
      15,
      `Funções sem search_path fixo: ${(posture.functions_without_search_path ?? []).length}`,
    ],
  ]);

  const webhookFailures = (webhooks.data ?? []).filter(
    (w) => w.outcome === "error" || w.outcome === "rejected",
  ).length;
  push("webhooks", "Webhooks", [
    [webhookFailures >= 3, 30, `${webhookFailures} falhas de webhook em 24h`],
    [webhookFailures > 0 && webhookFailures < 3, 10, "Falhas pontuais de webhook"],
  ]);

  const score = clamp(
    sections.reduce((acc, s) => acc + s.score, 0) / (sections.length || 1),
  );
  const findings = sections.flatMap((s) => s.findings).filter(Boolean);

  const { data: inserted } = await supabaseAdmin
    .from("security_scans")
    .insert({
      trigger,
      score,
      sections: sections as never,
      findings: findings as never,
    })
    .select("id, created_at")
    .maybeSingle();

  return {
    id: inserted?.id ?? null,
    score,
    sections,
    findings,
    createdAt: inserted?.created_at ?? new Date().toISOString(),
  };
}

export async function latestScan(): Promise<SecurityReport | null> {
  const { data } = await supabaseAdmin
    .from("security_scans")
    .select("id, score, sections, findings, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    score: data.score,
    sections: (data.sections ?? []) as unknown as ScoreSection[],
    findings: (data.findings ?? []) as unknown as string[],
    createdAt: data.created_at,
  };
}
