import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-4o-mini-transcribe";
const MAX_BYTES = 25 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireRequestUser } = await import("@/lib/api-auth.server");
        const auth = await requireRequestUser(request);
        if ("denied" in auth) return auth.denied;

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return new Response("Audio file is required", { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return new Response("Audio too large (max 25MB)", { status: 413 });
        }

        const mime = (file.type || "audio/webm").split(";")[0];
        const extMap: Record<string, string> = {
          "audio/webm": "webm",
          "audio/mp4": "mp4",
          "audio/mpeg": "mp3",
          "audio/wav": "wav",
          "audio/x-wav": "wav",
          "audio/ogg": "ogg",
          "audio/aac": "aac",
          "audio/flac": "flac",
        };
        const ext = extMap[mime] ?? "webm";

        const upstream = new FormData();
        upstream.append("model", MODEL);
        upstream.append("file", file, `recording.${ext}`);

        const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`Transcription failed [${res.status}]: ${body}`);
          return new Response(body || `Transcription failed: ${res.status}`, {
            status: res.status,
          });
        }

        const data = (await res.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
