import { createFileRoute } from "@tanstack/react-router";

/**
 * Teste de gravação isolado (sem criar nenhuma live visível aos membros).
 *
 * Cria um live input temporário no Cloudflare Stream + uma sala LiveKit vazia,
 * arranca um RoomComposite egress a empurrar RTMPS para esse input, e permite
 * verificar/parar. Nada disto toca na tabela `lives`, por isso nenhum utilizador
 * vê o teste.
 *
 * Auth: header `x-cron-secret` com CRON_SECRET.
 *
 * body: { action: "start" | "status" | "stop", egressId?, inputUid?, room?, variant? }
 */
export const Route = createFileRoute("/api/public/hooks/recording-selftest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        try {
          const body = (await request.json().catch(() => ({}))) as {
            action?: string;
            egressId?: string;
            inputUid?: string;
            room?: string;
            variant?: "rtmps" | "rtmp";
          };
          const action = body.action ?? "start";

          const { createLiveInput, listVideosForLiveInput, deleteLiveInput } = await import(
            "@/lib/cloudflare-stream.server"
          );
          const { startLiveRecording, getRecordingStatus, stopLiveRecording } = await import(
            "@/lib/live-egress.server"
          );

          if (action === "start") {
            const { roomServiceClient, livekitRoomName } = await import("@/lib/livekit.server");
            const testId = `selftest-${Date.now()}`;
            const room = livekitRoomName(testId, "main");

            const svc = roomServiceClient();
            await svc.createRoom({ name: room, emptyTimeout: 900, maxParticipants: 5 });

            const input = await createLiveInput({ title: `MM Club — teste de gravação ${testId}` });
            const result = await startLiveRecording({
              liveId: testId,
              roomName: room,
              rtmpsUrl: input.rtmps.url,
              streamKey: input.rtmps.streamKey,
              variant: body.variant ?? "rtmps",
            });

            return json({
              ok: Boolean(result.egressId),
              testId,
              room,
              inputUid: input.uid,
              egressId: result.egressId,
              target: result.target,
              error: result.error,
            });
          }

          if (action === "status") {
            const egress = body.egressId
              ? await getRecordingStatus({ egressId: body.egressId })
              : body.room
              ? await getRecordingStatus({ roomName: body.room })
              : [];
            const videos = body.inputUid ? await listVideosForLiveInput(body.inputUid) : [];
            return json({ ok: true, egress, videos });
          }

          if (action === "stop") {
            const stopped = body.egressId ? await stopLiveRecording(body.egressId) : false;
            const videos = body.inputUid ? await listVideosForLiveInput(body.inputUid) : [];
            return json({ ok: true, stopped, videos });
          }

          if (action === "cleanup") {
            if (body.egressId) await stopLiveRecording(body.egressId).catch(() => false);
            if (body.inputUid) await deleteLiveInput(body.inputUid);
            const { roomServiceClient } = await import("@/lib/livekit.server");
            if (body.room) await roomServiceClient().deleteRoom(body.room).catch(() => {});
            return json({ ok: true, cleaned: true });
          }

          return json({ error: "unknown_action" }, 400);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[recording-selftest]", message);
          return json({ error: message }, 500);
        }
      },
    },
  },
});
