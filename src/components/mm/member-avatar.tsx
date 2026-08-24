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
  const [resolved, setResolved] = useState<string | null>(() => cachedAvatarUrl(avatarUrl));
  const [broken, setBroken] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setBroken(false);
    const cached = cachedAvatarUrl(avatarUrl);
    setResolved(cached);
    if (!avatarUrl) return;
    let cancelled = false;
    void resolveAvatarUrl(avatarUrl).then((url) => {
      if (!cancelled && url) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl, retry]);

  const showImage = Boolean(resolved) && !broken;
  // Enquanto o URL assinado está a ser obtido não mostramos "?" — fica um
  // círculo neutro, evitando o salto visual de "?" para foto.
  const pending = Boolean(avatarUrl) && !showImage && retry < 2;
  const bSize = badgeSize ?? Math.max(10, Math.round(size * 0.36));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          loading="lazy"
          decoding="async"
          src={resolved ?? ""}
          alt=""
          onError={() => {
            // signed URL expirado/falhado: tenta renovar uma vez
            if (retry < 1) {
              setRetry((r) => r + 1);
              setResolved(null);
            } else {
              setBroken(true);
            }
          }}
          className="h-full w-full rounded-full object-cover ring-1 ring-white/10"
        />
      ) : pending ? (
        <div className="h-full w-full animate-pulse rounded-full bg-white/10 ring-1 ring-white/10" />
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
