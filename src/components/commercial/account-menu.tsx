import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MemberAvatar } from "@/components/mm/member-avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AccountData = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roles: string[];
};

function roleTitle(roles: string[], isAdmin: boolean): string {
  const has = (r: string) => roles.includes(r);
  if (has("admin")) return "Administrador";
  if (has("sdr") && has("closer")) return "SDR & Closer";
  if (has("sdr")) return "SDR";
  if (has("closer")) return "Closer";
  return isAdmin ? "Administrador" : "Equipa";
}

export function AccountMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["commercial", "account-menu"],
    queryFn: async (): Promise<AccountData> => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? "";
      if (!userId) throw new Error("Sem sessão.");
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      const name =
        (profile?.display_name as string | undefined) ??
        auth.user?.email?.split("@")[0] ??
        "Membro";
      return {
        userId,
        name,
        email: auth.user?.email ?? "",
        avatarUrl: (profile?.avatar_url as string | null) ?? null,
        roles: (roles ?? []).map((r) => r.role as string),
      };
    },
    staleTime: 60_000,
  });

  const initials = q.data?.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <button
        type="button"
        title={roleTitle(q.data?.roles ?? [], isAdmin)}
        aria-label="A minha conta"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-commercial-success" aria-hidden />
        <MemberAvatar
          name={q.data?.name ?? null}
          avatarUrl={q.data?.avatarUrl ?? null}
          size={32}
        />
      </button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent
          aria-describedby={undefined}
          className="admin-shell commercial-shell max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-lg text-foreground"
        >
          <DialogTitle className="sr-only">A minha conta</DialogTitle>
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div
                className="absolute -inset-1 rounded-full bg-commercial-accent/25 blur-md"
                aria-hidden
              />
              <MemberAvatar
                name={q.data?.name ?? null}
                avatarUrl={q.data?.avatarUrl ?? null}
                size={80}
                className="relative"
              />
            </div>
            <p className="mt-4 text-lg font-semibold">{q.data?.name ?? "Membro"}</p>
            {q.data?.email && (
              <p className="mt-0.5 break-all text-sm text-muted-foreground">{q.data.email}</p>
            )}
            <span
              className={cn(
                "mt-3 rounded-full border border-commercial-accent/40 bg-commercial-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-commercial-accent",
              )}
            >
              {roleTitle(q.data?.roles ?? [], isAdmin)}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
