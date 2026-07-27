import { createECDH, createHash } from "node:crypto";
import * as webPush from "web-push";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PushKeys = {
  p256dh: string;
  auth: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: PushKeys;
  userAgent?: string | null;
};

type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: string;
  post_id: string | null;
  comment_id: string | null;
  short_id: string | null;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  push_sent_at: string | null;
  push_attempts: number;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

let cachedVapid: VapidKeys | undefined;

function toBase64Url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getVapidKeys(): VapidKeys {
  if (cachedVapid) return cachedVapid;
  const seed = process.env.WEB_PUSH_VAPID_SEED;
  if (!seed) throw new Error("WEB_PUSH_VAPID_SEED is not configured");

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const privateKeyBytes = createHash("sha256")
      .update(`${seed}:${attempt}`)
      .digest();
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(privateKeyBytes);
      cachedVapid = {
        publicKey: toBase64Url(ecdh.getPublicKey(undefined, "uncompressed")),
        privateKey: toBase64Url(privateKeyBytes),
      };
      return cachedVapid;
    } catch {
      // Try another deterministic scalar if this one is outside the P-256 range.
    }
  }

  throw new Error("Could not derive a valid VAPID key");
}

function configureWebPush() {
  const keys = getVapidKeys();
  webPush.setVapidDetails("mailto:geral@mmclub.pt", keys.publicKey, keys.privateKey);
  return keys;
}

export function getWebPushPublicKeyValue(): string {
  return getVapidKeys().publicKey;
}

export async function savePushSubscription(
  userId: string,
  input: PushSubscriptionInput,
): Promise<{ ok: true }> {
  await supabaseAdmin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      user_agent: input.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
      failed_at: null,
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );
  return { ok: true };
}

export async function revokePushSubscription(
  userId: string,
  endpoint: string,
): Promise<{ ok: true }> {
  await supabaseAdmin
    .from("push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  return { ok: true };
}

function communityCopy(
  kind: string,
  actorName: string | null,
  isShort: boolean,
): { title: string; body: string } {
  const who = actorName?.trim() || "Alguém";
  const where = isShort ? "no teu MM Short" : "no teu post";
  if (kind === "like") {
    return {
      title: isShort ? `${who} gostou do teu MM Short` : `${who} gostou do teu post`,
      body: isShort ? "Toca para veres o vídeo" : "Toca para veres a publicação",
    };
  }
  if (kind === "reply") {
    return {
      title: `${who} comentou ${where}`,
      body: isShort ? "Vê o comentário no MM Shorts" : "Vê a resposta na comunidade",
    };
  }
  if (kind === "comment_reply") {
    return {
      title: `${who} respondeu ao teu comentário`,
      body: isShort ? "Abre a conversa no MM Shorts" : "Abre a conversa na comunidade",
    };
  }
  if (kind === "reaction") {
    return {
      title: `${who} reagiu ${isShort ? "ao teu MM Short" : "à tua publicação"}`,
      body: "Abre para ver a reação",
    };
  }
  return {
    title: `${who} mencionou-te`,
    body: isShort ? "Foste referido num MM Short" : "Foste referido numa publicação",
  };
}

function hrefForNotification(n: NotificationRow): string {
  if (n.short_id) {
    const commentFlag = n.kind === "reply" || n.kind === "comment_reply" ? "&c=1" : "";
    return `/shorts?v=${n.short_id}${commentFlag}`;
  }
  if (n.post_id) return `/comunidade?post=${n.post_id}`;
  return "/comunidade";
}

async function markSubscriptionFailure(row: PushSubscriptionRow, statusCode?: number) {
  const revoked = statusCode === 404 || statusCode === 410;
  await supabaseAdmin
    .from("push_subscriptions")
    .update({
      failure_count: row.failure_count + 1,
      failed_at: new Date().toISOString(),
      revoked_at: revoked ? new Date().toISOString() : null,
    })
    .eq("id", row.id);
}

export async function deliverPushNotification(
  notificationId: string,
): Promise<{ delivered: number; failed: number; skipped: boolean }> {
  configureWebPush();

  const { data: notification } = await supabaseAdmin
    .from("notifications")
    .select(
      "id, user_id, actor_id, kind, post_id, comment_id, short_id, created_at, read_at, dismissed_at, push_sent_at, push_attempts",
    )
    .eq("id", notificationId)
    .maybeSingle();

  const n = notification as NotificationRow | null;
  if (!n || n.dismissed_at || n.read_at || n.push_sent_at || n.push_attempts >= 3) {
    return { delivered: 0, failed: 0, skipped: true };
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("user_id", n.user_id)
    .is("revoked_at", null);

  const subscriptions = (subs ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) {
    await supabaseAdmin
      .from("notifications")
      .update({ push_attempts: n.push_attempts + 1, push_error: "no_active_device" })
      .eq("id", n.id);
    return { delivered: 0, failed: 0, skipped: true };
  }

  let actorName: string | null = null;
  if (n.actor_id) {
    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", n.actor_id)
      .maybeSingle();
    actorName = (actor as { display_name?: string | null } | null)?.display_name ?? null;
  }

  const copy = communityCopy(n.kind, actorName, Boolean(n.short_id));
  const payload = JSON.stringify({
    id: `notif:${n.id}`,
    title: copy.title,
    body: copy.body,
    href: hrefForNotification(n),
  });

  let delivered = 0;
  let failed = 0;
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 86_400, urgency: "normal" },
      );
      delivered += 1;
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ failed_at: null, failure_count: 0, last_seen_at: new Date().toISOString() })
        .eq("id", sub.id);
    } catch (err) {
      failed += 1;
      const statusCode =
        typeof err === "object" && err !== null && "statusCode" in err
          ? Number((err as { statusCode?: unknown }).statusCode)
          : undefined;
      await markSubscriptionFailure(sub, statusCode);
    }
  }

  await supabaseAdmin
    .from("notifications")
    .update({
      push_attempts: n.push_attempts + 1,
      push_sent_at: delivered > 0 ? new Date().toISOString() : null,
      push_error: delivered > 0 ? null : "delivery_failed",
    })
    .eq("id", n.id);

  return { delivered, failed, skipped: false };
}

export async function drainPendingPushNotifications(limit = 25) {
  const { data } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .is("push_sent_at", null)
    .is("dismissed_at", null)
    .is("read_at", null)
    .lt("push_attempts", 3)
    .order("created_at", { ascending: true })
    .limit(limit);

  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of data ?? []) {
    const result = await deliverPushNotification(row.id as string);
    delivered += result.delivered;
    failed += result.failed;
    if (result.skipped) skipped += 1;
  }
  return { processed: data?.length ?? 0, delivered, failed, skipped };
}