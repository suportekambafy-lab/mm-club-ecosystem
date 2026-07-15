import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/mm/verified-badge";
import { useAdminIds } from "@/hooks/use-admin-ids";

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
  author: Profile | null;
  category: Category | null;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
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

function usePosts(categoryId: string | null, userId: string | null, enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["community", "posts", categoryId ?? "all", userId ?? "anon"],
    enabled,
    queryFn: async (): Promise<Post[]> => {
      let q = supabase
        .from("community_posts")
        .select(
          `id, author_id, category_id, content, image_url, created_at, edited_at,
           author:profiles!community_posts_author_id_fkey (id, display_name, avatar_url, bio),
           category:community_categories (id, slug, name, color, sort_order),
           likes:community_likes (user_id),
           comments:community_comments (id),
           reactions:community_reactions (emoji, user_id)`,
        )
        .order("created_at", { ascending: false })
        .limit(50);
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
        author: Array.isArray(p.author) ? p.author[0] : p.author,
        category: Array.isArray(p.category) ? p.category[0] : p.category,
        like_count: p.likes?.length ?? 0,
        liked_by_me: userId ? p.likes?.some((l: any) => l.user_id === userId) : false,
        comment_count: p.comments?.length ?? 0,
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

/* ---------------- Top members ---------------- */
function useTopMembers(enabled: boolean) {
  return useQuery({
    queryKey: ["community", "top-members"],
    enabled,
    queryFn: async (): Promise<Profile[]> => {
      // Últimos autores ativos (baseado em posts recentes)
      const { data, error } = await supabase
        .from("community_posts")
        .select(
          "author_id, created_at, author:profiles!community_posts_author_id_fkey (id, display_name, avatar_url, bio)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const seen = new Set<string>();
      const list: Profile[] = [];
      for (const row of data ?? []) {
        const a: any = Array.isArray((row as any).author) ? (row as any).author[0] : (row as any).author;
        if (!a || seen.has(a.id)) continue;
        seen.add(a.id);
        list.push(a as Profile);
        if (list.length >= 12) break;
      }
      return list;
    },
  });
}

/* ---------------- Page ---------------- */
function CommunityPage() {
  const user = useUser();
  const [tab, setTab] = useState<"feed" | "chat">("feed");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const catQ = useCategories(user != null);
  const postsQ = usePosts(activeCategory, user?.id ?? null, user != null && tab === "feed");
  const membersQ = useTopMembers(user != null);

  const totalPosts = postsQ.data?.length ?? 0;
  const activeCategoryName =
    activeCategory && catQ.data
      ? catQ.data.find((c) => c.id === activeCategory)?.name ?? null
      : null;

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-display">
            Comunidade
          </p>
          <h1 className="font-display text-3xl text-foreground md:text-4xl">
            {activeCategoryName ? activeCategoryName : "O que se passa no clube?"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Partilhe vitórias, tire dúvidas e converse ao vivo com outros membros.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-surface-1 p-1">
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
            label="Chat ao vivo"
          />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
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

          <SidebarCard title="Membros ativos" subtitle={`${membersQ.data?.length ?? 0} online`}>
            <div className="grid grid-cols-5 gap-2">
              {membersQ.data?.slice(0, 15).map((m) => (
                <div
                  key={m.id}
                  className="group relative"
                  title={m.display_name}
                >
                  <Avatar name={m.display_name} url={m.avatar_url} size={36} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-surface-1 bg-emerald-500" />
                </div>
              ))}
              {membersQ.isLoading && (
                <div className="col-span-5 flex justify-center py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {membersQ.data && membersQ.data.length === 0 && (
                <p className="col-span-5 text-center text-xs text-muted-foreground">
                  Ainda ninguém publicou.
                </p>
              )}
            </div>
          </SidebarCard>
        </aside>

        {/* CENTER — feed ou chat */}
        <section className="min-w-0 space-y-5">
          {tab === "feed" ? (
            <>
              {/* Category pills — mobile only */}
              <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
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

              {/* Composer or sign-in gate */}
              {user === undefined ? (
                <div className="h-24 rounded-2xl border border-border bg-surface-1" />
              ) : user === null ? (
                <SignInGate />
              ) : (
                <Composer
                  user={user}
                  categories={catQ.data ?? []}
                  defaultCategoryId={activeCategory}
                />
              )}

              {/* Feed */}
              <div className="space-y-4">
                {postsQ.isLoading && (
                  <div className="flex justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                {postsQ.isError && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    Não foi possível carregar o feed.
                  </div>
                )}
                {postsQ.data?.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      Ainda não há publicações
                      {activeCategoryName ? ` em ${activeCategoryName}` : ""}.
                    </p>
                    {user && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Seja o primeiro a publicar.
                      </p>
                    )}
                  </div>
                )}
                {postsQ.data?.map((p) => (
                  <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
                ))}
              </div>
            </>
          ) : user === undefined ? (
            <div className="h-96 rounded-2xl border border-border bg-surface-1" />
          ) : user === null ? (
            <SignInGate />
          ) : (
            <ChatRoom user={user} />
          )}
        </section>

        {/* RIGHT SIDEBAR — perfil + últimas atualizações + atalhos */}
        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin]">
          <ProfileCompletionCard user={user} />
          <LatestUpdatesCard posts={postsQ.data ?? []} />
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

function ProfileCompletionCard({ user }: { user: User | null | undefined }) {
  const q = useQuery({
    queryKey: ["community", "my-profile", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  if (!user) return null;

  const items = [
    { label: "Nome", done: !!q.data?.display_name },
    { label: "Avatar", done: !!q.data?.avatar_url },
    { label: "Bio", done: !!q.data?.bio },
  ];
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <SidebarCard title="Complete o perfil">
      <div className="mb-3 flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-surface-2"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="text-primary transition-all"
              strokeDasharray={`${(pct / 100) * 94.25} 94.25`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-foreground">{pct}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {done}/{items.length} completo
          </p>
          <Link
            to="/perfil"
            className="text-xs text-primary hover:underline"
          >
            Editar perfil →
          </Link>
        </div>
      </div>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full",
                i.done ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted-foreground",
              )}
            >
              {i.done ? "✓" : "○"}
            </span>
            <span className={i.done ? "text-foreground" : "text-muted-foreground"}>
              {i.label}
            </span>
          </li>
        ))}
      </ul>
    </SidebarCard>
  );
}

function LatestUpdatesCard({ posts }: { posts: Post[] }) {
  const latest = posts.slice(0, 5);
  const adminIds = useAdminIds();
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
                  <span className="truncate">{p.author?.display_name ?? "Membro"}</span>
                  {adminIds.has(p.author_id) && <VerifiedBadge size={12} />}
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
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [categoryId, setCategoryId] = useState<string>(
    defaultCategoryId ?? categories.find((c) => c.slug === "geral")?.id ?? "",
  );
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultCategoryId) setCategoryId(defaultCategoryId);
  }, [defaultCategoryId]);

  useEffect(() => {
    if (!categoryId && categories.length) {
      setCategoryId(categories.find((c) => c.slug === "geral")?.id ?? categories[0].id);
    }
  }, [categories, categoryId]);

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Membro";

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ficheiro demasiado grande (máx. 10 MB).");
      return;
    }
    setUploading(true);
    try {
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
      const { error } = await supabase.from("community_posts").insert({
        author_id: user.id,
        category_id: categoryId || null,
        content: content.trim(),
        image_url: imageUrl.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      setImageUrl("");
      if (taRef.current) taRef.current.style.height = "auto";
      qc.invalidateQueries({ queryKey: ["community", "posts"] });
      toast.success("Publicado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao publicar"),
  });

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <div className="flex gap-3">
        <Avatar name={displayName} url={null} size={40} />
        <div className="flex-1">
          <textarea
            ref={taRef}
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
            <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
              <img src={imageUrl} alt="Pré-visualização" className="max-h-72 w-full object-cover" />
              <button
                onClick={() => setImageUrl("")}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition hover:bg-background"
                aria-label="Remover imagem"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
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
  return useQuery({
    queryKey: ["avatar-signed", url],
    enabled: !!url,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      if (!url) return null;
      // Already a full URL
      if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) {
        return url;
      }
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(url, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  }).data ?? null;
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
function PostCard({ post, currentUserId }: { post: Post; currentUserId: string | null }) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const isOwner = currentUserId === post.author_id;
  const adminIds = useAdminIds();
  const authorIsAdmin = adminIds.has(post.author_id);

  useEffect(() => {
    setLiked(post.liked_by_me);
    setLikeCount(post.like_count);
    setCommentCount(post.comment_count);
    setEditContent(post.content);
  }, [post.liked_by_me, post.like_count, post.comment_count, post.content]);

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
    <article className="rounded-2xl border border-border bg-surface-1 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={authorName} url={post.author?.avatar_url ?? null} />
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <span>{authorName}</span>
              {authorIsAdmin && <VerifiedBadge size={14} />}
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
              onClick={() => {
                if (confirm("Apagar este post?")) del.mutate();
              }}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-destructive"
              aria-label="Apagar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
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
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {post.content}
        </div>
      )}

      {post.image_url && !editing && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <img src={post.image_url} alt="" className="max-h-[500px] w-full object-cover" />
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
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
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
      const { error } = await supabase.from("community_comments").insert({
        post_id: postId,
        author_id: currentUserId,
        content: text.trim(),
      });
      if (error) throw error;
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
      {q.isLoading && (
        <div className="flex justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
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
              <span>{comment.author?.display_name ?? "Membro"}</span>
              {authorIsAdmin && <VerifiedBadge size={12} />}
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
      const { error } = await supabase.from("community_chat_messages").insert({
        author_id: user.id,
        content: trimmed,
      });
      if (error) throw error;
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
        {q.isLoading && (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
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
                    <span>{mine ? "Você" : name}</span>
                    {adminIds.has(m.author_id) && <VerifiedBadge size={11} />}
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
