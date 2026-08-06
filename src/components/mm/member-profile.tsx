import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MemberAvatar } from "@/components/mm/member-avatar";
import { useAdminIds } from "@/hooks/use-admin-ids";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CalendarDays, MessageSquare, Newspaper } from "lucide-react";

type Ctx = { open: (userId: string) => void };

const MemberProfileCtx = createContext<Ctx>({ open: () => {} });

export function useMemberProfile() {
  return useContext(MemberProfileCtx);
}

export function MemberProfileProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const open = useCallback((id: string) => setUserId(id), []);
  const value = useMemo(() => ({ open }), [open]);
  const isMobile = useIsMobile();

  const close = () => setUserId(null);

  return (
    <MemberProfileCtx.Provider value={value}>
      {children}
      {isMobile ? (
        <Drawer open={Boolean(userId)} onOpenChange={(o) => !o && close()}>
          <DrawerContent className="border-border bg-surface-1 px-0 pb-6">
            <div className="max-h-[80vh] overflow-y-auto px-5 pt-1">
              {userId && <MemberProfileBody userId={userId} />}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={Boolean(userId)} onOpenChange={(o) => !o && close()}>
          <DialogContent className="max-w-md overflow-hidden border-border bg-surface-1 p-0">
            <div className="px-7 pb-7 pt-8">
              {userId && <MemberProfileBody userId={userId} />}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </MemberProfileCtx.Provider>
  );
}

/** Clickable member name that opens the profile card. */
export function MemberNameButton({
  userId,
  children,
  className,
}: {
  userId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { open } = useMemberProfile();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open(userId);
      }}
      className={cn(
        "truncate text-left transition hover:text-primary hover:underline underline-offset-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

function monthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}

function MemberProfileBody({ userId }: { userId: string }) {
  const adminIds = useAdminIds();

  const q = useQuery({
    queryKey: ["community", "member", userId],
    queryFn: async () => {
      const [{ data: profile }, posts, comments] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url, bio, created_at, last_seen_at")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("community_posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId),
        supabase
          .from("community_comments")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId),
      ]);
      return {
        profile: profile as {
          id: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          last_seen_at: string | null;
        } | null,
        postCount: posts.count ?? 0,
        commentCount: comments.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  const p = q.data?.profile;
  if (!p) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Perfil não disponível.
      </p>
    );
  }

  const name = p.display_name ?? "Membro";
  const verified = adminIds.has(p.id);

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <div className="absolute -inset-1 rounded-full bg-primary/25 blur-md" aria-hidden />
          <MemberAvatar
            name={name}
            avatarUrl={p.avatar_url}
            verified={verified}
            size={84}
            className="relative"
          />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">{name}</h2>
        {verified && (
          <span className="mt-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Equipa MM
          </span>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Membro desde {monthYear(p.created_at)}
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Biografia
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {p.bio?.trim() ? p.bio : "Este membro ainda não escreveu uma biografia."}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat icon={<Newspaper className="h-4 w-4" />} label="Publicações" value={q.data?.postCount ?? 0} />
        <Stat icon={<MessageSquare className="h-4 w-4" />} label="Comentários" value={q.data?.commentCount ?? 0} />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4 text-center">
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
