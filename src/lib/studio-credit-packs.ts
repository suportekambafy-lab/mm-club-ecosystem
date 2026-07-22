export type CreditPack = {
  id: string;
  priceId: string; // Paddle price external_id
  name: string;
  tagline: string;
  price: string; // display
  amountEUR: number;
  credits: number;
  videos: number;
  highlight?: boolean;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    priceId: "mm_credits_starter",
    name: "Starter",
    tagline: "Testa o motor.",
    price: "€1,00",
    amountEUR: 1,
    credits: 500,
    videos: 2,
  },
  {
    id: "plus",
    priceId: "mm_credits_plus",
    name: "Plus",
    tagline: "Campanha semanal.",
    price: "€1,00",
    amountEUR: 1,
    credits: 1500,
    videos: 6,
    highlight: true,
  },
  {
    id: "pro",
    priceId: "mm_credits_pro",
    name: "Pro",
    tagline: "Ritmo profissional.",
    price: "€1,00",
    amountEUR: 1,
    credits: 4000,
    videos: 16,
  },
  {
    id: "max",
    priceId: "mm_credits_max",
    name: "Max",
    tagline: "Escala total.",
    price: "€1,00",
    amountEUR: 1,
    credits: 10000,
    videos: 40,
  },
];

export function packByPriceId(priceId: string | undefined | null): CreditPack | undefined {
  if (!priceId) return undefined;
  return CREDIT_PACKS.find((p) => p.priceId === priceId);
}
