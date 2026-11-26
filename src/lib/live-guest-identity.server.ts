import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

async function key() {
  const secret = process.env['LIVEKIT_API_SECRET'];
  if (!secret) throw new Error("Acesso de convidado indisponível.");
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mmclub/guest-cookie/v1:${secret}`)));
}

function cookieName(liveId: string) { return `mm-guest-${liveId}`; }

function assertSameOrigin() {
  const request = getRequest();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Pedido de convidado inválido.");
}

async function readIdentity(liveId: string): Promise<string | null> {
  const cookie = getCookie(cookieName(liveId));
  if (!cookie) return null;
  try {
    const { payload } = await jwtVerify(cookie, await key(), { algorithms: ["HS256"], issuer: "mmclub-guest", audience: liveId });
    return z.object({ sub: z.string().uuid(), liveId: z.literal(liveId), v: z.literal(1) }).parse(payload).sub;
  } catch { throw new Error("Sessão de convidado inválida. Volta a abrir o convite."); }
}

export async function requireGuestIdentity(liveId: string): Promise<string> {
  assertSameOrigin();
  const id = await readIdentity(liveId);
  if (!id) throw new Error("Sessão de convidado inválida. Volta a abrir o convite.");
  return id;
}

export async function getOrCreateGuestIdentity(liveId: string): Promise<string> {
  assertSameOrigin();
  const existing = await readIdentity(liveId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  const token = await new SignJWT({ liveId, v: 1 }).setProtectedHeader({ alg: "HS256" }).setSubject(id)
    .setIssuer("mmclub-guest").setAudience(liveId).setIssuedAt().setExpirationTime("30d").sign(await key());
  setCookie(cookieName(liveId), token, { httpOnly: true, secure: new URL(getRequest().url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return id;
}