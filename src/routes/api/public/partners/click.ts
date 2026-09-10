/**
 * Contagem de cliques nos links MM Partners.
 * Público (o visitante ainda não tem conta), sem dados pessoais: guardamos
 * apenas um identificador anónimo do dispositivo para não contar duas vezes.
 */
import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/partners/click")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { code?: unknown; visitor?: unknown } = {};
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ ok: false }, 400);
        }

        const code = String(payload.code ?? "")
          .trim()
          .toUpperCase()
          .slice(0, 20);
        const visitor = String(payload.visitor ?? "")
          .trim()
          .slice(0, 64);
        if (!/^[A-Z0-9]{4,20}$/.test(code)) return json({ ok: false }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: account } = await supabaseAdmin
          .from("mm_partner_accounts")
          .select("id, status, clicks_total")
          .eq("code", code)
          .maybeSingle();
        if (!account || account.status !== "active") return json({ ok: false }, 404);

        const { error } = await supabaseAdmin.from("mm_partner_clicks").insert({
          partner_id: account.id,
          code,
          visitor_key: visitor || null,
          referer: request.headers.get("referer")?.slice(0, 300) ?? null,
          user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        });

        // 23505 = mesmo dispositivo a repetir o clique: não conta outra vez.
        if (error) return json({ ok: true, counted: false });

        await supabaseAdmin
          .from("mm_partner_accounts")
          .update({ clicks_total: (account.clicks_total ?? 0) + 1 })
          .eq("id", account.id);

        return json({ ok: true, counted: true });
      },
    },
  },
});
