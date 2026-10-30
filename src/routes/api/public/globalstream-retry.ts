import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/globalstream-retry")({
  server: { handlers: { POST: async ({ request }) => {
    const { verifyCronRequest } = await import("@/lib/cron-auth.server");
    const denied = verifyCronRequest(request);
    if (denied) return denied;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { globalstreamConsumer } = await import("@/lib/queue/handlers/globalstream.server");
    const { data: jobs, error } = await supabaseAdmin.from("job_queue")
      .select("id,payload").eq("consumer", "globalstream").eq("status", "failed")
      .like("last_error", "Invalid redirect value,%")
      .gte("created_at", "2026-10-29T00:00:00Z").lt("created_at", "2026-10-30T00:00:00Z");
    if (error) return Response.json({ error: "Could not read failed deliveries" }, { status: 500 });
    let delivered = 0;
    let failed = 0;
    for (const job of jobs ?? []) {
      const { data: claimed, error: claimError } = await supabaseAdmin.from("job_queue")
        .update({ status: "running", locked_at: new Date().toISOString() })
        .eq("id", job.id).eq("status", "failed").select("id").maybeSingle();
      if (claimError || !claimed) continue;
      try {
        await globalstreamConsumer(job.payload as { paymentId: string; source: string });
        const { error: saveError } = await supabaseAdmin.from("job_queue")
          .update({ status: "done", completed_at: new Date().toISOString(), locked_at: null, last_error: null }).eq("id", job.id);
        if (saveError) throw new Error("Delivery acknowledgement could not be saved");
        delivered += 1;
      } catch (err) {
        failed += 1;
        await supabaseAdmin.from("job_queue").update({ status: "failed", locked_at: null,
          last_error: err instanceof Error ? err.message : "Delivery failed" }).eq("id", job.id);
      }
    }
    return Response.json({ selected: jobs?.length ?? 0, delivered, failed });
  } } },
});