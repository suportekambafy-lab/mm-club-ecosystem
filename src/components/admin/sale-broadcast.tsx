import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SaleCelebration, useSaleBell } from "./sale-celebration";

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
  const [sale, setSale] = useState<SaleBroadcast | null>(null);
  const bell = useSaleBell();
  const bellRef = useRef(bell);
  bellRef.current = bell;
  const dismiss = useCallback(() => setSale(null), []);
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
  return <SaleCelebration amount={sale.amount} closer={sale.closer} onDismiss={dismiss} />;
}
