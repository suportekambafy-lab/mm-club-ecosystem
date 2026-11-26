import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Shared Realtime presence room for MMpay checkouts. Payload carries no personal data. */
export const CHECKOUT_LIVE_CHANNEL = "mmpay-checkout-live";
export type CheckoutStage = "viewing" | "filling" | "paying";
export type CheckoutPresence = { code: string; title: string; stage: CheckoutStage; method: string; amountCents: number; currency: string; since: string; country?: string; city?: string; lat?: number; lng?: number };

type Geo = { country?: string; city?: string; lat?: number; lng?: number };
let geoPromise: Promise<Geo> | null = null;
/** Approximate location only (city level); the IP itself is never shared. */
function loadGeo(): Promise<Geo> {
  geoPromise ??= fetch("https://get.geojs.io/v1/ip/geo.json").then(r => r.json()).then((g: Record<string, string>) => ({ country: g["country"], city: g["city"], lat: Number(g["latitude"]) || undefined, lng: Number(g["longitude"]) || undefined })).catch(() => ({}));
  return geoPromise;
}

export function useTrackCheckoutPresence(info: Omit<CheckoutPresence, "since"> | null) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const readyRef = useRef(false);
  const since = useRef(new Date().toISOString());
  const [geo, setGeo] = useState<Geo>({});
  useEffect(() => { void loadGeo().then(g => setGeo(Object.fromEntries(Object.entries(g).filter(([, v]) => v !== undefined)) as Geo)); }, []);
  const code = info?.code ?? null;
  useEffect(() => {
    if (!code) return;
    const ch = supabase.channel(CHECKOUT_LIVE_CHANNEL, { config: { presence: { key: crypto.randomUUID() } } });
    channelRef.current = ch;
    ch.subscribe((s) => { if (s === "SUBSCRIBED") readyRef.current = true; });
    return () => { readyRef.current = false; channelRef.current = null; void supabase.removeChannel(ch); };
  }, [code]);
  const key = info ? `${info.stage}|${info.method}|${info.title}|${geo.city ?? ""}` : "";
  useEffect(() => {
    if (!info) return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (readyRef.current && channelRef.current) { void channelRef.current.track({ ...info, ...geo, since: since.current }); clearInterval(t); }
      else if (tries > 60) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
