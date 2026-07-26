/**
 * Device Trust and Session Security.
 *
 * - Every sign-in registers a device fingerprint + a session row.
 * - A device never seen before generates a security event and an alert.
 * - Sessions can be revoked individually or all at once; the client polls
 *   its own session and signs out immediately when it has been revoked.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { raiseAlert, recordSecurityEvent } from "./runtime.server";

export function parseUserAgent(ua: string | null) {
  const s = ua ?? "";
  const browser =
    /Edg\//.test(s) ? "Edge"
    : /OPR\//.test(s) ? "Opera"
    : /Chrome\//.test(s) && !/Chromium/.test(s) ? "Chrome"
    : /Safari\//.test(s) && /Version\//.test(s) ? "Safari"
    : /Firefox\//.test(s) ? "Firefox"
    : "Desconhecido";
  const os =
    /iPhone|iPad|iPod/.test(s) ? "iOS"
    : /Android/.test(s) ? "Android"
    : /Mac OS X/.test(s) ? "macOS"
    : /Windows/.test(s) ? "Windows"
    : /Linux/.test(s) ? "Linux"
    : "Desconhecido";
  const deviceType = /Mobile|iPhone|Android/.test(s)
    ? "mobile"
    : /iPad|Tablet/.test(s)
      ? "tablet"
      : "desktop";
  return { browser, os, deviceType };
}

export interface RegisterSessionInput {
  userId: string;
  fingerprint: string;
  sessionToken: string;
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
}

export interface RegisterSessionResult {
  deviceId: string;
  newDevice: boolean;
  activeSessions: number;
}

export async function registerSession(
  input: RegisterSessionInput,
): Promise<RegisterSessionResult> {
  const { browser, os, deviceType } = parseUserAgent(input.userAgent);
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("security_devices")
    .select("id, first_seen_at")
    .eq("user_id", input.userId)
    .eq("fingerprint", input.fingerprint)
    .maybeSingle();

  const newDevice = !existing;

  const { data: device } = await supabaseAdmin
    .from("security_devices")
    .upsert(
      {
        user_id: input.userId,
        fingerprint: input.fingerprint,
        browser,
        os,
        device_type: deviceType,
        country: input.country,
        city: input.city,
        last_ip: input.ip,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,fingerprint" },
    )
    .select("id")
    .maybeSingle();

  const deviceId = device?.id ?? existing?.id ?? "";

  await supabaseAdmin.from("security_sessions").upsert(
    {
      user_id: input.userId,
      device_id: deviceId || null,
      session_token: input.sessionToken,
      ip: input.ip,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      last_seen_at: now,
    },
    { onConflict: "session_token" },
  );

  const { data: active } = await supabaseAdmin
    .from("security_sessions")
    .select("id, device_id")
    .eq("user_id", input.userId)
    .is("revoked_at", null);

  const activeSessions = active?.length ?? 1;

  if (newDevice) {
    // IMPORTANT: a fingerprint change NEVER invalidates a session. Browsers,
    // OS updates, VPNs, private mode and network changes all shift the
    // fingerprint legitimately. It is a *risk signal* only — we combine
    // several signals to decide how loud the alert is, and always allow.
    const { data: history } = await supabaseAdmin
      .from("security_devices")
      .select("country, last_ip")
      .eq("user_id", input.userId)
      .limit(50);
    const knownCountries = new Set(
      (history ?? []).map((d) => d.country).filter(Boolean),
    );
    const knownIps = new Set(
      (history ?? []).map((d) => d.last_ip).filter(Boolean),
    );
    const newCountry =
      !!input.country && knownCountries.size > 0 && !knownCountries.has(input.country);
    const newIp = !!input.ip && knownIps.size > 0 && !knownIps.has(input.ip);
    const signals = [true, newCountry, newIp].filter(Boolean).length;
    const level = signals >= 3 ? "critical" : "warn";

    await recordSecurityEvent({
      kind: "new_device",
      severity: level,
      userId: input.userId,
      ip: input.ip,
      userAgent: input.userAgent,
      outcome: "allowed",
      reason: `${browser} · ${os}`,
      metadata: {
        country: input.country,
        city: input.city,
        deviceType,
        signals: { newDevice: true, newCountry, newIp },
      },
    });
    await raiseAlert({
      category: "session",
      level,
      title:
        signals >= 3
          ? "Novo dispositivo, novo país e novo IP na mesma conta"
          : "Novo dispositivo com sessão iniciada",
      detail: `${browser} · ${os} · ${input.city ?? "cidade desconhecida"}, ${input.country ?? "?"}`,
      userId: input.userId,
      subject: input.userId,
      dedupeKey: `new_device:${input.userId}:${input.fingerprint}`,
      metadata: { ip: input.ip, browser, os, newCountry, newIp },
    });
  }


  // Duplicate/concurrent sessions across distinct devices.
  const distinctDevices = new Set(
    (active ?? []).map((s) => s.device_id).filter(Boolean),
  ).size;
  if (distinctDevices >= 3) {
    await raiseAlert({
      category: "session",
      level: "warn",
      title: "Sessões simultâneas em vários dispositivos",
      detail: `${distinctDevices} dispositivos com sessão ativa na mesma conta.`,
      userId: input.userId,
      subject: input.userId,
      dedupeKey: `dup_sessions:${input.userId}:${new Date().toISOString().slice(0, 10)}`,
    });
    await recordSecurityEvent({
      kind: "duplicate_sessions",
      severity: "warn",
      userId: input.userId,
      ip: input.ip,
      outcome: "allowed",
      reason: `${distinctDevices} dispositivos`,
    });
  }

  return { deviceId, newDevice, activeSessions };
}

/** Heartbeat + revocation check used by the client session guard. */
export async function touchSession(
  sessionToken: string,
): Promise<{ revoked: boolean }> {
  const { data } = await supabaseAdmin
    .from("security_sessions")
    .select("id, revoked_at")
    .eq("session_token", sessionToken)
    .maybeSingle();
  if (!data) return { revoked: false };
  if (data.revoked_at) return { revoked: true };
  await supabaseAdmin
    .from("security_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);
  return { revoked: false };
}

export async function revokeSession(input: {
  sessionToken?: string;
  sessionId?: string;
  reason: string;
}): Promise<void> {
  const patch = {
    revoked_at: new Date().toISOString(),
    revoked_reason: input.reason,
  };
  let q = supabaseAdmin.from("security_sessions").update(patch);
  q = input.sessionId
    ? q.eq("id", input.sessionId)
    : q.eq("session_token", input.sessionToken ?? "");
  await q;
}

/** Terminates every session of a user (admin action or self-service). */
export async function revokeAllSessions(input: {
  userId: string;
  reason: string;
  exceptToken?: string | null;
}): Promise<number> {
  let q = supabaseAdmin
    .from("security_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: input.reason,
    })
    .eq("user_id", input.userId)
    .is("revoked_at", null);
  if (input.exceptToken) q = q.neq("session_token", input.exceptToken);
  const { data } = await q.select("id");

  await recordSecurityEvent({
    kind: "sessions_revoked",
    severity: "critical",
    userId: input.userId,
    outcome: "allowed",
    reason: input.reason,
    metadata: { count: data?.length ?? 0 },
  });
  return data?.length ?? 0;
}

export async function listUserDevices(userId: string) {
  const [devices, sessions] = await Promise.all([
    supabaseAdmin
      .from("security_devices")
      .select(
        "id, browser, os, device_type, country, city, last_ip, trusted, first_seen_at, last_seen_at",
      )
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("security_sessions")
      .select("id, device_id, ip, created_at, last_seen_at, revoked_at")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(50),
  ]);
  return {
    devices: devices.data ?? [],
    sessions: sessions.data ?? [],
  };
}
