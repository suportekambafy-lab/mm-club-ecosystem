import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Gera uma capa MM Club para um curso (opcionalmente com a foto do autor). */
export const adminGenerateCourseCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        courseId: z.string().min(1).max(80),
        title: z.string().min(1).max(180),
        tagline: z.string().max(400).optional(),
        authorImageUrl: z.string().url().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateAndStoreCourseCover } = await import("@/lib/course-cover.server");

    const url = await generateAndStoreCourseCover({
      courseId: data.courseId,
      title: data.title,
      tagline: data.tagline ?? null,
      supabaseAdmin,
      authorImageUrl: data.authorImageUrl,
    });

    return { url, css: `url(${url}) center/cover no-repeat, #000` };
  });
