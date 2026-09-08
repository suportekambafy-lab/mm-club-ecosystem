/**
 * Contexto de conta para o MM Suporte (server-only).
 *
 * O agente precisa de saber se o membro tem acesso e, quando não tem, porquê:
 * pagamento em falta, período de tolerância, conta suspensa ou plano expirado.
 * Sem isto o suporte responde "limpa a cache" a quem simplesmente está em
 * dívida — foi exactamente o que aconteceu.
 */
import { getOutstanding } from "./billing/debt.server";

const STATUS_PT: Record<string, string> = {
  active: "ativa",
  trialing: "em período de teste",
  past_due: "com pagamento em falta",
  grace_period: "em período de tolerância (pagamento em falta)",
  suspended: "suspensa por falta de pagamento",
  cancelled: "cancelada",
  expired: "expirada",
};

function euros(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency || "EUR",
  }).format(cents / 100);
}

function day(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(
    new Date(iso),
  );
}

/** Frase pronta a injectar no prompt do suporte. */
export async function supportAccountContext(userId: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: access } = await supabaseAdmin.rpc("has_feature", {
      _user_id: userId,
      _feature: "academy.access",
    });
    const hasAccess = Boolean(access);

    const debt = await getOutstanding(userId);
    const status = debt.status;

    if (hasAccess && (status === "active" || status === "trialing")) {
      return `\n\nConta do membro: acesso ativo (subscrição ${STATUS_PT[status] ?? status}). Se ele diz que não consegue ver aulas, é problema técnico — ajuda com passos de resolução.`;
    }

    if (hasAccess) {
      return "\n\nConta do membro: tem acesso às aulas neste momento. Se não consegue ver, trata como problema técnico.";
    }

    if (!status) {
      return "\n\nConta do membro: sem subscrição ativa, por isso as aulas, a comunidade, as lives e as ferramentas estão fechadas. Explica isto com clareza e envia para [Subscrição](/subscricao) para escolher um plano.";
    }

    const parts = [
      `\n\nConta do membro: SEM acesso. A subscrição está ${STATUS_PT[status] ?? status}.`,
      "É esta a razão por que as aulas, a comunidade, as lives e as ferramentas não abrem — não é um problema técnico, não sugiras cache, VPN nem outro browser.",
    ];

    if (debt.amountCents > 0) {
      parts.push(
        `Valor em falta: ${euros(debt.amountCents, debt.currency)}${
          debt.cycles > 1 ? ` (${debt.cycles} mensalidades acumuladas)` : ""
        }.`,
      );
      const since = day(debt.dueSince);
      if (since) parts.push(`Em falta desde ${since}.`);
      const next = day(debt.nextIncreaseAt);
      if (next)
        parts.push(
          `Se não regularizar, a dívida soma outra mensalidade a ${next}.`,
        );
    }

    if (debt.planName) parts.push(`Plano: ${debt.planName}.`);

    parts.push(
      "Diz-lhe o motivo em linguagem simples, indica o valor se existir, garante que o progresso não foi apagado e envia-o para [Subscrição](/subscricao) para regularizar. Só escalas para humano se ele disser que já pagou ou contestar o valor.",
    );

    return parts.join(" ");
  } catch (err) {
    console.error("[support] account context failed", err);
    return "";
  }
}
