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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
type Post = {
  id: string;
  author_id: string;
  category_id: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  author: Profile | null;
  category: Category | null;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
};
type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: Profile | null;
};

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
  return useQuery({
    queryKey: ["community", "posts", categoryId ?? "all", userId ?? "anon"],
    enabled,
    queryFn: async (): Promise<Post[]> => {
      let q = supabase
        .from("community_posts")
        .select(
          `id, author_id, category_id, content, image_url, created_at,
           author:profiles!community_posts_author_id_fkey (id, display_name, avatar_url, bio),
           category:community_categories (id, slug, name, color, sort_order),
           likes:community_likes (user_id),
           comments:community_comments (id)`,
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
        author: Array.isArray(p.author) ? p.author[0] : p.author,
        category: Array.isArray(p.category) ? p.category[0] : p.category,
        like_count: p.likes?.length ?? 0,
        liked_by_me: userId ? p.likes?.some((l: any) => l.user_id === userId) : false,
        comment_count: p.comments?.length ?? 0,
      }));
    },
  });
}

/* ---------------- Page ---------------- */
function CommunityPage() {
  const user = useUser();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const catQ = useCategories(user != null);
  const postsQ = usePosts(activeCategory, user?.id ?? null, user != null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-display">
          Comunidade
        </p>
        <h1 className="font-display text-3xl text-foreground md:text-4xl">
          O que se passa no clube?
        </h1>
        <p className="text-sm text-muted-foreground">
          Partilhe vitórias, tire dúvidas e conecte-se com outros membros.
        </p>
      </header>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
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
              Ainda não há publicações{activeCategory ? " nesta categoria" : ""}.
            </p>
            {user && (
              <p className="mt-1 text-xs text-muted-foreground">Seja o primeiro a publicar.</p>
            )}
          </div>
        )}
        {postsQ.data?.map((p) => (
          <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
        ))}
      </div>
    </div>
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
  const [showImage, setShowImage] = useState(false);
  const [categoryId, setCategoryId] = useState<string>(
    defaultCategoryId ?? categories.find((c) => c.slug === "geral")?.id ?? "",
  );
  const taRef = useRef<HTMLTextAreaElement>(null);

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
      setShowImage(false);
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
            placeholder="Partilhe algo com o clube…"
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {showImage && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL da imagem (https://…)"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
              />
              <button
                onClick={() => {
                  setImageUrl("");
                  setShowImage(false);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {imageUrl && showImage && (
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Pré-visualização" className="max-h-72 w-full object-cover" />
            </div>
          )}
        </div>
      </div>

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
            onClick={() => setShowImage((s) => !s)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
              showImage
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Imagem
          </button>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={!content.trim() || create.isPending}
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

/* ---------------- Avatar ---------------- */
function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
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
  const isOwner = currentUserId === post.author_id;

  useEffect(() => {
    setLiked(post.liked_by_me);
    setLikeCount(post.like_count);
    setCommentCount(post.comment_count);
  }, [post.liked_by_me, post.like_count, post.comment_count]);

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

  const authorName = post.author?.display_name ?? "Membro";

  return (
    <article className="rounded-2xl border border-border bg-surface-1 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={authorName} url={post.author?.avatar_url ?? null} />
          <div>
            <p className="text-sm font-medium text-foreground">{authorName}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{timeAgo(post.created_at)}</span>
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
        {isOwner && (
          <button
            onClick={() => {
              if (confirm("Apagar este post?")) del.mutate();
            }}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-destructive"
            aria-label="Apagar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {post.content}
      </div>

      {post.image_url && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <img src={post.image_url} alt="" className="max-h-[500px] w-full object-cover" />
        </div>
      )}

      <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
        <button
          onClick={toggleLike}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition",
            liked
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-primary")} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
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
          "id, post_id, author_id, content, created_at, author:profiles!community_comments_author_id_fkey (id, display_name, avatar_url, bio)",
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const mapped = (data ?? []).map((c: any) => ({
        ...c,
        author: Array.isArray(c.author) ? c.author[0] : c.author,
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
        <div key={c.id} className="flex gap-2.5">
          <Avatar
            name={c.author?.display_name ?? "?"}
            url={c.author?.avatar_url ?? null}
            size={32}
          />
          <div className="flex-1">
            <div className="rounded-2xl bg-surface-2 px-3.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">
                  {c.author?.display_name ?? "Membro"}
                </p>
                {currentUserId === c.author_id && (
                  <button
                    onClick={() => removeComment.mutate(c.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Apagar comentário"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{c.content}</p>
            </div>
            <p className="mt-1 pl-3 text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</p>
          </div>
        </div>
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
