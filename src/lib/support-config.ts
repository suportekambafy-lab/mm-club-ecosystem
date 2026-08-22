/**
 * Configuração do MM Suporte.
 * Altera o número de WhatsApp aqui (formato internacional, sem "+" nem espaços).
 */
export const SUPPORT_WHATSAPP_NUMBER = "351910000000";

export function whatsappLink(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export type SupportTopic = {
  id: string;
  title: string;
  prompt: string;
};

/** Temas de ajuda mostrados no ecrã inicial do widget. */
export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: "acesso",
    title: "Não consigo entrar ou perdi a palavra-passe",
    prompt: "Não consigo entrar na minha conta MM Club. O que faço?",
  },
  {
    id: "aulas",
    title: "Problemas a ver aulas ou vídeos da Academia",
    prompt: "Tenho um problema a ver as aulas da Academia. Como resolvo?",
  },
  {
    id: "subscricao",
    title: "Gerir a minha subscrição, plano e método de pagamento",
    prompt: "Como gerir a minha subscrição e o método de pagamento?",
  },
  {
    id: "lives",
    title: "Entrar nas lives e ver as gravações",
    prompt: "Como entro nas lives e onde vejo as gravações?",
  },
  {
    id: "ferramentas",
    title: "MM Studio, créditos e ferramentas",
    prompt: "Como funcionam os créditos e as ferramentas do MM Studio?",
  },
];
