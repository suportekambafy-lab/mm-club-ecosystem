import { Link } from "@tanstack/react-router";
import { Bot, Check, ChevronsUpDown, Lock, Package, ShoppingCart } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CLUB_PRODUCTS, clubProduct, type ClubProductId } from "@/lib/club/products";
import { useActiveProduct } from "@/hooks/use-active-product";
import { useClubProducts } from "@/hooks/use-club-products";
import { cn } from "@/lib/utils";

const ICONS: Record<ClubProductId, typeof ShoppingCart> = { ecommerce: ShoppingCart, infoprodutos: Package, ia: Bot };

export function ProductSwitcher({ compact = false, onPicked }: { compact?: boolean; onPicked?: () => void }) {
  const [active, setActive] = useActiveProduct();
  const { isUnlocked } = useClubProducts();
  const p = clubProduct(active);
  const Icon = ICONS[active];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mudar de produto"
        className={cn(
          "flex w-full items-center gap-3 rounded-xl bg-sidebar-accent/60 text-left ring-1 ring-border transition hover:ring-primary",
          compact ? "justify-center p-2" : "px-3 py-2.5",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Produto</span>
              <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Mudar de produto</DropdownMenuLabel>
        {CLUB_PRODUCTS.map((prod) => {
          const I = ICONS[prod.id];
          const unlocked = isUnlocked(prod.id);
          return (
            <DropdownMenuItem key={prod.id} asChild onSelect={() => { setActive(prod.id); onPicked?.(); }}>
              <Link to="/academia" className="flex items-center gap-3">
                <I className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate">{prod.name}</span>
                {prod.id === active ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : !unlocked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{prod.priceEur} €</span>
                ) : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
