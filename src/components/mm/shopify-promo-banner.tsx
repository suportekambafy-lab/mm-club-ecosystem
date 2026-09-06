import { useEffect, useState } from "react";
import { ArrowUpRight, ShoppingBag, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SHOPIFY_URL = "https://shopify.pxf.io/c/7738721/1061744/13624";

/**
 * Banner de oferta Shopify.
 * Por agora só é visível para administradores (pré-lançamento).
 * Para abrir a todos os membros, remover o bloco de verificação de role.
 */
export function ShopifyPromoBanner() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase.rpc("has_role", {
        _user_id: uid,
        _role: "admin",
      });
      if (alive) setIsAdmin(Boolean(data));
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <a
      href={SHOPIFY_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="group surface-card relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-primary/30 p-5 transition hover:border-primary/60 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

      <span className="relative flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
          <ShoppingBag className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
              Oferta parceiro
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Eye className="h-2.5 w-2.5" />
              Só visível para ti
            </span>
          </span>
          <span className="mt-2 block font-display text-xl leading-tight text-foreground sm:text-2xl">
            Ganha 3 meses grátis no Shopify hoje.
          </span>
          <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
            Abre a tua nova conta pelo link do MM Club e monta a loja das aulas sem pagar os
            primeiros 3 meses.
          </span>
        </span>
      </span>

      <span className="relative inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition group-hover:brightness-110 sm:self-auto">
        Criar conta
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </a>
  );
}
