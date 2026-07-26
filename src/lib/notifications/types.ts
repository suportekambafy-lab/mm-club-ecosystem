/**
 * MM Club Notification Engine — shared types (client-safe).
 * The same engine drives email today and can drive SMS/Push tomorrow:
 * only the transport changes, never the catalogue or the rules.
 */

export type NotificationChannel = "email" | "sms" | "push";

export type TemplateCategory =
  | "account"
  | "subscription"
  | "billing"
  | "recovery"
  | "security";

export type TemplateDefinition = {
  key: string;
  category: TemplateCategory;
  channel: NotificationChannel;
  locale: string;
  /** Human name shown in Admin → Comunicação. */
  name: string;
  subject: string;
  previewText: string;
  heading: string;
  /** Paragraphs; may contain {{variables}} and inline <strong>/<em>. */
  body: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  /** Secondary link rendered under the button. */
  secondaryLabel?: string;
  secondaryUrl?: string;
  /** Variables this template actually uses (for the admin preview). */
  variables: string[];
  version: number;
};

/** A template as stored/overridden in the database. */
export type TemplateOverride = {
  key: string;
  subject: string;
  previewText: string;
  heading: string | null;
  bodyHtml: string;
  textBody: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  category: string;
  locale: string;
  version: number;
  active: boolean;
  updatedAt: string;
};

export type TemplateView = TemplateDefinition & {
  overridden: boolean;
  active: boolean;
  updatedAt: string | null;
  sent30d: number;
};

export type NotificationLogRow = {
  id: string;
  userId: string | null;
  recipient: string;
  channel: string;
  templateKey: string;
  templateName: string;
  category: string;
  eventType: string | null;
  subject: string;
  status: string;
  reason: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  resentOf: string | null;
  createdAt: string;
};

export type TemplateStat = {
  key: string;
  name: string;
  category: string;
  sent: number;
  skipped: number;
  errors: number;
  opened: number;
  clicked: number;
  /** Debt cycles that got paid within 7 days of this email. */
  recovered: number;
};

export type CommsOverview = {
  sent30d: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  recoveryAfterEmail: number;
  byCategory: { category: string; sent: number }[];
  templates: TemplateStat[];
};
