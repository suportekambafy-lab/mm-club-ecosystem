import { createFileRoute } from "@tanstack/react-router";

/**
 * Sends a waitlist broadcast.
 *
 * kind = "heads-up" -> announcement that we open at the launch date
 * kind = "open"     -> launch email with the link to join (quiz -> checkout)
 *
 * Deduped through `email_log` on (recipient, kind, ref), so re-runs are safe.
 * Auth: caller must send the project publishable/anon key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/waitlist-broadcast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { kind?: string } = {};
        try {
          body = (await request.json()) as { kind?: string };
        } catch {
          body = {};
        }
        const kind = body.kind === "open" ? "open" : "heads-up";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { sendTemplateEmailResend } = await import(
            "@/lib/email-templates/send-resend.server"
          );
          const { LAUNCH_LABEL } = await import("@/lib/launch");


          const logKind = kind === "open" ? "waitlist_open" : "waitlist_heads_up";
          const templateName = kind === "open" ? "waitlist-open" : "waitlist-heads-up";

          const { data: rows, error } = await supabaseAdmin
            .from("waitlist")
            .select("email")
            .limit(5000);
          if (error) throw new Error(error.message);

          const { data: logged } = await supabaseAdmin
            .from("email_log")
            .select("recipient")
            .eq("kind", logKind);
          const seen = new Set((logged ?? []).map((r) => (r.recipient ?? "").toLowerCase()));

          const emails = Array.from(
            new Set(
              (rows ?? [])
                .map((r) => (r.email ?? "").trim().toLowerCase())
                .filter((e) => e && /^\S+@\S+\.\S+$/.test(e)),
            ),
          ).filter((e) => !seen.has(e));

          let sent = 0;
          let skipped = 0;
          for (const email of emails) {
            try {
              const result = await sendTemplateEmailResend(
                templateName,
                email,
                kind === "open" ? {} : { launchLabel: LAUNCH_LABEL },
              );
              if (result.sent) sent++;
              else skipped++;
              await supabaseAdmin.from("email_log").insert({
                recipient: email,
                kind: logKind,
                ref: "public-launch",
                status: result.sent ? "sent" : "error",
                provider_id: result.sent ? result.providerId : null,
                error: result.sent ? null : result.error,
              });

            } catch (err) {
              await supabaseAdmin.from("email_log").insert({
                recipient: email,
                kind: logKind,
                ref: "public-launch",
                status: "error",
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }

          return Response.json({ ok: true, kind, candidates: emails.length, sent, skipped });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
