// Admin-triggered broadcasts (new lesson notifications).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const notifyNewLessonSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  courseTitle: z.string().min(1),
  lessonTitle: z.string().min(1),
  visibility: z.enum(["public", "club", "premium", "purchased"]).default("club"),
});

export const notifyNewLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => notifyNewLessonSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Admin check
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { sendEmail, emailTemplates, getUserEmailAndName } = await import(
      "@/lib/email.server"
    );

    // Eligible recipients: users with entitlement matching this course's visibility.
    // Public content → notify all authenticated users with any entitlement.
    let userIds: string[] = [];
    if (data.visibility === "public") {
      const { data: rows } = await supabaseAdmin
        .from("user_entitlements")
        .select("user_id");
      userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
    } else {
      const { data: rows } = await supabaseAdmin
        .from("user_entitlements")
        .select("user_id")
        .eq("entitlement", data.visibility);
      userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
    }

    const { lapsedUserIds } = await import("@/lib/billing/lapsed-recipients.server");
    const lapsed = await lapsedUserIds();

    const ref = `${data.courseId}:${data.lessonId}`;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const userId of userIds) {
      const u = await getUserEmailAndName(userId);
      if (!u) {
        skipped++;
        continue;
      }
      const tpl = emailTemplates.newLesson(
        u.name,
        data.courseTitle,
        data.lessonTitle,
        data.courseId,
        data.lessonId,
      );
      const r = await sendEmail({
        to: u.email,
        subject: tpl.subject,
        html: tpl.html,
        userId,
        kind: "new_lesson",
        ref,
      });
      if (r.sent) sent++;
      else if (r.skipped) skipped++;
      else failed++;
    }

    return { ok: true, recipients: userIds.length, sent, skipped, failed };
  });
