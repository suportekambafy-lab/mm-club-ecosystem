export type PaidSaleNotice = { id: string; amount: number; paidAt: string; buyer?: string | null };

/** A silent baseline, then each confirmed, positive-value sale only once. */
export function createPaidSaleTracker() {
  let initialized = false;
  const seen = new Set<string>();
  return (rows: PaidSaleNotice[]) => {
    const paid = rows.filter(row => row.amount > 0 && Number.isFinite(row.amount) && row.paidAt);
    const fresh = initialized ? paid.filter(row => !seen.has(row.id)) : [];
    for (const row of paid) seen.add(row.id);
    initialized = true;
    return fresh.sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  };
}