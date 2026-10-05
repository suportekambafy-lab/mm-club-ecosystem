// Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) só com Web Crypto.
// O pacote `web-push` depende de Buffer do Node e rebentava no servidor publicado.

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array<ArrayBuffer>): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function concat(...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bits: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bits),
  );
}

async function vapidAuthorization(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  const pub = b64urlToBytes(publicKey);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: privateKey,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    ext: true,
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)),
  );
  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${publicKey}`;
}

async function encryptPayload(p256dh: string, auth: string, payload: string) {
  const uaPublic = b64urlToBytes(p256dh);
  const authSecret = b64urlToBytes(auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256),
  );
  const ikm = await hkdf(
    authSecret,
    shared,
    concat(enc.encode("WebPush: info\0"), uaPublic, asPublic),
    256,
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 96);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plain),
  );
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export async function sendWebPush(args: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: string;
  ttl: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  subject: string;
  publicKey: string;
  privateKey: string;
}): Promise<void> {
  const body = await encryptPayload(args.p256dh, args.auth, args.payload);
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(
        args.endpoint,
        args.subject,
        args.publicKey,
        args.privateKey,
      ),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(args.ttl),
      Urgency: args.urgency ?? "normal",
    },
    body,
  });
  if (!res.ok) {
    const err = new Error(`push failed ${res.status}`) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
}
