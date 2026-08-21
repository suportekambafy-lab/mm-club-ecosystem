/**
 * Admin Progresso API — gated on the `admin` role.
 * Thin wrapper: all logic lives in `src/lib/admin/progress.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProgressOverview } from "@/lib/admin/progress-types";

export const getProgressOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressOverview> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { collectProgressOverview } = await import("@/lib/admin/progress.server");
    return collectProgressOverview();
  });
