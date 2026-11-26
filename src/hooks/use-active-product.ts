import { useEffect, useSyncExternalStore } from "react";
import { CLUB_PRODUCTS, type ClubProductId } from "@/lib/club/products";

const KEY = "mm.activeProduct";
const listeners = new Set<() => void>();
let current: ClubProductId = "ecommerce";
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const v = window.localStorage.getItem(KEY);
  if (CLUB_PRODUCTS.some((p) => p.id === v)) current = v as ClubProductId;
}

export function setActiveProduct(id: ClubProductId) {
  current = id;
  try { window.localStorage.setItem(KEY, id); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/** Produto do MM Club em que o membro está (como mudar de espaço). */
export function useActiveProduct(): [ClubProductId, (id: ClubProductId) => void] {
  const value = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => current,
    () => "ecommerce" as ClubProductId,
  );
  useEffect(() => {
    if (!loaded) { load(); listeners.forEach((l) => l()); }
  }, []);
  return [value, setActiveProduct];
}
