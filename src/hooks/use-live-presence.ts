import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live viewer count using Supabase Realtime "presence".
 * Every connected client joins a channel and the presence state size is the count.
 */
export function useLivePresence(liveId: string | null, userId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!liveId) return;

    const channel = supabase.channel(`live-presence:${liveId}`, {
      config: { presence: { key: userId ?? crypto.randomUUID() } },
    });

    const updateCount = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      setCount(Object.keys(state).length);
    };

    channel
      .on("presence", { event: "sync" }, updateCount)
      .on("presence", { event: "join" }, updateCount)
      .on("presence", { event: "leave" }, updateCount)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId, userId]);

  return count;
}
