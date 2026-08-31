import { createFileRoute } from "@tanstack/react-router";

/**
 * Guarda de gravações (cron, cada 5 min).
 *
 * Corrige a falha que gerou um "replay" de 11 horas: se o `stopEgress` do fim
 * da live falhar, o egress continua a empurrar RTMP para o Cloudflare durante
 * horas e o ficheiro gravado fica inutilizável.
 *
 * Regras:
 *  - egress ativo cuja live já não está `live` → parar;
 *  - egress ativo há mais de MAX_HOURS → parar (e encerrar a live);
 *  - live com status `live` sem atividade há mais de MAX_HOURS → encerrar.
 *
 * Auth: header `x-cron-secret` com CRON_SECRET.
 */
const MAX_HOURS = 6;

export const Route = createFileRoute("/api/public/hooks/lives-egress-guard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        const actions: Array<Record<string, unknown>> = [];
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { listActiveEgress, parseRoomName, stopLiveRecording } = await import(
            "@/lib/live-egress.server"
          );

          const maxMs = MAX_HOURS * 60 * 60 * 1000;
          const now = Date.now();

          let active: Awaited<ReturnType<typeof listActiveEgress>> = [];
          try {
            active = await listActiveEgress();
          } catch (e) {
            console.error("[lives-egress-guard] listActiveEgress failed", e);
          }

          for (const e of active) {
            const parsed = e.roomName ? parseRoomName(e.roomName) : null;
            const tooLong = e.startedAtMs ? now - e.startedAtMs > maxMs : false;
            let stale = false;

            if (parsed) {
              const { data: live } = await supabaseAdmin
                .from("lives")
                .select("id,status")
                .eq("id", parsed.liveId)
                .maybeSingle();
              stale = !live || live.status !== "live";
            } else {
              stale = true; // sala desconhecida → não deve haver gravação
            }

            if (!stale && !tooLong) continue;
            const stopped = e.egressId ? await stopLiveRecording(e.egressId) : false;
            actions.push({ egressId: e.egressId, room: e.roomName, stale, tooLong, stopped });

            if (parsed && tooLong) {
              await supabaseAdmin
                .from("lives")
                .update({
                  status: "ended",
                  ended_at: new Date().toISOString(),
                  recording_stopped_at: new Date().toISOString(),
                })
                .eq("id", parsed.liveId)
                .eq("status", "live");
            }
          }

          // Lives no ar sem gravação ativa → reiniciar (alterna RTMPS/RTMP).
          const { data: onAir } = await supabaseAdmin
            .from("lives")
            .select("id,mode,started_at")
            .eq("status", "live");

          for (const row of onAir ?? []) {
            const hasActive = active.some((e) => {
              const p = e.roomName ? parseRoomName(e.roomName) : null;
              return p?.liveId === row.id;
            });
            if (hasActive) continue;
            const { ensureLiveRecording } = await import("@/lib/live-recording.server");
            const res = await ensureLiveRecording(row.id);
            actions.push({ liveId: row.id, restartedRecording: res.ok, reason: res.reason });
          }

          // Lives penduradas em "live" há demasiado tempo (browser fechado).
          const cutoff = new Date(now - maxMs).toISOString();
          const { data: hanging } = await supabaseAdmin
            .from("lives")
            .select("id,started_at,recording_egress_id")
            .eq("status", "live")
            .lt("started_at", cutoff);

          for (const row of hanging ?? []) {
            if (row.recording_egress_id) await stopLiveRecording(row.recording_egress_id);
            await supabaseAdmin
              .from("lives")
              .update({
                status: "ended",
                ended_at: new Date().toISOString(),
                recording_stopped_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            actions.push({ liveId: row.id, forcedEnd: true });
          }

          return new Response(
            JSON.stringify({ ok: true, activeEgress: active.length, actions }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          console.error("[lives-egress-guard] fatal", e);
          return new Response(JSON.stringify({ error: e?.message ?? "error", actions }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
