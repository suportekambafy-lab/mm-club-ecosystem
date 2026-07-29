import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PresenceMember = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Real online presence for the community: everyone with the app open is
 * tracked on a shared realtime channel. No inference from recent posts.
 */
export function useCommunityPresence(
  me: { id: string; display_name: string | null; avatar_url: string | null } | null,
) {
  const [members, setMembers] = useState<PresenceMember[]>([]);

  useEffect(() => {
    if (!me?.id) {
      setMembers([]);
      return;
    }

    const channel = supabase.channel("community-presence", {
      config: { presence: { key: me.id } },
    });

    const sync = () => {
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
      const list: PresenceMember[] = [];
      for (const [key, metas] of Object.entries(state)) {
        const m = metas[0] ?? {};
        list.push({
          id: key,
          display_name: (m.display_name as string | null) ?? null,
          avatar_url: (m.avatar_url as string | null) ?? null,
        });
      }
      setMembers(list);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({
            display_name: me.display_name,
            avatar_url: me.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id, me?.display_name, me?.avatar_url]);

  return members;
}

/** Profile fields required before we stop nagging in the bell. */
export function profileIsComplete(p: {
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
} | null | undefined) {
  return Boolean(p?.display_name && p?.avatar_url && p?.bio);
}
