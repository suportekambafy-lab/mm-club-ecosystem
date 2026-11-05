// Configuração editável da página /aplicacao: cortes da classificação e links.
// Muda aqui os valores sem mexer no resto do código.

export const APLICACAO_LINKS = {
  instagram: "https://instagram.com/SEU_INSTAGRAM",
  youtubeVideoId: "VIDEO_ID",
  metaPixelId: "993683323010678",
};

export const OPCOES = {
  pais: ["Portugal", "Outro país da Europa", "Brasil", "Outro"],
  idade: ["Menos de 18", "18 a 24", "25 a 34", "35 a 44", "45 ou mais"],
  ocupacao: [
    "Trabalho por conta de outrem",
    "Tenho negócio próprio",
    "Sou trabalhador independente ou freelancer",
    "Estou desempregado",
    "Sou estudante",
  ],
  experiencia: [
    "Nunca vendi nada online",
    "Já tentei montar loja, mas nunca vendi",
    "Já vendi, mas parei",
    "Tenho loja ativa a faturar até 3.000 € por mês",
    "Tenho loja a faturar mais de 3.000 € por mês",
  ],
  tempo_dia: ["Menos de 1h", "1 a 2h", "2 a 4h", "Mais de 4h"],
  verba_anuncios: ["Até 300 €", "300 € a 1.000 €", "1.000 € a 3.000 €", "Mais de 3.000 €"],
  investimento: [
    "Sim, tenho o valor disponível",
    "Sim, se for em prestações",
    "Agora não, mas consigo em até 30 dias",
    "Não tenho condições agora",
  ],
  decisao: ["Sim", "Preciso de falar com marido, esposa ou sócio"],
} as const;

// Pontuação do perfil completo: cada resposta soma ou tira pontos.
// Nenhuma resposta isolada (ex.: "Até 300 €" ou "falar com marido") rebaixa sozinha para C,
// porque a equipa consegue converter para valores maiores na call (prestações, etc.).
export const PONTOS: Record<string, Record<string, number>> = {
  pais: { "Portugal": 2, "Outro país da Europa": 2, "Brasil": 0, "Outro": 0 },
  idade: { "18 a 24": 0, "25 a 34": 2, "35 a 44": 2, "45 ou mais": 1 },
  ocupacao: {
    "Tenho negócio próprio": 3, "Trabalho por conta de outrem": 2,
    "Sou trabalhador independente ou freelancer": 2, "Estou desempregado": 0, "Sou estudante": -1,
  },
  experiencia: {
    "Nunca vendi nada online": 0, "Já tentei montar loja, mas nunca vendi": 1, "Já vendi, mas parei": 2,
    "Tenho loja ativa a faturar até 3.000 € por mês": 3, "Tenho loja a faturar mais de 3.000 € por mês": 4,
  },
  tempo_dia: { "Menos de 1h": -1, "1 a 2h": 1, "2 a 4h": 2, "Mais de 4h": 2 },
  verba_anuncios: { "Até 300 €": 0, "300 € a 1.000 €": 2, "1.000 € a 3.000 €": 3, "Mais de 3.000 €": 4 },
  investimento: {
    "Sim, tenho o valor disponível": 4, "Sim, se for em prestações": 3,
    "Agora não, mas consigo em até 30 dias": 1, "Não tenho condições agora": -2,
  },
  decisao: { "Sim": 1, "Preciso de falar com marido, esposa ou sócio": 0 },
};

export const CORTES = { A: 15, B: 10 };

const EVASIVAS = /^(n[aã]o|nada|nunca|yes|sim|ok|n[aã]o sei|nenhum|nenhuma|-|\.)$/i;
const MATURIDADE = /(acompanh|mentor|conhecimento|estrat[eé]g|aprender|experi[eê]ncia|medo|coragem|tempo|capital|dinheiro|investi|m[eé]todo|orienta|fornecedor|an[uú]ncio|tr[aá]fego|produto|vend[ai]|faturar|loja|neg[oó]cio|confian)/i;

/** Maturidade da resposta "o que te travou": evasiva tira, reflexão concreta soma. */
export function pontosTravou(texto?: string): number {
  const t = (texto ?? "").trim();
  const letras = t.replace(/[^a-zà-ú]/gi, "");
  if (!t || EVASIVAS.test(t) || letras.length < 4) return -1;
  // texto sem espaços/vogais suficientes = escrito ao calhas
  const palavras = t.split(/\s+/).filter((w) => w.length > 1);
  if (palavras.length >= 1 && palavras.some((w) => w.length > 20)) return -1;
  const madura = MATURIDADE.test(t);
  if (palavras.length <= 1 && !madura) return -1;
  let p = 0;
  if (madura) p += 1;
  if (palavras.length >= 12) p += 1;
  return p;
}

export type Respostas = {
  pais?: string; idade?: string; ocupacao?: string; experiencia?: string; o_que_travou?: string;
  tempo_dia?: string; verba_anuncios?: string; investimento?: string; decisao?: string;
};

export function pontuar(r: Respostas): number {
  let total = pontosTravou(r.o_que_travou);
  for (const [k, tabela] of Object.entries(PONTOS)) total += tabela[(r as Record<string, string | undefined>)[k] ?? ""] ?? 0;
  return total;
}

export function classificar(r: Respostas): "A" | "B" | "C" {
  if (r.idade === "Menos de 18") return "C";
  const p = pontuar(r);
  return p >= CORTES.A ? "A" : p >= CORTES.B ? "B" : "C";
}

export const PAISES_TEL = [
  { code: "PT", flag: "🇵🇹", dial: "351", min: 9, max: 9 },
  { code: "BR", flag: "🇧🇷", dial: "55", min: 10, max: 11 },
  { code: "ES", flag: "🇪🇸", dial: "34", min: 9, max: 9 },
  { code: "FR", flag: "🇫🇷", dial: "33", min: 9, max: 9 },
  { code: "DE", flag: "🇩🇪", dial: "49", min: 10, max: 11 },
  { code: "GB", flag: "🇬🇧", dial: "44", min: 10, max: 10 },
  { code: "IT", flag: "🇮🇹", dial: "39", min: 9, max: 10 },
  { code: "NL", flag: "🇳🇱", dial: "31", min: 9, max: 9 },
  { code: "BE", flag: "🇧🇪", dial: "32", min: 9, max: 9 },
  { code: "CH", flag: "🇨🇭", dial: "41", min: 9, max: 9 },
  { code: "LU", flag: "🇱🇺", dial: "352", min: 9, max: 9 },
  { code: "AO", flag: "🇦🇴", dial: "244", min: 9, max: 9 },
  { code: "MZ", flag: "🇲🇿", dial: "258", min: 9, max: 9 },
  { code: "CV", flag: "🇨🇻", dial: "238", min: 7, max: 7 },
  { code: "US", flag: "🇺🇸", dial: "1", min: 10, max: 10 },
];

export function validarTelefone(code: string, digits: string): string | null {
  const p = PAISES_TEL.find((x) => x.code === code);
  if (!p) return "Escolhe o país.";
  const d = digits.replace(/\D/g, "");
  if (d.length < p.min || d.length > p.max) {
    const n = p.min === p.max ? `${p.min}` : `${p.min} ou ${p.max}`;
    return `O número deve ter ${n} dígitos depois do +${p.dial}.`;
  }
  return null;
}

/** Converte "YYYY-MM-DD" + "HH:mm" em hora de Lisboa para ISO UTC. */
export function lisbonToUtc(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(guess);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const asLisbon = Date.UTC(+g("year"), +g("month") - 1, +g("day"), +g("hour") % 24, +g("minute"));
  return new Date(guess.getTime() - (asLisbon - guess.getTime())).toISOString();
}

/** Próximos N dias úteis em Lisboa (a partir de amanhã), formato YYYY-MM-DD. */
export function proximosDiasUteis(n: number, from = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(from);
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(d);
    const wd = new Date(`${iso}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(iso);
  }
  return out;
}
