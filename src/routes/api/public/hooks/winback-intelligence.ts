// Inteligência de recuperação de subscrição — corre diariamente por pg_cron.
// Escolhe, para cada membro sem acesso válido, o gatilho mais forte do momento
// (live a caminho, aulas do Legacy, progresso interrompido, comunidade, marco
// de dias) e envia um único email. Requer o CRON_SECRET no header.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/winback-intelligence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        try {
          const { runWinbackIntelligence } = await import(
            "@/lib/billing/recovery/winback.server"
          );
          const result = await runWinbackIntelligence();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[winback]", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
