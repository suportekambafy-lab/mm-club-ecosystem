import { useSyncExternalStore } from "react";
import { subscribeOverrides, getOverridesVersion } from "@/data/admin-store";

/**
 * Subscribes to admin override changes so components re-render whenever
 * `applyOverrides` runs (initial client apply, admin autosave, cross-tab
 * storage sync). Returns a monotonically increasing version number that
 * can be used as a memo dependency.
 */
export function useAdminOverridesVersion() {
  return useSyncExternalStore(
    subscribeOverrides,
    getOverridesVersion,
    () => 0, // server snapshot
  );
}
