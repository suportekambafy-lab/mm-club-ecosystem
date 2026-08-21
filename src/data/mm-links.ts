// MM Club — Links Úteis
// Ferramentas mencionadas nas aulas. Para adicionar/editar, basta mexer nesta lista.

export type MMLinkCategory =
  | "Lojas & Dropshipping"
  | "IA & No-Code"
  | "Criativos & Design"
  | "Tráfego & Analytics"
  | "Pagamentos"
  | "Email & Automação";

export interface MMLink {
  id: string;
  name: string;
  /** Domínio usado para buscar o logotipo. */
  domain: string;
  url: string;
  category: MMLinkCategory;
  description: string;
  /** Link de afiliado / parceria MM Club. */
  affiliate?: boolean;
  /** Oferta ou benefício para membros. */
  perk?: string;
}

export const mmLinkCategories: MMLinkCategory[] = [
  "Lojas & Dropshipping",
  "IA & No-Code",
  "Criativos & Design",
  "Tráfego & Analytics",
  "Pagamentos",
  "Email & Automação",
];

export const mmLinks: MMLink[] = [
  // Lojas & Dropshipping
  {
    id: "shopify",
    name: "Shopify",
    domain: "shopify.com",
    url: "https://www.shopify.com/pt",
    category: "Lojas & Dropshipping",
    description: "A plataforma que usamos nas aulas para construir a loja.",
    affiliate: true,
    perk: "Teste gratuito + primeiro mês simbólico",
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    domain: "aliexpress.com",
    url: "https://www.aliexpress.com",
    category: "Lojas & Dropshipping",
    description: "Pesquisa de produtos e fornecedores para validação inicial.",
  },
  {
    id: "cjdropshipping",
    name: "CJdropshipping",
    domain: "cjdropshipping.com",
    url: "https://cjdropshipping.com",
    category: "Lojas & Dropshipping",
    description: "Fornecedor com armazéns na Europa e envios mais rápidos.",
  },
  {
    id: "dsers",
    name: "DSers",
    domain: "dsers.com",
    url: "https://www.dsers.com",
    category: "Lojas & Dropshipping",
    description: "App de gestão e envio automático de encomendas na Shopify.",
  },
  {
    id: "alibaba",
    name: "Alibaba",
    domain: "alibaba.com",
    url: "https://www.alibaba.com",
    category: "Lojas & Dropshipping",
    description: "Negociação com fábricas quando passas para stock próprio.",
  },

  // IA & No-Code
  {
    id: "lovable",
    name: "Lovable",
    domain: "lovable.dev",
    url: "https://lovable.dev",
    category: "IA & No-Code",
    description: "Criar apps e sites completos só a conversar com a IA.",
    affiliate: true,
    perk: "Créditos extra no primeiro plano",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    domain: "openai.com",
    url: "https://chat.openai.com",
    category: "IA & No-Code",
    description: "Copy, ângulos de venda e estruturação de ofertas.",
  },
  {
    id: "claude",
    name: "Claude",
    domain: "claude.ai",
    url: "https://claude.ai",
    category: "IA & No-Code",
    description: "Textos longos, análise de documentos e raciocínio.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    domain: "gemini.google.com",
    url: "https://gemini.google.com",
    category: "IA & No-Code",
    description: "Pesquisa assistida e geração/edição de imagens.",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    domain: "elevenlabs.io",
    url: "https://elevenlabs.io",
    category: "IA & No-Code",
    description: "Vozes realistas para VSLs, anúncios e narrações.",
  },
  {
    id: "heygen",
    name: "HeyGen",
    domain: "heygen.com",
    url: "https://www.heygen.com",
    category: "IA & No-Code",
    description: "Avatares em vídeo para UGC sem gravar.",
  },

  // Criativos & Design
  {
    id: "canva",
    name: "Canva",
    domain: "canva.com",
    url: "https://www.canva.com",
    category: "Criativos & Design",
    description: "Edição rápida de criativos, thumbnails e carrosséis.",
  },
  {
    id: "capcut",
    name: "CapCut",
    domain: "capcut.com",
    url: "https://www.capcut.com",
    category: "Criativos & Design",
    description: "Edição de vídeos verticais para Reels, TikTok e anúncios.",
  },
  {
    id: "figma",
    name: "Figma",
    domain: "figma.com",
    url: "https://www.figma.com",
    category: "Criativos & Design",
    description: "Design de páginas de vendas e identidade visual.",
  },
  {
    id: "removebg",
    name: "remove.bg",
    domain: "remove.bg",
    url: "https://www.remove.bg",
    category: "Criativos & Design",
    description: "Remoção de fundo em segundos para fotos de produto.",
  },

  // Tráfego & Analytics
  {
    id: "meta-ads",
    name: "Meta Ads Manager",
    domain: "facebook.com",
    url: "https://adsmanager.facebook.com",
    category: "Tráfego & Analytics",
    description: "Onde criamos e escalamos as campanhas nas aulas.",
  },
  {
    id: "meta-library",
    name: "Biblioteca de Anúncios Meta",
    domain: "facebook.com",
    url: "https://www.facebook.com/ads/library",
    category: "Tráfego & Analytics",
    description: "Espionagem de criativos e ofertas da concorrência.",
  },
  {
    id: "tiktok-ads",
    name: "TikTok Ads",
    domain: "tiktok.com",
    url: "https://ads.tiktok.com",
    category: "Tráfego & Analytics",
    description: "Tráfego pago com criativos nativos e UGC.",
  },
  {
    id: "google-ads",
    name: "Google Ads",
    domain: "google.com",
    url: "https://ads.google.com",
    category: "Tráfego & Analytics",
    description: "Captação de procura ativa: pesquisa, shopping e YouTube.",
  },
  {
    id: "ga4",
    name: "Google Analytics",
    domain: "analytics.google.com",
    url: "https://analytics.google.com",
    category: "Tráfego & Analytics",
    description: "Medição de tráfego, funis e comportamento na loja.",
  },
  {
    id: "trends",
    name: "Google Trends",
    domain: "trends.google.com",
    url: "https://trends.google.com",
    category: "Tráfego & Analytics",
    description: "Validação de sazonalidade e tendência de procura.",
  },

  // Pagamentos
  {
    id: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    url: "https://stripe.com/pt",
    category: "Pagamentos",
    description: "Cartões e subscrições para lojas e infoprodutos.",
  },
  {
    id: "mollie",
    name: "Mollie",
    domain: "mollie.com",
    url: "https://www.mollie.com",
    category: "Pagamentos",
    description: "Métodos europeus (MB WAY, Multibanco, iDEAL, SEPA).",
  },
  {
    id: "paypal",
    name: "PayPal",
    domain: "paypal.com",
    url: "https://www.paypal.com",
    category: "Pagamentos",
    description: "Confiança extra no checkout em mercados internacionais.",
  },

  // Email & Automação
  {
    id: "klaviyo",
    name: "Klaviyo",
    domain: "klaviyo.com",
    url: "https://www.klaviyo.com",
    category: "Email & Automação",
    description: "Fluxos de carrinho abandonado e retenção de clientes.",
  },
  {
    id: "resend",
    name: "Resend",
    domain: "resend.com",
    url: "https://resend.com",
    category: "Email & Automação",
    description: "Envio de emails transacionais a partir da tua app.",
  },
  {
    id: "make",
    name: "Make",
    domain: "make.com",
    url: "https://www.make.com",
    category: "Email & Automação",
    description: "Automações entre ferramentas sem escrever código.",
  },
  {
    id: "notion",
    name: "Notion",
    domain: "notion.so",
    url: "https://www.notion.so",
    category: "Email & Automação",
    description: "Organização de projetos, SOPs e planeamento de conteúdo.",
  },
];

export function mmLinkLogo(domain: string, size = 128) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
