import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { META_PIXEL_ID } from "./pixel";

const GRAPH_VERSION = "v21.0";

const schema = z.object({
  eventName: z.string().min(1).max(64),
  eventId: z.string().min(1).max(128),
  eventSourceUrl: z.string().url().max(2048),
  custom: z
    .object({
      value: z.number().nonnegative().max(1_000_000).optional(),
      currency: z.string().length(3).optional(),
      content_name: z.string().max(200).optional(),
      content_ids: z.array(z.string().max(120)).max(20).optional(),
      content_type: z.string().max(40).optional(),
      predicted_ltv: z.number().nonnegative().max(1_000_000).optional(),
    })
    .default({}),
  user: z
    .object({
      email: z.string().max(320).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
      firstName: z.string().max(120).nullable().optional(),
      lastName: z.string().max(120).nullable().optional(),
      externalId: z.string().max(120).nullable().optional(),
      fbp: z.string().max(200).nullable().optional(),
      fbc: z.string().max(400).nullable().optional(),
    })
    .default({}),
});

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashed(value?: string | null): Promise<string | undefined> {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return sha256(normalized);
}

/**
 * Meta Conversions API — envio servidor-a-servidor, deduplicado com o pixel
 * pelo mesmo `event_id`. Best-effort: nunca quebra o fluxo do utilizador.
 */
export const sendMetaConversion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const token = process.env.META_CAPI_ACCESS_TOKEN;
    if (!token) return { sent: false as const, reason: "not_configured" };

    const request = getRequest();
    const headers = request.headers;
    const ip =
      headers.get("cf-connecting-ip") ??
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined;

    const user_data: Record<string, unknown> = {
      em: await hashed(data.user.email),
      ph: await hashed(data.user.phone?.replace(/[^\d]/g, "")),
      fn: await hashed(data.user.firstName),
      ln: await hashed(data.user.lastName),
      external_id: await hashed(data.user.externalId),
      fbp: data.user.fbp ?? undefined,
      fbc: data.user.fbc ?? undefined,
      client_ip_address: ip,
      client_user_agent: headers.get("user-agent") ?? undefined,
    };
    for (const key of Object.keys(user_data)) {
      if (user_data[key] === undefined) delete user_data[key];
    }

    const payload = {
      data: [
        {
          event_name: data.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.eventId,
          event_source_url: data.eventSourceUrl,
          action_source: "website",
          user_data,
          custom_data: data.custom,
        },
      ],
      ...(process.env.META_CAPI_TEST_EVENT_CODE
        ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE }
        : {}),
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        console.error("[meta-capi] rejeitado", res.status, await res.text());
        return { sent: false as const, reason: "rejected" };
      }
      return { sent: true as const };
    } catch (err) {
      console.error("[meta-capi] falhou", err);
      return { sent: false as const, reason: "error" };
    }
  });
