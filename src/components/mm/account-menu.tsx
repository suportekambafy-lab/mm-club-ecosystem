import { Link } from "@tanstack/react-router";
import { Bot, Check, Truck, Lock, LogOut, Package, ShoppingCart, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CLUB_PRODUCTS, type ClubProductId } from "@/lib/club/products";
import { useActiveProduct } from "@/hooks/use-active-product";
import { useClubProducts } from "@/hooks/use-club-products";
import { cn } from "@/lib/utils";

const ICONS: Record<ClubProductId, typeof ShoppingCart> = { ecommerce: ShoppingCart, infoprodutos: Package, ia: Bot, cod: Truck };

export function AccountMenu({ avatarSrc, initials, displayName, planLabel, expanded = false, onPicked, onSignOut }: {
  avatarSrc: string | null;
  initials: string;
  displayName: string;
  planLabel?: string;
  expanded?: boolean;
  onPicked?: () => void;
  onSignOut: () => void;
}) {
  const [active, setActive] = useActiveProduct();
  const { isUnlocked } = useClubProducts();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Abrir menu da conta" title={displayName}
          className={cn("p-0 hover:bg-sidebar-accent", expanded ? "h-auto min-w-0 flex-1 justify-start rounded-lg px-1 py-1 text-left" : "h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {avatarSrc ? <img src={avatarSrc} alt="" decoding="async" className="h-full w-full object-cover" /> : initials}
          </span>
          {expanded && <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{planLabel}</span>
          </span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-24px)]">
        <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
        <DropdownMenuItem asChild onSelect={onPicked}>
          <Link to="/perfil"><UserRound /> A minha conta</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Os meus clubes</DropdownMenuLabel>
        {CLUB_PRODUCTS.map((prod) => {
          const Icon = ICONS[prod.id];
          const unlocked = isUnlocked(prod.id);
          return (
            <DropdownMenuItem key={prod.id} asChild onSelect={() => { setActive(prod.id); onPicked?.(); }}>
              <Link to="/academia" className="flex items-center gap-3 py-2.5">
                <Icon className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate">{prod.name}</span>
                {!unlocked && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{prod.priceEur} €</span>}
                {prod.id === active && <Check className="h-4 w-4 text-primary" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}><LogOut /> Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}