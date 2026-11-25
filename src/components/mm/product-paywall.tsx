import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { clubProduct, type ClubProductId } from "@/lib/club/products";

export function ProductPaywall({ productId, courseTitle }: { productId: ClubProductId; courseTitle?: string }) {
  const p = clubProduct(productId);
  return (
    <div className="max-w-full space-y-8">
      <Link to="/academia" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Academia
      </Link>
      <div className="mx-auto max-w-xl rounded-3xl bg-surface-1 p-8 text-center ring-1 ring-border">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <p className="type-eyebrow mt-5 text-primary">Produto extra</p>
        <h1 className="mt-2 font-display text-2xl text-foreground">{p.name}</h1>
        {courseTitle && <p className="mt-2 text-sm text-muted-foreground">«{courseTitle}» faz parte do {p.name}.</p>}
        <p className="mt-3 text-sm text-muted-foreground">{p.tagline} Pagas uma vez e fica teu para sempre.</p>
        {p.checkoutCode && (
          <a
            href={`/pagar/${p.checkoutCode}`}
            className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-gold-soft"
          >
            Desbloquear por {p.priceEur} €
          </a>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Usa no pagamento o mesmo email da tua conta MM Club.</p>
      </div>
    </div>
  );
}
