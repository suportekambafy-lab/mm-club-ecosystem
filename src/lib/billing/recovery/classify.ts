/**
 * Revenue Recovery — failure classification.
 *
 * Pure module (no I/O): turns a gateway failure reason into one of three
 * categories that decide how hard the Recovery Engine should try.
 *
 *  - recoverable → the money may well arrive later (full schedule)
 *  - permanent   → the instrument itself is dead (few attempts, ask for a new card)
 *  - fraud       → stop immediately and alert administration
 */

export type FailureCategory = "recoverable" | "permanent" | "fraud";

export type FailureClassification = {
  category: FailureCategory;
  /** Normalised gateway code, always lowercase snake_case. */
  code: string;
  /** Human sentence in pt-PT, safe to show in the admin panel. */
  message: string;
  /** Hard ceiling for this category (never above MAX_RECOVERY_ATTEMPTS). */
  maxAttempts: number;
  /** true → the member must update the payment method for recovery to work. */
  requiresNewMethod: boolean;
};

const RECOVERABLE = new Set([
  "insufficient_funds",
  "refused_by_issuer",
  "authorization_error",
  "card_declined",
  "declined",
  "issuer_unavailable",
  "issuer_declined",
  "temporary_failure",
  "timeout",
  "network_error",
  "gateway_error",
  "amount_limit_exceeded",
  "transaction_limit_exceeded",
  "pending_failed",
  "unknown_reason",
]);

const PERMANENT = new Set([
  "card_expired",
  "expired_card",
  "invalid_card_number",
  "invalid_card_type",
  "invalid_card_holder_name",
  "invalid_cvv",
  "inactive_card",
  "card_blocked",
  "lost_or_stolen_card",
  "revoked_authorization",
  "mandate_invalid",
  "mandate_revoked",
  "account_closed",
  "invalid_account_number",
  "customer_deceased",
  "no_payment_method",
  "authentication_abandoned",
  "authentication_failed",
  "invalid_signature",
]);

const FRAUD = new Set([
  "possible_fraud",
  "suspected_fraud",
  "fraud",
  "chargeback",
  "blacklisted_card",
  "blocked_by_risk",
  "aml_block",
]);

const MESSAGES: Record<string, string> = {
  insufficient_funds: "Saldo insuficiente no momento da cobrança.",
  refused_by_issuer: "O banco emissor recusou a cobrança.",
  card_declined: "Cartão recusado pelo banco.",
  issuer_unavailable: "Banco emissor indisponível.",
  timeout: "O pagamento expirou sem resposta do banco.",
  card_expired: "Cartão expirado — é necessário um novo método.",
  invalid_cvv: "Código de segurança inválido.",
  inactive_card: "Cartão inativo ou cancelado.",
  mandate_revoked: "Autorização de débito revogada pelo cliente.",
  account_closed: "Conta bancária encerrada.",
  no_payment_method: "Não existe nenhum método de pagamento válido guardado.",
  authentication_abandoned: "Autenticação forte (3-D Secure) não concluída.",
  possible_fraud: "O pagamento foi bloqueado por suspeita de fraude.",
  chargeback: "Pagamento revertido pelo banco (chargeback).",
  unknown_reason: "O gateway não indicou o motivo da falha.",
};

/** Ceilings per category. The absolute cap lives in `schedule.ts`. */
export const CATEGORY_MAX_ATTEMPTS: Record<FailureCategory, number> = {
  recoverable: 15,
  permanent: 4,
  fraud: 0,
};

export function normalizeFailureCode(reason: string | null | undefined): string {
  if (!reason) return "unknown_reason";
  return reason
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 60) || "unknown_reason";
}

export function classifyFailure(
  reason: string | null | undefined,
  opts: { isChargeback?: boolean } = {},
): FailureClassification {
  const code = opts.isChargeback ? "chargeback" : normalizeFailureCode(reason);

  const category: FailureCategory = FRAUD.has(code)
    ? "fraud"
    : PERMANENT.has(code)
      ? "permanent"
      : RECOVERABLE.has(code)
        ? "recoverable"
        : // Unknown codes are treated as recoverable: never throw money away
          // because the gateway invented a new string.
          "recoverable";

  return {
    category,
    code,
    message: MESSAGES[code] ?? "Falha na cobrança comunicada pelo gateway.",
    maxAttempts: CATEGORY_MAX_ATTEMPTS[category],
    requiresNewMethod: category === "permanent",
  };
}
