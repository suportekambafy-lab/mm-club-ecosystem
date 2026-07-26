/**
 * Security policy types — client-safe (no server-only imports).
 *
 * Every server function declares WHAT it needs; the Security Gate decides
 * HOW it is enforced. Nothing here trusts the frontend.
 */

export type SecurityScope = "user" | "ip" | "both";

export interface RateLimitRule {
  /** Logical bucket name, e.g. "checkout". */
  bucket: string;
  /** Max calls allowed inside the window. */
  max: number;
  /** Sliding window length in seconds. */
  windowSeconds: number;
  /** Which subject the limit applies to. Defaults to "both". */
  scope?: SecurityScope;
}

export interface WafRule {
  /** Logical behaviour bucket, e.g. "plan-change". */
  bucket: string;
  /** Number of repetitions considered abusive. */
  max: number;
  /** Observation window in seconds. */
  windowSeconds: number;
}

export interface SecurityPolicy {
  /** Human name used in logs and the security dashboard. */
  name: string;
  /** Requires a valid, signature-verified session. Default true. */
  auth?: boolean;
  /** Requires the admin role, verified server-side. */
  admin?: boolean;
  /** Requires an entitlement feature key (server-resolved). */
  feature?: string;
  /** Volume limits (per user and/or per IP). */
  limit?: RateLimitRule | RateLimitRule[];
  /** Behavioural (logical WAF) rules. */
  waf?: WafRule | WafRule[];
  /** Blocked while Emergency Mode is active. */
  emergency?: "block" | "allow";
  /**
   * Marks the function as a write operation. Write operations are refused
   * while Read Only Mode is active (maintenance / incident investigation),
   * while reads keep working normally.
   */
  write?: boolean;
}

/** Generic message used everywhere so nothing can be enumerated. */
export const GENERIC_DENY =
  "Não foi possível concluir o pedido. Se o problema persistir, contacte o suporte.";

export const GENERIC_AUTH_DENY = "Sessão inválida ou expirada.";

export const GENERIC_LIMIT_DENY =
  "Demasiados pedidos. Aguarde um momento e tente novamente.";

export const EMERGENCY_DENY =
  "Estamos temporariamente em modo de manutenção de segurança. Tente novamente dentro de instantes.";

export class SecurityError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SecurityError";
    this.code = code;
  }
}
