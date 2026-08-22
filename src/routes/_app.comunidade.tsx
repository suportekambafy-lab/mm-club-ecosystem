import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { notifyCommunityPostByEmail } from "@/lib/community-email.functions";
import { runModeration } from "@/lib/moderation-client";
import { cachedAvatarUrl, resolveAvatarUrl } from "@/lib/avatar-cache";
import { assertUploadAllowed } from "@/lib/security/uploads";
import { SanctionBanner, useActiveSanction } from "@/components/mm/sanction-banner";
import { LinkPreview, extractFirstUrl } from "@/components/mm/link-preview";
import {
  Heart,
  MessageCircle,
  ImagePlus,
  Send,
  Loader2,
  X,
  Trash2,
  Newspaper,
  MessagesSquare,
  Maximize2,
  Minimize2,
  SmilePlus,
  Pencil,
  Paperclip,
  Check,
  Pin,
  PinOff,
  Eye,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/mm/verified-badge";
import { RankBadge } from "@/components/mm/rank-badge";
import { CommunityLeaderboard } from "@/components/mm/community-leaderboard";
import { useCommunityRanks } from "@/hooks/use-community-ranks";
import { useAdminIds } from "@/hooks/use-admin-ids";
import { useConfirm } from "@/components/mm/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunitySpotlight } from "@/components/mm/community-spotlight";
import { useCommunityPresence } from "@/lib/community-presence";
import {
  MemberProfileProvider,
  MemberNameButton,
  useMemberProfile,
} from "@/components/mm/member-profile";


export const Route = createFileRoute("/_app/comunidade")({
  head: () => ({
    meta: [
      { title: "Comunidade — MM Club" },
      {
        name: "description",
        content:
          "Feed da comunidade Marca Milionária: partilhe vitórias, dúvidas e oportunidades.",
      },
    ],
  }),
  component: CommunityPage,
});

type Category = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  sort_order: number;
};
type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
};
type Reaction = { emoji: string; user_id: string };
type Post = {
  id: string;
  author_id: string;
  category_id: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  edited_at: string | null;
  pinned_at: string | null;
  author: Profile | null;
  category: Category | null;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  views_count: number;
  reactions: Reaction[];
};
type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  author: Profile | null;
  reactions: Reaction[];
};

const EMOJIS = ["👍", "❤️", "🔥", "🎉", "🙌", "💡", "😮", "😂"];

/* ---------------- Auth hook ---------------- */
function useUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        const nextUser = s?.user ?? null;
        if (!nextUser) return;
        setUser((current) => {
          if (current?.id === nextUser.id && event !== "USER_UPDATED") return current;
          return nextUser;
        });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return user;
}

/* ---------------- Time formatting ---------------- */
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ---------------- Data ---------------- */
function useCategories(enabled: boolean) {
  return useQuery({
    queryKey: ["community", "categories"],
    enabled,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("community_categories")
        .select("id, slug, name, color, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

const POSTS_PAGE_SIZE = 15;

function usePosts(categoryId: string | null, userId: string | null, enabled: boolean) {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["community", "posts", categoryId ?? "all", userId ?? "anon"],
    enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage: Post[], allPages) =>
      lastPage.length < POSTS_PAGE_SIZE ? undefined : allPages.length,
    queryFn: async ({ pageParam }): Promise<Post[]> => {
      const from = (pageParam as number) * POSTS_PAGE_SIZE;
      let q = supabase
        .from("community_posts")
        .select(
          `id, author_id, category_id, content, image_url, created_at, edited_at, pinned_at, views_count,
           author:profiles!community_posts_author_id_fkey (id, display_name, avatar_url, bio),
           category:community_categories (id, slug, name, color, sort_order),
           likes:community_likes (user_id),
           comments:community_comments (id),
           reactions:community_reactions (emoji, user_id)`,
        )
        .order("pinned_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, from + POSTS_PAGE_SIZE - 1);
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        author_id: p.author_id,
        category_id: p.category_id,
        content: p.content,
        image_url: p.image_url,
        created_at: p.created_at,
        edited_at: p.edited_at ?? null,
        pinned_at: p.pinned_at ?? null,
        author: Array.isArray(p.author) ? p.author[0] : p.author,
        category: Array.isArray(p.category) ? p.category[0] : p.category,
        like_count: p.likes?.length ?? 0,
        liked_by_me: userId ? p.likes?.some((l: any) => l.user_id === userId) : false,
        comment_count: p.comments?.length ?? 0,
        views_count: p.views_count ?? 0,
        reactions: (p.reactions ?? []) as Reaction[],
      }));
    },
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("community-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["community", "posts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_likes" }, () => {
        qc.invalidateQueries({ queryKey: ["community", "posts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reactions" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["community", "posts"] });
        const postId = (payload.new as any)?.post_id ?? (payload.old as any)?.post_id;
        if (postId) qc.invalidateQueries({ queryKey: ["community", "comments", postId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["community", "posts"] });
        const postId = (payload.new as any)?.post_id ?? (payload.old as any)?.post_id;
        if (postId) qc.invalidateQueries({ queryKey: ["community", "comments", postId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);

  return query;
}

/* ---------------- My profile (for presence + composer) ---------------- */
function useMyProfile(userId: string | null) {
  return useQuery({
    queryKey: ["community", "me-profile", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", userId!)
        .maybeSingle();
      return data ?? null;
    },
  });
}

/* ---------------- Page ---------------- */
function CommunityPage() {
  return (
    <MemberProfileProvider>
      <CommunityPageInner />
    </MemberProfileProvider>
  );
}

function CommunityPageInner() {
  const user = useUser();
  const { open: openMember } = useMemberProfile();
  const [tab, setTab] = useState<"feed" | "chat">("feed");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const catQ = useCategories(user != null);
  const postsQ = usePosts(activeCategory, user?.id ?? null, user != null && tab === "feed");
  const posts = useMemo(
    () => (postsQ.data?.pages ?? []).flat() as Post[],
    [postsQ.data],
  );

  // Sentinela: carrega a próxima página antes de o membro chegar ao fim.
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !postsQ.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !postsQ.isFetchingNextPage) {
          void postsQ.fetchNextPage();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [postsQ.hasNextPage, postsQ.isFetchingNextPage, postsQ.fetchNextPage, posts.length]);
  const myProfileQ = useMyProfile(user?.id ?? null);
  const sanctionQ = useActiveSanction();
  const sanction = sanctionQ.data ?? null;
  const onlineMembers = useCommunityPresence(
    user
      ? {
          id: user.id,
          display_name:
            myProfileQ.data?.display_name ??
            (user.user_metadata?.display_name as string | undefined) ??
            user.email?.split("@")[0] ??
            "Membro",
          avatar_url:
            myProfileQ.data?.avatar_url ??
            ((user.user_metadata?.avatar_url as string | undefined) ?? null),
        }
      : null,
  );

  const totalPosts = posts.length;
  const todayCount = posts.filter(
    (p) => Date.now() - new Date(p.created_at).getTime() < 86_400_000,
  ).length;

  const activeCategoryName =
    activeCategory && catQ.data
      ? catQ.data.find((c) => c.id === activeCategory)?.name ?? null
      : null;

  // Header oculta ao fazer scroll para baixo, reaparece ao subir
  const [headerHidden, setHeaderHidden] = useState(false);
  useEffect(() => {
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      if (y < 40) {
        setHeaderHidden(false);
      } else if (dy > 6) {
        setHeaderHidden(true);
      } else if (dy < -6) {
        setHeaderHidden(false);
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1600px] 2xl:max-w-[1760px]">
      {/* Header — compacto, content-first */}
      <header
        className={cn(
          "sticky top-16 z-20 -mx-3 mb-3 flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur-xl transition-all duration-300 ease-out sm:-mx-4 sm:px-4 md:-mx-8 md:px-8 md:py-3",
          headerHidden && "pointer-events-none -translate-y-4 opacity-0",
        )}
      >
        <h1 className="min-w-0 truncate font-display text-lg text-foreground md:text-2xl">
          {activeCategoryName ?? "Comunidade"}
        </h1>
        <div className="inline-flex shrink-0 rounded-full border border-border bg-surface-1 p-0.5">
          <TabButton
            active={tab === "feed"}
            onClick={() => setTab("feed")}
            icon={<Newspaper className="h-3.5 w-3.5" />}
            label="Feed"
          />
          <TabButton
            active={tab === "chat"}
            onClick={() => setTab("chat")}
            icon={<MessagesSquare className="h-3.5 w-3.5" />}
            label="Chat"
          />
        </div>
      </header>



      <div className="grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-10 2xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* LEFT SIDEBAR — categorias + membros ativos */}
        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin]">
          <SidebarCard title="Categorias">
            <nav className="space-y-0.5">
              <CategoryNavItem
                active={activeCategory === null}
                onClick={() => setActiveCategory(null)}
                label="Todas"
                color={null}
                count={totalPosts}
              />
              {catQ.data?.map((c) => (
                <CategoryNavItem
                  key={c.id}
                  active={activeCategory === c.id}
                  onClick={() => setActiveCategory(c.id)}
                  label={c.name}
                  color={c.color}
                />
              ))}
            </nav>
          </SidebarCard>

          <SidebarCard title="Membros online" subtitle={`${onlineMembers.length} online`}>
            <div className="grid grid-cols-5 gap-2">
              {onlineMembers.slice(0, 15).map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => openMember(m.id)}
                  className="group relative transition hover:opacity-80"
                  title={m.display_name ?? "Membro"}
                >
                  <Avatar name={m.display_name ?? "Membro"} url={m.avatar_url} size={36} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-surface-1 bg-emerald-500" />
                </button>
              ))}
              {onlineMembers.length === 0 && (
                <p className="col-span-5 text-center text-xs text-muted-foreground">
                  Ninguém online neste momento.
                </p>
              )}
            </div>
          </SidebarCard>
        </aside>

        {/* CENTER — feed ou chat */}
        <section className="min-w-0 space-y-3">
          {tab === "feed" ? (
            <>
              {/* Destaque contextual: live a decorrer ou próximo evento */}
              {user != null && <CommunitySpotlight enabled={user != null} />}

              {/* Filtros horizontais — fixos ao fazer scroll (mobile) */}
              <div className="sticky top-[3.9rem] z-10 -mx-3 flex gap-2 overflow-x-auto bg-background/90 px-3 py-2 backdrop-blur-xl sm:-mx-4 sm:px-4 lg:static lg:hidden lg:bg-transparent lg:p-0">
                <CategoryPill
                  active={activeCategory === null}
                  onClick={() => setActiveCategory(null)}
                  label="Todas"
                />
                {catQ.data?.map((c) => (
                  <CategoryPill
                    key={c.id}
                    active={activeCategory === c.id}
                    color={c.color ?? undefined}
                    onClick={() => setActiveCategory(c.id)}
                    label={c.name}
                  />
                ))}
              </div>

              {/* Sinal de atividade */}
              {todayCount > 0 && (
                <p className="flex items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {todayCount === 1
                    ? "1 nova publicação nas últimas 24 h"
                    : `${todayCount} novas publicações nas últimas 24 h`}
                </p>
              )}

              {/* Composer or sign-in gate */}
              {user === undefined ? (
                <div className="h-14 rounded-2xl border border-border bg-surface-1" />
              ) : user === null ? (
                <SignInGate />
              ) : sanction ? (
                <SanctionBanner sanction={sanction} />
              ) : (
                <Composer
                  user={user}
                  categories={catQ.data ?? []}
                  defaultCategoryId={activeCategory}
                />
              )}


              {/* Feed */}
              <div className="space-y-4">
                {postsQ.isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border bg-surface-1 p-5"
                    >
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-11/12" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                      <Skeleton className="mt-4 h-48 w-full rounded-xl" />
                    </div>
                  ))}
                {postsQ.isError && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    Não foi possível carregar o feed.
                  </div>
                )}
                {!postsQ.isLoading && posts.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      Ainda não há publicações
                      {activeCategoryName ? ` em ${activeCategoryName}` : ""}.
                    </p>
                    {user && (
                      <>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ainda não há publicações — cria a primeira.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.querySelector<HTMLTextAreaElement>(
                              "[data-community-composer-textarea]",
                            );
                            el?.scrollIntoView({ behavior: "smooth", block: "center" });
                            el?.focus();
                          }}
                          className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                        >
                          Criar a primeira publicação
                        </button>
                      </>
                    )}
                  </div>
                )}
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
                ))}
                <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
                {!postsQ.isLoading && postsQ.hasNextPage && !postsQ.isFetchingNextPage && (
                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      onClick={() => void postsQ.fetchNextPage()}
                      className="rounded-full border border-border bg-surface-1 px-4 py-2 text-xs font-medium text-foreground transition hover:bg-surface-2"
                    >
                      Carregar mais
                    </button>
                  </div>
                )}
                {postsQ.isFetchingNextPage && (
                  <div className="rounded-2xl border border-border bg-surface-1 p-5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : user === undefined ? (
            <div className="h-96 rounded-2xl border border-border bg-surface-1" />
          ) : user === null ? (
            <SignInGate />
          ) : (
            <ChatRoom user={user} />
          )}

          {/* Cards que só aparecem na sidebar direita a partir de 2xl — em telas menores ficam por baixo do feed */}
          {tab === "feed" && (
            <div className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-3 2xl:hidden">
              <CommunityLeaderboard />
              <LatestUpdatesCard posts={posts} />
              <QuickLinksCard />
            </div>
          )}
        </section>

        {/* RIGHT SIDEBAR — ranking + últimas atualizações + atalhos */}
        <aside className="hidden space-y-4 2xl:sticky 2xl:top-24 2xl:block 2xl:max-h-[calc(100vh-7rem)] 2xl:overflow-y-auto 2xl:pr-1 [scrollbar-width:thin]">
          <CommunityLeaderboard />
          <LatestUpdatesCard posts={posts} />
          <QuickLinksCard />
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Sidebar primitives ---------------- */
function SidebarCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </h3>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function CategoryNavItem({
  active,
  onClick,
  label,
  color,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string | null;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
        active
          ? "bg-primary/12 text-foreground"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          active && !color && "bg-primary",
        )}
        style={color ? { background: color } : undefined}
      />
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[10px] text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function LatestUpdatesCard({ posts }: { posts: Post[] }) {
  const latest = posts.slice(0, 5);
  const adminIds = useAdminIds();
  const ranks = useCommunityRanks();
  return (
    <SidebarCard title="Últimas atualizações">
      {latest.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem atividade recente.</p>
      ) : (
        <ul className="space-y-3">
          {latest.map((p) => (
            <li key={p.id} className="flex gap-2.5">
              <Avatar
                name={p.author?.display_name ?? "?"}
                url={p.author?.avatar_url ?? null}
                size={28}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground flex items-center gap-1">
                  <MemberNameButton userId={p.author_id}>{p.author?.display_name ?? "Membro"}</MemberNameButton>
                  {adminIds.has(p.author_id) && <VerifiedBadge size={12} />}
                  <RankBadge rank={ranks.get(p.author_id)} userId={p.author_id} name={p.author?.display_name ?? null} maxRank={3} compact />
                </p>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  {p.content}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {timeAgo(p.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SidebarCard>
  );
}

function QuickLinksCard() {
  const links = [
    { to: "/lives" as const, label: "Próximas lives" },
    { to: "/eventos" as const, label: "Eventos MM" },
    { to: "/academia" as const, label: "Academia" },
    { to: "/ferramentas" as const, label: "Ferramentas" },
  ];
  return (
    <SidebarCard title="Atalhos">
      <ul className="space-y-0.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              <span>{l.label}</span>
              <span>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </SidebarCard>
  );
}



function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ---------------- Category pill ---------------- */
function CategoryPill({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition",
        active
          ? "border-primary/40 bg-primary/15 text-foreground"
          : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
      )}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}

/* ---------------- Sign-in gate ---------------- */
function SignInGate() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-1 p-6 text-center">
      <p className="text-sm text-foreground">
        Entre para publicar, comentar e curtir.
      </p>
      <Link
        to="/auth"
        search={{ redirect: "/comunidade" }}
        className="rounded-full bg-primary px-5 py-2 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft"
      >
        Entrar ou criar conta
      </Link>
    </div>
  );
}

/* ---------------- Composer ---------------- */
function Composer({
  user,
  categories,
  defaultCategoryId,
}: {
  user: User;
  categories: Category[];
  defaultCategoryId: string | null;
}) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [linkDismissed, setLinkDismissed] = useState<string | null>(null);
  const detectedLink = useMemo(() => extractFirstUrl(content), [content]);
  const composerLink = detectedLink && detectedLink !== linkDismissed ? detectedLink : null;
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [categoryId, setCategoryId] = useState<string>(
    defaultCategoryId ?? categories.find((c) => c.slug === "geral")?.id ?? "",
  );
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);


  useEffect(() => {
    if (defaultCategoryId) setCategoryId(defaultCategoryId);
  }, [defaultCategoryId]);

  useEffect(() => {
    if (!categoryId && categories.length) {
      setCategoryId(categories.find((c) => c.slug === "geral")?.id ?? categories[0].id);
    }
  }, [categories, categoryId]);

  const meQ = useQuery({
    queryKey: ["community", "me-profile", user.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const displayName =
    meQ.data?.display_name ??
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Membro";
  const myAvatar =
    meQ.data?.avatar_url ?? ((user.user_metadata?.avatar_url as string | undefined) ?? null);


  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ficheiro demasiado grande (máx. 10 MB).");
      return;
    }
    setUploading(true);
    try {
      assertUploadAllowed(file, "media");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("community-media")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { data, error } = await supabase.storage
        .from("community-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (error || !data) throw error ?? new Error("Falha ao gerar URL");
      setImageUrl(data.signedUrl);
      toast.success("Ficheiro carregado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: row, error } = await supabase
        .from("community_posts")
        .insert({
          author_id: user.id,
          category_id: categoryId || null,
          content: content.trim(),
          image_url: imageUrl.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Aviso por email aos membros que não desativaram nas permissões.
      if (row?.id) {
        runModeration({ kind: "community_post", id: row.id }, () =>
          qc.invalidateQueries({ queryKey: ["community", "posts"] }),
        );
        notifyCommunityPostByEmail({ data: { postId: row.id } }).catch((e) =>
          console.error("[community] email announce failed", e),
        );
      }
    },
    onSuccess: () => {
      setContent("");
      setLinkDismissed(null);
      setImageUrl("");
      if (taRef.current) taRef.current.style.height = "auto";
      setExpanded(false);
      qc.invalidateQueries({ queryKey: ["community", "posts"] });
      toast.success("Publicado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao publicar"),
  });

  if (!expanded) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-1 p-2.5">
        <Avatar name={displayName} url={myAvatar} size={34} />
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            requestAnimationFrame(() => taRef.current?.focus());
          }}
          className="min-w-0 flex-1 truncate rounded-full bg-surface-2 px-4 py-2 text-left text-sm text-muted-foreground transition hover:text-foreground"
        >
          No que estás a pensar?
        </button>
        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <button
            type="button"
            aria-label="Adicionar imagem"
            onClick={() => {
              setExpanded(true);
              requestAnimationFrame(() => fileRef.current?.click());
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-surface-2 hover:text-foreground"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Anexar ficheiro"
            onClick={() => {
              setExpanded(true);
              requestAnimationFrame(() => fileRef.current?.click());
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-surface-2 hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Escrever publicação"
            onClick={() => {
              setExpanded(true);
              requestAnimationFrame(() => taRef.current?.focus());
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-surface-2 hover:text-foreground"
          >
            <SmilePlus className="h-4 w-4" />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-surface-1 p-4">
      <div className="flex gap-3">
        <Avatar name={displayName} url={myAvatar} size={40} />

        <div className="flex-1">
          <textarea
            ref={taRef}
            data-community-composer-textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="Partilhe uma vitória, dúvida ou resultado com o clube…"
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {imageUrl && (
            <div className="relative mt-2 flex justify-center overflow-hidden rounded-xl border border-border bg-surface-2">
              <img loading="lazy" decoding="async" src={imageUrl} alt="Pré-visualização" className="max-h-72 w-auto max-w-full object-contain sm:max-w-[520px]" />
              <button
                onClick={() => setImageUrl("")}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition hover:bg-background"
                aria-label="Remover imagem"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {composerLink && !imageUrl && (
            <LinkPreview url={composerLink} onRemove={() => setLinkDismissed(composerLink)} />
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
            {uploading ? "A carregar…" : "Anexar"}
          </button>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={!content.trim() || create.isPending || uploading}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-40"
        >
          {create.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Publicar
        </button>
      </div>
    </div>
  );
}

/* ---------------- Reaction bar ---------------- */
function ReactionBar({
  target,
  targetId,
  reactions,
  currentUserId,
}: {
  target: "post" | "comment";
  targetId: string;
  reactions: Reaction[];
  currentUserId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();

  // Group by emoji
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const g = grouped.get(r.emoji) ?? { count: 0, mine: false };
    g.count += 1;
    if (r.user_id === currentUserId) g.mine = true;
    grouped.set(r.emoji, g);
  }

  const toggle = async (emoji: string) => {
    if (!currentUserId) {
      toast.error("Entre para reagir.");
      return;
    }
    setBusy(emoji);
    const existing = reactions.find(
      (r) => r.emoji === emoji && r.user_id === currentUserId,
    );
    try {
      if (existing) {
        const q: any = supabase
          .from("community_reactions")
          .delete()
          .eq("user_id", currentUserId)
          .eq("emoji", emoji);
        const { error } = await (target === "post"
          ? q.eq("post_id", targetId)
          : q.eq("comment_id", targetId));
        if (error) throw error;
      } else {
        const row: any = { user_id: currentUserId, emoji };
        if (target === "post") row.post_id = targetId;
        else row.comment_id = targetId;
        const { error } = await (supabase.from("community_reactions") as any).insert(row);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["community", "posts"] });
      qc.invalidateQueries({ queryKey: ["community", "comments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...grouped.entries()].map(([emoji, g]) => (
        <button
          key={emoji}
          onClick={() => toggle(emoji)}
          disabled={busy === emoji}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
            g.mine
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
          )}
        >
          <span>{emoji}</span>
          <span className="tabular-nums">{g.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground transition hover:text-foreground"
          aria-label="Adicionar reação"
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-full border border-border bg-surface-1 p-1.5 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => toggle(e)}
                  disabled={busy === e}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-base transition hover:scale-125 hover:bg-surface-2"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Avatar ---------------- */
function useAvatarSrc(url: string | null) {
  const data = useQuery({
    queryKey: ["avatar-signed", url],
    enabled: !!url,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // URL já em cache → a foto aparece sem espera.
    initialData: () => cachedAvatarUrl(url) ?? undefined,
    queryFn: () => resolveAvatarUrl(url),
  }).data;
  return data ?? cachedAvatarUrl(url);
}


function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  const src = useAvatarSrc(url);
  if (src) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
    >
      {initials(name || "?")}
    </div>
  );
}

/* ---------------- Post card ---------------- */
/** Renderiza texto com URLs clicáveis. */
function PostText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>()"']+)/gi);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//i.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline-offset-2 hover:underline"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function PostCard({ post, currentUserId }: { post: Post; currentUserId: string | null }) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [viewCount, setViewCount] = useState(post.views_count);
  const cardRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const postLinkUrl = useMemo(() => extractFirstUrl(post.content), [post.content]);
  const isOwner = currentUserId === post.author_id;
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  const adminIds = useAdminIds();
  const ranks = useCommunityRanks();
  const authorIsAdmin = adminIds.has(post.author_id);
  const viewerIsAdmin = currentUserId ? adminIds.has(currentUserId) : false;
  const isPinned = Boolean(post.pinned_at);

  const pin = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("community_posts") as any)
        .update(
          isPinned
            ? { pinned_at: null, pinned_by: null }
            : { pinned_at: new Date().toISOString(), pinned_by: currentUserId },
        )
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", "posts"] });
      toast.success(isPinned ? "Publicação desafixada." : "Publicação afixada no topo.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  useEffect(() => {
    setLiked(post.liked_by_me);
    setLikeCount(post.like_count);
    setCommentCount(post.comment_count);
    setViewCount(post.views_count);
    setEditContent(post.content);
  }, [post.liked_by_me, post.like_count, post.comment_count, post.views_count, post.content]);

  // Conta uma visualização quando a publicação fica visível (uma vez por sessão).
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const storageKey = `mm-post-view-${post.id}`;
    if (sessionStorage.getItem(storageKey)) return;
    let done = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || done) continue;
          done = true;
          observer.disconnect();
          sessionStorage.setItem(storageKey, "1");
          setViewCount((c) => c + 1);
          void (supabase as any).rpc("community_post_increment_view", { _post_id: post.id });
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id]);

  const toggleLike = async () => {
    if (!currentUserId) {
      toast.error("Entre para curtir.");
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    const { error } = next
      ? await supabase
          .from("community_likes")
          .insert({ post_id: post.id, user_id: currentUserId })
      : await supabase
          .from("community_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
    if (error) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      toast.error(error.message);
    }
  };

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("community_posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", "posts"] });
      toast.success("Post removido.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const update = useMutation({
    mutationFn: async () => {
      const trimmed = editContent.trim();
      if (!trimmed) throw new Error("Conteúdo vazio");
      const { error } = await (supabase.from("community_posts") as any)
        .update({ content: trimmed, edited_at: new Date().toISOString() })
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["community", "posts"] });
      toast.success("Post atualizado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const authorName = post.author?.display_name ?? "Membro";

  return (
    <article
      ref={cardRef}
      className={cn(
        "rounded-2xl border bg-surface-1 p-5",
        isPinned ? "border-primary/50 ring-1 ring-primary/20" : "border-border",
      )}
    >
      {isPinned && (
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <Pin className="h-3.5 w-3.5" />
          Afixado
        </div>
      )}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={authorName} url={post.author?.avatar_url ?? null} />
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <MemberNameButton userId={post.author_id}>{authorName}</MemberNameButton>
              {authorIsAdmin && <VerifiedBadge size={14} />}
              <RankBadge rank={ranks.get(post.author_id)} userId={post.author_id} name={authorName} compact />
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{timeAgo(post.created_at)}</span>
              {post.edited_at && <span className="italic">· editado</span>}
              {post.category && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: post.category.color ?? "var(--primary)" }}
                    />
                    {post.category.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
        {viewerIsAdmin && !editing && (
          <button
            onClick={() => pin.mutate()}
            disabled={pin.isPending}
            title={isPinned ? "Desafixar publicação" : "Afixar publicação"}
            aria-label={isPinned ? "Desafixar publicação" : "Afixar publicação"}
            className={cn(
              "rounded-full p-2 transition hover:bg-surface-2",
              isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        )}
        {isOwner && !editing && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={async () => {
                const ok = await askConfirm({
                  title: "Eliminar esta publicação?",
                  description: "A publicação e os respetivos comentários desaparecem da comunidade. Esta ação não pode ser desfeita.",
                  confirmLabel: "Eliminar",
                  surface: "comunidade",
                  action: "delete_post",
                });
                if (ok) del.mutate();
              }}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-destructive"
              aria-label="Eliminar publicação"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {confirmDialog}
          </div>
        )}
        </div>
      </header>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setEditContent(post.content);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={() => update.mutate()}
              disabled={update.isPending || !editContent.trim()}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-gold-soft disabled:opacity-40"
            >
              {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            <PostText text={post.content} />
          </div>
          {postLinkUrl && <LinkPreview url={postLinkUrl} />}
        </>
      )}

      {post.image_url && !editing && (
        <div className="mt-3 flex justify-center overflow-hidden rounded-xl border border-border bg-surface-2">
          <img
            loading="lazy"
            decoding="async"
            src={post.image_url}
            alt=""
            className="max-h-[560px] w-auto max-w-full object-contain sm:max-w-[560px]"
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <ReactionBar
          target="post"
          targetId={post.id}
          reactions={post.reactions}
          currentUserId={currentUserId}
        />
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{commentCount}</span>
        </button>
        <span
          className="ml-auto flex items-center gap-1.5 px-2 text-xs text-muted-foreground"
          title="Visualizações"
        >
          <Eye className="h-4 w-4" />
          <span>{viewCount.toLocaleString("pt-PT")}</span>
        </span>
      </div>

      {showComments && (
        <CommentsSection
          postId={post.id}
          currentUserId={currentUserId}
          onCountChange={setCommentCount}
        />
      )}
    </article>
  );
}

/* ---------------- Comments ---------------- */
function CommentsSection({
  postId,
  currentUserId,
  onCountChange,
}: {
  postId: string;
  currentUserId: string | null;
  onCountChange: (n: number) => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const q = useQuery({
    queryKey: ["community", "comments", postId],
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from("community_comments")
        .select(
          "id, post_id, author_id, content, created_at, edited_at, author:profiles!community_comments_author_id_fkey (id, display_name, avatar_url, bio), reactions:community_reactions (emoji, user_id)",
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const mapped = (data ?? []).map((c: any) => ({
        ...c,
        edited_at: c.edited_at ?? null,
        author: Array.isArray(c.author) ? c.author[0] : c.author,
        reactions: (c.reactions ?? []) as Reaction[],
      })) as Comment[];
      return mapped;
    },
  });

  useEffect(() => {
    if (q.data) onCountChange(q.data.length);
  }, [q.data, onCountChange]);

  const add = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Entre para comentar.");
      const { data: created, error } = await supabase
        .from("community_comments")
        .insert({
          post_id: postId,
          author_id: currentUserId,
          content: text.trim(),
        })
        .select("id")
        .single();
      if (error) throw error;
      if (created?.id) {
        runModeration({ kind: "community_comment", id: created.id }, () =>
          qc.invalidateQueries({ queryKey: ["community", "comments", postId] }),
        );
      }
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["community", "comments", postId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const removeComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community", "comments", postId] }),
  });

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {q.isLoading &&
        Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      {q.data?.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          postId={postId}
          currentUserId={currentUserId}
          onDelete={() => removeComment.mutate(c.id)}
        />
      ))}

      {currentUserId ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add.mutate();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um comentário…"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-xs text-foreground outline-none focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={!text.trim() || add.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-gold-soft disabled:opacity-40"
            aria-label="Enviar"
          >
            {add.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </form>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/auth" search={{ redirect: "/comunidade" }} className="text-primary hover:underline">
            Entre
          </Link>{" "}
          para comentar.
        </p>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  currentUserId,
  onDelete,
}: {
  comment: Comment;
  postId: string;
  currentUserId: string | null;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const isOwner = currentUserId === comment.author_id;
  const adminIds = useAdminIds();
  const ranks = useCommunityRanks();
  const authorIsAdmin = adminIds.has(comment.author_id);

  useEffect(() => {
    setEditContent(comment.content);
  }, [comment.content]);

  const update = useMutation({
    mutationFn: async () => {
      const trimmed = editContent.trim();
      if (!trimmed) throw new Error("Vazio");
      const { error } = await (supabase.from("community_comments") as any)
        .update({ content: trimmed, edited_at: new Date().toISOString() })
        .eq("id", comment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["community", "comments", postId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="flex gap-2.5">
      <Avatar
        name={comment.author?.display_name ?? "?"}
        url={comment.author?.avatar_url ?? null}
        size={32}
      />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-surface-2 px-3.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground flex items-center gap-1">
              <MemberNameButton userId={comment.author_id}>{comment.author?.display_name ?? "Membro"}</MemberNameButton>
              {authorIsAdmin && <VerifiedBadge size={12} />}
              <RankBadge rank={ranks.get(comment.author_id)} userId={comment.author_id} name={comment.author?.display_name ?? null} maxRank={3} compact />
            </p>
            {isOwner && !editing && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(true)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Editar comentário"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={onDelete}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Apagar comentário"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          {editing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary/50"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => update.mutate()}
                  disabled={update.isPending || !editContent.trim()}
                  className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-gold-soft disabled:opacity-40"
                >
                  {update.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{comment.content}</p>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 pl-3">
          <p className="text-[10px] text-muted-foreground">
            {timeAgo(comment.created_at)}
            {comment.edited_at && <span className="italic"> · editado</span>}
          </p>
          <ReactionBar
            target="comment"
            targetId={comment.id}
            reactions={comment.reactions}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  );
}


/* ---------------- Chat room ---------------- */
type ChatMessage = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: Profile | null;
};

function ChatRoom({ user }: { user: User }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const adminIds = useAdminIds();
  const ranks = useCommunityRanks();

  // Lock body scroll when expanded
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEsc);
    };
  }, [expanded]);


  const q = useQuery({
    queryKey: ["community", "chat"],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("community_chat_messages")
        .select(
          "id, author_id, content, created_at, author:profiles!community_chat_messages_author_id_fkey (id, display_name, avatar_url, bio)",
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        author: Array.isArray(m.author) ? m.author[0] : m.author,
      }));
    },
  });

  // Realtime — nova mensagem entra imediatamente
  useEffect(() => {
    const channel = supabase
      .channel("community-chat")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_chat_messages" },
        () => qc.invalidateQueries({ queryKey: ["community", "chat"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Auto-scroll para o fundo quando chegam mensagens
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [q.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (trimmed.length > 1000) throw new Error("Mensagem demasiado longa (máx. 1000).");
      const { data: created, error } = await supabase
        .from("community_chat_messages")
        .insert({
          author_id: user.id,
          content: trimmed,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (created?.id) runModeration({ kind: "community_chat", id: created.id });
    },
    onSuccess: () => setText(""),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
  });

  const removeMsg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_chat_messages").delete().eq("id", id);
      if (error) throw error;
    },
  });

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        />
      )}
      <div
        className={cn(
          "flex flex-col rounded-2xl border border-border bg-surface-1",
          expanded
            ? "fixed inset-3 z-50 md:inset-8 shadow-2xl"
            : "h-[calc(100vh-20rem)] min-h-[420px]",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <p className="text-sm font-medium text-foreground">Chat ao vivo</p>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              · {q.data?.length ?? 0} msg
            </span>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            aria-label={expanded ? "Reduzir chat" : "Expandir chat"}
            title={expanded ? "Reduzir (Esc)" : "Expandir"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>


      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {q.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn("flex gap-2.5", i % 2 === 1 && "flex-row-reverse")}
            >
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className={cn("flex max-w-[75%] flex-col gap-1", i % 2 === 1 && "items-end")}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-40 rounded-2xl" />
              </div>
            </div>
          ))}
        {q.data?.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-muted-foreground">
              Seja o primeiro a dizer olá 👋
            </p>
          </div>
        )}
        {q.data?.map((m) => {
          const mine = m.author_id === user.id;
          const name = m.author?.display_name ?? "Membro";
          return (
            <div key={m.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
              <Avatar name={name} url={m.author?.avatar_url ?? null} size={32} />
              <div className={cn("flex max-w-[75%] flex-col", mine && "items-end")}>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-[11px] font-medium text-foreground flex items-center gap-1">
                    {mine ? <span>Você</span> : <MemberNameButton userId={m.author_id}>{name}</MemberNameButton>}
                    {adminIds.has(m.author_id) && <VerifiedBadge size={11} />}
                    <RankBadge rank={ranks.get(m.author_id)} userId={m.author_id} name={name} maxRank={3} compact />
                  </p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</p>
                </div>
                <div
                  className={cn(
                    "group mt-1 flex items-center gap-1 rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-foreground",
                  )}
                >
                  <span className="whitespace-pre-wrap">{m.content}</span>
                  {mine && (
                    <button
                      onClick={() => removeMsg.mutate(m.id)}
                      className="opacity-0 transition group-hover:opacity-100"
                      aria-label="Apagar mensagem"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Escreva uma mensagem…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary/50"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-gold-soft disabled:opacity-40"
          aria-label="Enviar"
        >
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
      </div>
    </>
  );

}
