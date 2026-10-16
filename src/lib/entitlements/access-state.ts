export type AccessGrant = { expires_at: string | null; revoked_at: string | null; source: string; metadata?: unknown };
export function resolveAccessState(grants: AccessGrant[], now: number) {
  const active = grants.filter(g => !g.revoked_at && (g.expires_at === null || Date.parse(g.expires_at) > now));
  const indefinite = active.some(g => g.expires_at === null);
  const expiresAt = indefinite ? null : active.map(g => g.expires_at).filter((v): v is string => v !== null).sort().at(-1) ?? null;
  const manual = grants.some(g => g.source === "manual" && typeof g.metadata === "object" && g.metadata !== null && "origin" in g.metadata && g.metadata.origin === "commercial");
  return { hasAccess: active.length > 0, expiresAt, manual, expired: manual && active.length === 0 };
}