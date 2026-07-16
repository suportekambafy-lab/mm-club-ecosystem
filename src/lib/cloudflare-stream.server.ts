// Server-only helpers to talk to the Cloudflare Stream API.
// Do NOT import this from client code or module scope of *.functions.ts.

import { SignJWT, importJWK, importPKCS8 } from "jose";

const API_BASE = "https://api.cloudflare.com/client/v4";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type CfResponse<T> = {
  success: boolean;
  errors?: Array<{ message: string }>;
  result: T;
};

async function cfFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const token = requireEnv("CLOUDFLARE_STREAM_API_TOKEN");
  const res = await fetch(`${API_BASE}/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as CfResponse<T>;
  if (!res.ok || !json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") ?? res.statusText;
    throw new Error(`Cloudflare Stream API error: ${msg}`);
  }
  return json.result;
}

export type CfLiveInput = {
  uid: string;
  rtmps: { url: string; streamKey: string };
  rtmpsPlayback?: { url: string; streamKey: string };
  webRTC?: { url: string };
  webRTCPlayback?: { url: string };
  meta?: Record<string, unknown>;
};

export async function createLiveInput(meta: { title: string }): Promise<CfLiveInput> {
  return cfFetch<CfLiveInput>("/stream/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: { name: meta.title },
      recording: { mode: "automatic", requireSignedURLs: true },
    }),
  });
}

export async function deleteLiveInput(uid: string): Promise<void> {
  await cfFetch(`/stream/live_inputs/${uid}`, { method: "DELETE" });
}

export async function listVideosForLiveInput(uid: string): Promise<Array<{ uid: string; readyToStream: boolean }>> {
  return cfFetch(`/stream/live_inputs/${uid}/videos`);
}

/**
 * Sign a JWT to allow playback of a Cloudflare Stream video / live playback ID.
 * Requires a Stream Signing Key (PEM private key + key ID).
 */
export async function signPlaybackToken(videoUid: string, opts: { ttlSeconds?: number } = {}): Promise<string> {
  const kid = requireEnv("CLOUDFLARE_STREAM_SIGNING_KEY_ID");
  const key = await importStreamSigningKey(requireEnv("CLOUDFLARE_STREAM_SIGNING_KEY_PEM"));

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.ttlSeconds ?? 7200);

  return await new SignJWT({ sub: videoUid, kid, exp, nbf: now })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(exp)
    .sign(key);
}

async function importStreamSigningKey(raw: string) {
  const material = decodeSecretMaterial(raw);

  const parsed = tryParseJson(material);
  if (parsed && typeof parsed === "object") {
    if ("jwk" in parsed && parsed.jwk && typeof parsed.jwk === "object") {
      return importJWK(parsed.jwk as Parameters<typeof importJWK>[0], "RS256");
    }
    if ("kty" in parsed) {
      return importJWK(parsed as Parameters<typeof importJWK>[0], "RS256");
    }
    for (const field of ["pem", "privateKey", "private_key", "key"] as const) {
      const value = (parsed as Record<string, unknown>)[field];
      if (typeof value === "string" && value.trim()) return importStreamSigningKey(value);
    }
  }

  const pem = material.replace(/\\n/g, "\n").trim();
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    const { createPrivateKey } = await import("crypto");
    const keyObject = createPrivateKey({ key: pem, format: "pem", type: "pkcs1" });
    const pkcs8 = keyObject.export({ format: "pem", type: "pkcs8" });
    return importPKCS8(pkcs8.toString(), "RS256");
  }

  if (pem.includes("BEGIN PRIVATE KEY")) {
    return importPKCS8(pem, "RS256");
  }

  throw new Error("Cloudflare Stream signing key is not a supported private key format.");
}

function decodeSecretMaterial(raw: string): string {
  let value = raw.trim();
  const parsedString = tryParseJson(value);
  if (typeof parsedString === "string") value = parsedString.trim();
  value = value.replace(/\\n/g, "\n");

  if (value.includes("BEGIN") || value.startsWith("{")) return value;

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8").trim();
    if (decoded.includes("BEGIN") || decoded.startsWith("{")) return decoded;
  } catch {
    /* keep original */
  }

  return value;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
