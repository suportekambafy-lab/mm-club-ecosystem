import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getWebPushPublicKeyValue,
  revokePushSubscription,
  savePushSubscription,
} from "@/lib/push.server";

export const getWebPushPublicKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ publicKey: string }> => ({
    publicKey: getWebPushPublicKeyValue(),
  }));

export const registerWebPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(10) }),
        userAgent: z.string().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> =>
    savePushSubscription(context.userId, data),
  );

export const unregisterWebPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ endpoint: z.string().url() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> =>
    revokePushSubscription(context.userId, data.endpoint),
  );