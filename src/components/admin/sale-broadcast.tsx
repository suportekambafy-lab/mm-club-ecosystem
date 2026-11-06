import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SaleCelebration, useSaleBell } from "./sale-celebration";
import { useServerFn } from "@tanstack/react-start";
import { listPaidSaleNotifications } from "@/lib/commercial/paid-sale.functions";
import { createPaidSaleTracker } from "@/lib/commercial/paid-sale-tracker";

export const SALE_CHANNEL = "mm-sales";
export const SALE_EVENT = "sale-closed";

export type SaleBroadcast = { amount: number; closer: string; lead: string };

export function broadcastSale(payload: SaleBroadcast) {
  const channel = supabase.channel(SALE_CHANNEL);
  void channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void channel.send({ type: "broadcast", event: SALE_EVENT, payload }).then(() => {
      void supabase.removeChannel(channel);
    });
  });
}

export function SaleBroadcastListener() {
  const [sale, setSale] = useState<(Partial<SaleBroadcast> & { amount: number; buyer?: string | null }) | null>(null);
  const fetchPaid = useServerFn(listPaidSaleNotifications);
  const fetchRef = useRef(fetchPaid);
  fetchRef.current = fetchPaid;
  const bell = useSaleBell();
  const bellRef = useRef(bell);
  bellRef.current = bell;
  const dismiss = useCallback(() => setSale(null), []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cursor: string | undefined;
    const track = createPaidSaleTracker();
    // Serialise celebrations: simultaneous paid sales each get their three bell strikes.
    let queue = Promise.resolve();
    const unlock = () => bellRef.current.prepare();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    const poll = async () => {
      try {
        const result = await fetchRef.current({ data: { since: cursor } });
        if (stopped) return;
        cursor = result.checkedAt;
        for (const notice of track(result.notices)) {
          queue = queue.then(async () => {
            if (stopped) return;
            bellRef.current.prepare();
            setSale({ amount: notice.amount, buyer: notice.buyer ?? null });
            await bellRef.current.ring();
          });
        }
      } catch { /* Keep the silent baseline and retry; errors are not sales. */ }
      if (!stopped) timer = setTimeout(() => { void poll(); }, 10_000);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  useEffect(() => {
    const channel = supabase.channel(SALE_CHANNEL);
    channel.on("broadcast", { event: SALE_EVENT }, ({ payload }) => {
      const data = payload as Partial<SaleBroadcast>;
      if (typeof data?.amount !== "number" || data.amount <= 0) return;
      bellRef.current.prepare();
      setSale({ amount: data.amount, closer: String(data.closer ?? "Equipa"), lead: String(data.lead ?? "") });
      void bellRef.current.ring();
    });
    void channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);
  if (!sale) return null;
  return <SaleCelebration amount={sale.amount} closer={sale.closer} buyer={sale.buyer} strike={bell.strike} isRinging={bell.isRinging} onDismiss={dismiss} />;
}
