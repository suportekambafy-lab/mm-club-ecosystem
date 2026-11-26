/** Produtos do MM Club. O E-commerce vem com a assinatura; os extras pagam-se à parte. */
export type ClubProductId = "ecommerce" | "infoprodutos" | "ia" | "cod";

export interface ClubProduct {
  id: ClubProductId;
  name: string;
  tagline: string;
  /** Acesso necessário; null = incluído no MM Club. */
  feature: string | null;
  priceEur: number | null;
  checkoutCode: string | null;
}

export const CLUB_PRODUCTS: ClubProduct[] = [
  { id: "ecommerce", name: "MM Club E-commerce", tagline: "Marca, loja, COD, fornecedores e tráfego.", feature: null, priceEur: null, checkoutCode: null },
  { id: "infoprodutos", name: "MM Club Infoprodutos", tagline: "Lançamentos, afiliados e social media.", feature: null, priceEur: null, checkoutCode: null },
  { id: "ia", name: "MM Club IA", tagline: "Inteligência artificial e automações para negócios.", feature: null, priceEur: null, checkoutCode: null },
  { id: "cod", name: "MM Club Cash on Delivery", tagline: "Marca Milionária: loja e vendas com pagamento na entrega.", feature: null, priceEur: null, checkoutCode: null },
];

const COURSE_PRODUCT: Record<string, ClubProductId> = {
  "start-como-afiliado": "infoprodutos",
  "lncamentos-4-em-1": "infoprodutos",
  "nova-era-do-social-media": "infoprodutos",
  "marca-milionaria": "cod",
};

export function productOfCourse(course: { id: string; product?: ClubProductId | undefined }): ClubProductId {
  if (course.product) return course.product;
  for (const [base, p] of Object.entries(COURSE_PRODUCT)) {
    if (course.id === base || course.id.endsWith(`--${base}`)) return p;
  }
  return "ecommerce";
}

export function clubProduct(id: ClubProductId): ClubProduct {
  return CLUB_PRODUCTS.find((p) => p.id === id) ?? CLUB_PRODUCTS[0]!;
}

export function isProductUnlocked(id: ClubProductId, owned: ReadonlySet<string>, isStaff: boolean): boolean {
  const p = clubProduct(id);
  return !p.feature || isStaff || owned.has(p.feature);
}
