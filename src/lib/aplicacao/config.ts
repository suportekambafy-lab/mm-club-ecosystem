// Configuração editável da página /aplicacao: cortes da classificação e links.
// Muda aqui os valores sem mexer no resto do código.

export const APLICACAO_LINKS = {
  instagram: "https://instagram.com/SEU_INSTAGRAM",
  youtubeVideoId: "VIDEO_ID",
  metaPixelId: "PIXEL_ID",
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

export const CORTES = {
  A: {
    paises: ["Portugal", "Outro país da Europa"],
    investimento: ["Sim, tenho o valor disponível", "Sim, se for em prestações"],
    verba: ["1.000 € a 3.000 €", "Mais de 3.000 €"],
    tempoExcluido: ["Menos de 1h"],
  },
  C: {
    idade: ["Menos de 18"],
    investimento: ["Não tenho condições agora"],
    verba: ["Até 300 €"],
  },
};

export type Respostas = {
  pais?: string; idade?: string; tempo_dia?: string;
  verba_anuncios?: string; investimento?: string;
};

export function classificar(r: Respostas): "A" | "B" | "C" {
  const c = CORTES.C;
  if (
    c.idade.includes(r.idade ?? "") ||
    c.investimento.includes(r.investimento ?? "") ||
    c.verba.includes(r.verba_anuncios ?? "")
  ) return "C";
  const a = CORTES.A;
  if (
    a.paises.includes(r.pais ?? "") &&
    !!r.idade && r.idade !== "Menos de 18" &&
    a.investimento.includes(r.investimento ?? "") &&
    a.verba.includes(r.verba_anuncios ?? "") &&
    !!r.tempo_dia && !a.tempoExcluido.includes(r.tempo_dia)
  ) return "A";
  return "B";
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
