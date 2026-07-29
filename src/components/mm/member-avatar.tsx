import { useEffect, useState } from "react";
import { cachedAvatarUrl, resolveAvatarUrl } from "@/lib/avatar-cache";
import { VerifiedBadge } from "@/components/mm/verified-badge";
import { cn } from "@/lib/utils";


type Props = {
  userId?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  verified?: boolean;
  size?: number;
  badgeSize?: number;
  className?: string;
};

function initialsOf(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  return n.split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";
}

/**
 * Unified member avatar. Resolves Supabase storage paths to signed URLs,
 * falls back to initials on error, and overlays the verified badge when
 * `verified` is true.
 */
export function MemberAvatar({
  name,
  avatarUrl,
  verified,
  size = 36,
  badgeSize,
  className,
}: Props) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    if (!avatarUrl) {
      setResolved(null);
      return;
    }
    if (/^https?:\/\//i.test(avatarUrl) || avatarUrl.startsWith("data:")) {
      setResolved(avatarUrl);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage.from("avatars").createSignedUrl(avatarUrl, 60 * 60);
      if (!cancelled) setResolved(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const showImage = Boolean(resolved) && !broken;
  const bSize = badgeSize ?? Math.max(10, Math.round(size * 0.36));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={resolved ?? ""}
          alt=""
          onError={() => setBroken(true)}
          loading="lazy"
          decoding="async"
          className="h-full w-full rounded-full object-cover ring-1 ring-white/10"
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center rounded-full bg-white/10 font-semibold text-white/85 ring-1 ring-white/10"
          style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
        >
          {initialsOf(name)}
        </div>
      )}
      {verified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-neutral-950"
          style={{ padding: 1 }}
        >
          <VerifiedBadge size={bSize} />
        </span>
      )}
    </div>
  );
}
