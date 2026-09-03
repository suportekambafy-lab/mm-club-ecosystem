/**
 * Remembers which plan a visitor tried to activate, so that after a failed
 * payment, a login or a session switch we can take them straight back to it
 * instead of showing the generic 3-plan wall again.
 */
const KEY = "mm:intended_plan";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export type IntendedPlan = {
  /** Price slug from the catalog, or "vip" for the trial offer. */
  slug: string;
  /** Kind of offer: generic plan wall ("checkout") or a trial landing ("vip"). */
  from: "checkout" | "vip";
  /**
   * Exact landing page the visitor came from (e.g. "/trial14").
   * Without it a 14-day lead could be sent back to the 3-month VIP page.
   */
  path?: string;
  at: number;
};

/** Maps a trial price slug to the landing page that sells it. */
const TRIAL_PATHS: Record<string, string> = {
  mm_club_trial14: "/trial14",
  mm_club_vip_trial: "/vip",
};

/** Where should we send the visitor back to? Null = generic plan wall. */
export function intendedOfferPath(intent: IntendedPlan | null): string | null {
  if (!intent) return null;
  if (intent.path) return intent.path;
  if (intent.from !== "vip") return null;
  return TRIAL_PATHS[intent.slug] ?? "/vip";
}

export function rememberIntendedPlan(
  slug: string,
  from: IntendedPlan["from"] = "checkout",
  path?: string,
) {
  if (typeof window === "undefined" || !slug) return;
  try {
    const value: IntendedPlan = {
      slug,
      from,
      path: path ?? TRIAL_PATHS[slug],
      at: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage indisponível */
  }
}

export function readIntendedPlan(): IntendedPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntendedPlan;
    if (!parsed?.slug || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearIntendedPlan() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
