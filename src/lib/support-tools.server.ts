/**
 * Ações reais do MM Suporte (server-only).
 *
 * Segurança: cada ação actua SEMPRE sobre o membro autenticado que está a
 * escrever no chat — o modelo nunca recebe nem escolhe um userId. Não existem
 * ações destrutivas nem de dinheiro (não altera planos, não cria créditos, não
 * cancela nada). Tudo é registado em `support_actions`, que também serve de
 * travão de repetição (rate limit).
 */
import { tool } from "ai";
import { z } from "zod";

type Actor = { id: string; email: string | null };

const MIN = 60_000;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (t: string) => any;
    auth: any;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
}

async function logAction(
  userId: string,
  action: string,
  detail: Record<string, unknown>,
) {
  try {
    const db = await admin();
    await db.from("support_actions").insert({ user_id: userId, action, detail });
  } catch (err) {
    console.error("[support-tools] log failed", action, err);
  }
}

/** true quando a ação foi feita há menos de `windowMs` (ou já excedeu o dia). */
async function tooSoon(
  userId: string,
  action: string,
  windowMs: number,
  dailyMax = 5,
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const db = await admin();
    const since = new Date(Date.now() - 24 * 60 * MIN).toISOString();
    const { data } = await db
      .from("support_actions")
      .select("created_at")
      .eq("user_id", userId)
      .eq("action", action)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(dailyMax);

    const rows = (data ?? []) as { created_at: string }[];
    if (rows.length >= dailyMax) {
      return { blocked: true, reason: "limite diário atingido" };
    }
    const last = rows[0]?.created_at ? new Date(rows[0].created_at).getTime() : 0;
    if (last && Date.now() - last < windowMs) {
      return { blocked: true, reason: "acabou de ser enviado há poucos minutos" };
    }
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

function euros(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(
    cents / 100,
  );
}

export function buildSupportTools(actor: Actor, origin: string) {
  return {
    /** Envia o email de recuperação de palavra-passe para o email da conta. */
    enviar_email_recuperar_password: tool({
      description:
        "Envia AGORA o email de recuperação de palavra-passe para o email da conta do membro autenticado. Usa quando o membro não consegue entrar, esqueceu a palavra-passe ou quer defini-la.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!actor.email) {
          return { ok: false, message: "A conta não tem email associado." };
        }
        const gate = await tooSoon(actor.id, "password_reset", 10 * MIN, 4);
        if (gate.blocked) {
          return {
            ok: false,
            message: `Não voltei a enviar: ${gate.reason}. Pede-lhe para procurar o email (também no spam).`,
          };
        }
        const db = await admin();
        const { error } = await db.auth.resetPasswordForEmail(actor.email, {
          redirectTo: `${origin}/reset-password`,
        });
        await logAction(actor.id, "password_reset", {
          email: actor.email,
          ok: !error,
        });
        if (error) {
          console.error("[support-tools] reset failed", error);
          return { ok: false, message: "O envio falhou. Escala para humano." };
        }
        return {
          ok: true,
          message: `Email de recuperação enviado para ${actor.email}. O link é válido por pouco tempo; se não aparecer, ver spam.`,
        };
      },
    }),

    /** Estado real da conta: acesso, subscrição e dívida. */
    ver_estado_da_conta: tool({
      description:
        "Consulta o estado real da conta do membro: se tem acesso, estado da subscrição, plano, valor em dívida e desde quando.",
      inputSchema: z.object({}),
      execute: async () => {
        const db = await admin();
        const { getOutstanding } = await import("./billing/debt.server");
        const [{ data: access }, debt] = await Promise.all([
          db.rpc("has_feature", {
            _user_id: actor.id,
            _feature: "academy.access",
          }),
          getOutstanding(actor.id),
        ]);
        return {
          temAcesso: Boolean(access),
          estadoSubscricao: debt.status,
          plano: debt.planName,
          divida: debt.amountCents > 0 ? euros(debt.amountCents, debt.currency) : null,
          mensalidadesEmFalta: debt.cycles,
          emFaltaDesde: debt.dueSince,
          proximoAumento: debt.nextIncreaseAt,
        };
      },
    }),

    /** Últimas faturas do membro. */
    listar_faturas: tool({
      description:
        "Lista as últimas faturas/recibos do membro (número, data, valor, estado). Usa antes de reenviar uma fatura.",
      inputSchema: z.object({}),
      execute: async () => {
        const db = await admin();
        const { data } = await db
          .from("billing_invoices")
          .select("id, number, status, total_cents, currency, issued_at")
          .eq("user_id", actor.id)
          .order("issued_at", { ascending: false })
          .limit(6);
        const rows = (data ?? []) as {
          id: string;
          number: string | null;
          status: string;
          total_cents: number;
          currency: string;
          issued_at: string | null;
        }[];
        return {
          faturas: rows.map((r) => ({
            numero: r.number ?? r.id.slice(0, 8),
            estado: r.status,
            valor: euros(r.total_cents, r.currency),
            data: r.issued_at,
          })),
        };
      },
    }),

    /** Reenvia por email a fatura mais recente (ou a indicada pelo número). */
    enviar_fatura_por_email: tool({
      description:
        "Reenvia por email uma fatura/recibo do membro. Sem número, envia a mais recente.",
      inputSchema: z.object({
        numero: z
          .string()
          .optional()
          .describe("Número da fatura tal como aparece em listar_faturas"),
      }),
      execute: async ({ numero }) => {
        const gate = await tooSoon(actor.id, "invoice_email", 3 * MIN, 6);
        if (gate.blocked) {
          return { ok: false, message: `Não reenviei: ${gate.reason}.` };
        }
        const db = await admin();
        let q = db
          .from("billing_invoices")
          .select("id, number")
          .eq("user_id", actor.id)
          .order("issued_at", { ascending: false })
          .limit(1);
        if (numero) q = q.eq("number", numero);
        const { data } = await q;
        const inv = ((data ?? []) as { id: string; number: string | null }[])[0];
        if (!inv) {
          return { ok: false, message: "Não encontrei essa fatura nesta conta." };
        }
        const { sendInvoiceEmail } = await import("./billing/invoices.server");
        await sendInvoiceEmail(inv.id);
        await logAction(actor.id, "invoice_email", {
          invoiceId: inv.id,
          number: inv.number,
        });
        return {
          ok: true,
          message: `Fatura ${inv.number ?? ""} enviada para ${actor.email ?? "o email da conta"}. Também está sempre disponível em /subscricao.`,
        };
      },
    }),

    /** Reenvia o email de verificação/entrada por link. */
    enviar_link_de_entrada: tool({
      description:
        "Envia um link de entrada por email (magic link) quando o membro não consegue iniciar sessão mas tem acesso ao email.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!actor.email) {
          return { ok: false, message: "A conta não tem email associado." };
        }
        const gate = await tooSoon(actor.id, "magic_link", 10 * MIN, 4);
        if (gate.blocked) {
          return { ok: false, message: `Não voltei a enviar: ${gate.reason}.` };
        }
        const db = await admin();
        const { error } = await db.auth.signInWithOtp({
          email: actor.email,
          options: { emailRedirectTo: `${origin}/dashboard`, shouldCreateUser: false },
        });
        await logAction(actor.id, "magic_link", { ok: !error });
        if (error) {
          console.error("[support-tools] magic link failed", error);
          return { ok: false, message: "O envio falhou. Escala para humano." };
        }
        return {
          ok: true,
          message: `Link de entrada enviado para ${actor.email}.`,
        };
      },
    }),

    /** Marca a conversa para a equipa humana. */
    falar_com_humano: tool({
      description:
        "Marca esta conversa para a equipa humana quando o assunto envolve dinheiro em disputa, dados que não vês, ou o membro pede uma pessoa.",
      inputSchema: z.object({
        motivo: z.string().max(300).describe("Resumo curto do pedido"),
      }),
      execute: async ({ motivo }) => {
        const db = await admin();
        await db
          .from("support_threads")
          .update({ escalated: true, handled: false })
          .eq("user_id", actor.id);
        await logAction(actor.id, "escalated", { motivo });
        return {
          ok: true,
          message:
            "Conversa marcada para a equipa humana. Termina a resposta com o marcador [[HUMANO]].",
        };
      },
    }),
  };
}
