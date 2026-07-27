import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CommunityNotifKind = "like" | "reply" | "mention" | "reaction" | "comment_reply";

export type CommunityNotif = {
  id: string;
  kind: CommunityNotifKind;
  post_id: string | null;
  comment_id: string | null;
  short_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

type Row = {
  id: string;
  kind: CommunityNotifKind;
  post_id: string | null;
  comment_id: string | null;
  short_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

export function useCommunityNotifications() {
  const [items, setItems] = useState<CommunityNotif[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, post_id, comment_id, short_id, actor_id, read_at, dismissed_at, created_at")
      .eq("user_id", uid)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(30);

    const rows = (data ?? []) as Row[];
    const actorIds = Array.from(
      new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v)),
    );
    let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (actorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", actorIds);
      for (const p of profs ?? []) {
        profiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
      }
    }
    setItems(
      rows.map((r) => ({
        ...r,
        actor_name: r.actor_id ? profiles[r.actor_id]?.display_name ?? null : null,
        actor_avatar: r.actor_id ? profiles[r.actor_id]?.avatar_url ?? null : null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);
      if (!uid) {
        setLoading(false);
        return;
      }
      await load(uid);

      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => {
            load(uid);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => {
            load(uid);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
  }, [userId]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
      await supabase.from("notifications").update({ read_at: now }).eq("id", id);
    },
    [userId],
  );

  const dismiss = useCallback(
    async (id: string) => {
      if (!userId) return;
      const now = new Date().toISOString();
      setItems((prev) => prev.filter((n) => n.id !== id));
      await supabase.from("notifications").update({ dismissed_at: now }).eq("id", id);
    },
    [userId],
  );

  return { items, loading, markAllRead, markRead, dismiss, userId };
}
