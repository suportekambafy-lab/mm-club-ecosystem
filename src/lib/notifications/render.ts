/**
 * MM Club Notification Engine — rendering (client-safe).
 * Pure: takes a template + variables and returns subject/html/text.
 * Used both by the sender and by the admin preview.
 */
import { APP_URL, TEMPLATES, VARIABLE_CATALOG } from "./catalog";
import type { TemplateDefinition, TemplateOverride } from "./types";

export type RenderedNotification = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sanitiza um URL antes de o colocar num href: só http(s) e caminhos
 * relativos passam; aspas e `<` são escapados para não quebrar o atributo.
 */
export function safeUrl(raw: string): string {
  const url = raw.trim();
  const isSafe = /^https?:\/\//i.test(url) || url.startsWith("/") || url.startsWith("#");
  if (!isSafe) return APP_URL;
  return url.replace(/&/g, "&amp;").replace(/"/g, "%22").replace(/</g, "%3C");
}

/** Replaces {{var}} tokens. Values are escaped unless the key is a URL. */
export function interpolate(
  input: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return input.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null || value === "") return "";
    const raw = String(value);
    return key.toLowerCase().endsWith("url") ? safeUrl(raw) : escapeHtml(raw);
  });
}


function layout(opts: {
  previewText: string;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  secondaryLabel?: string | null;
  secondaryUrl?: string | null;
  footerNote?: string;
}): string {
  const body = opts.paragraphs
    .map(
      (p) =>
        `<p style="font-size:16px;line-height:1.7;color:#d4d4d4;margin:0 0 16px;">${p}</p>`,
    )
    .join("");

  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:24px 0 0;"><a href="${opts.ctaUrl}" style="display:inline-block;background:#c9a961;color:#0a0a0a;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(opts.ctaLabel)} →</a></p>`
      : "";

  const secondary =
    opts.secondaryLabel && opts.secondaryUrl
      ? `<p style="margin:14px 0 0;font-size:14px;"><a href="${opts.secondaryUrl}" style="color:#c9a961;text-decoration:none;">${escapeHtml(opts.secondaryLabel)} →</a></p>`
      : "";

  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MM Club</title></head>
<body style="margin:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e5e5e5;">
<div style="display:none;overflow:hidden;height:0;max-height:0;opacity:0;">${opts.previewText}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 40px 0;">
<div style="font-size:11px;letter-spacing:0.28em;color:#c9a961;text-transform:uppercase;font-weight:700;">MM · Club</div>
</td></tr>
<tr><td style="padding:20px 40px 32px;">
<h1 style="font-size:26px;color:#ffffff;margin:0 0 16px;font-weight:600;line-height:1.25;">${opts.heading}</h1>
${body}${cta}${secondary}
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #1f1f1f;font-size:12px;color:#666;text-align:center;line-height:1.6;">
${opts.footerNote ? `${escapeHtml(opts.footerNote)}<br>` : ""}
MM Club · <a href="${APP_URL}" style="color:#c9a961;text-decoration:none;">mmclub.pt</a><br>
Recebeste este email porque tens conta no MM Club.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** Merges an optional DB override on top of the code definition. */
export function mergeTemplate(
  def: TemplateDefinition,
  override?: TemplateOverride | null,
): TemplateDefinition {
  if (!override) return def;
  return {
    ...def,
    subject: override.subject || def.subject,
    previewText: override.previewText || def.previewText,
    heading: override.heading || def.heading,
    body: override.bodyHtml
      ? override.bodyHtml.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
      : def.body,
    ctaLabel: override.ctaLabel ?? def.ctaLabel,
    ctaUrl: override.ctaUrl ?? def.ctaUrl,
    version: override.version,
  };
}

export function renderTemplate(
  def: TemplateDefinition,
  vars: Record<string, string | number | null | undefined>,
): RenderedNotification {
  const subject = interpolate(def.subject, vars);
  const previewText = interpolate(def.previewText, vars);
  const heading = interpolate(def.heading, vars);
  const paragraphs = def.body.map((p) => interpolate(p, vars));
  const ctaLabel = def.ctaLabel ? interpolate(def.ctaLabel, vars) : null;
  const ctaUrl = def.ctaUrl ? interpolate(def.ctaUrl, vars) : null;
  const secondaryLabel = def.secondaryLabel
    ? interpolate(def.secondaryLabel, vars)
    : null;
  const secondaryUrl = def.secondaryUrl
    ? interpolate(def.secondaryUrl, vars)
    : null;

  const html = layout({
    previewText,
    heading,
    paragraphs,
    ctaLabel,
    ctaUrl,
    secondaryLabel,
    secondaryUrl,
    footerNote:
      def.category === "billing" || def.category === "recovery"
        ? `${vars.company ?? "Snowcountry Lda"} · NIF ${vars.vat ?? "517449234"}`
        : undefined,
  });

  const text = [
    stripTags(heading),
    ...paragraphs.map(stripTags),
    ctaUrl ? `${ctaLabel}: ${ctaUrl}` : "",
    secondaryUrl ? `${secondaryLabel}: ${secondaryUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject, previewText, html, text };
}

/** Sample values so the admin can preview any template instantly. */
export function sampleVariables(): Record<string, string> {
  return Object.fromEntries(VARIABLE_CATALOG.map((v) => [v.key, v.sample]));
}

export function previewTemplate(
  key: string,
  override?: TemplateOverride | null,
  vars?: Record<string, string>,
): RenderedNotification | null {
  const def = TEMPLATES[key];
  if (!def) return null;
  return renderTemplate(mergeTemplate(def, override), {
    ...sampleVariables(),
    ...(vars ?? {}),
  });
}
