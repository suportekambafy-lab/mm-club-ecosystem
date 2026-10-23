/**
 * MMpay — regras de validação para links de pagamento (vendas avulsas).
 * Módulo puro: seguro para importar no cliente e no servidor.
 */
import { z } from "zod";

/** Mínimo de 1 € por venda. */
export const MIN_CUSTOM_AMOUNT_CENTS = 100;
/** Teto de segurança por link: 50 000 €. */
export const MAX_CUSTOM_AMOUNT_CENTS = 5_000_000;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE_LENGTH = 8;

export type MmpayLinkInput = {
  title: string;
  description: string | null;
  amountCents: number;
  coverUrl: string | null;
};

/** Um link MMpay é uma venda única: título, preço, descrição e capa opcionais. */
export function validateMmpayLinkInput(input: MmpayLinkInput): string | null {
  const title = input.title.trim();
  if (!title || title.length > 120) return "O título é obrigatório (máx. 120 caracteres).";
  const amount = input.amountCents;
  if (!Number.isInteger(amount) || amount < MIN_CUSTOM_AMOUNT_CENTS) return "O preço mínimo é 1,00 €.";
  if (amount > MAX_CUSTOM_AMOUNT_CENTS) return "O preço máximo é 50 000 €.";
  if ((input.description?.trim().length ?? 0) > MAX_DESCRIPTION_LENGTH) {
    return `A descrição pode ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`;
  }
  if (input.coverUrl && !/^https:\/\//.test(input.coverUrl)) return "Imagem de capa inválida.";
  return null;
}

/** Código público do link: 8 caracteres sem ambiguidades (sem l, o, 0, 1, i). */
export function generateMmpayCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

const billingSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("one_time") }).strict(),
  z
    .object({
      type: z.literal("subscription"),
      interval: z.enum(["week", "month", "year"]),
      intervalCount: z.number().int().min(1).max(24),
      totalCycles: z.number().int().min(1).max(600).nullable(),
      /** Valor total da venda em cêntimos (só faz sentido com totalCycles definido). */
      totalCents: z.number().int().min(100).max(MAX_CUSTOM_AMOUNT_CENTS).nullable().optional(),
    })
    .strict(),
]);

export const createMmpayLinkSchema = z
  .object({
    billing: billingSchema.optional(),
    title: z.string().max(120),
    description: z.string().max(MAX_DESCRIPTION_LENGTH).nullish(),
    amountCents: z.number().int(),
    coverUrl: z.string().url().max(500).nullish(),
  })
  .strict();

export const updateMmpayLinkSchema = createMmpayLinkSchema.extend({ id: z.string().uuid() });

const codeSchema = z.string().min(CODE_LENGTH).max(CODE_LENGTH).regex(/^[a-z2-9]+$/);

const nameSchema = z.string().trim().min(2, "O nome é obrigatório.").max(120);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s().-]{7,20}$/, "Indica um número de telefone válido.");

export const startMmpayCheckoutSchema = z
  .object({
    code: codeSchema,
    email: z.string().email().max(200),
    name: nameSchema,
    phone: phoneSchema,
    origin: z.string().url(),
    method: z.enum(["card", "mb_way"]).default("card"),
  })
  .strict();

export const startKlarnaPaymentSchema = z
  .object({
    code: codeSchema,
    email: z.string().email().max(200),
    name: nameSchema,
    phone: phoneSchema,
  })
  .strict();

export const confirmKlarnaOrderSchema = z
  .object({
    code: codeSchema,
    sessionRef: z.string().regex(/^kps_[A-Za-z0-9-]+$/).max(200),
    authorizationToken: z.string().min(10).max(200),
  })
  .strict();

export const confirmMmpayPaymentSchema = z
  .object({ code: codeSchema, sessionId: z.string().regex(/^(cs_[A-Za-z0-9_]+|vvo_[0-9]{8,24})$/).max(200) })
  .strict();

export const uploadMmpayCoverSchema = z
  .object({
    mime: z.enum(COVER_MIME_TYPES),
    base64: z.string().max(Math.ceil((MAX_COVER_BYTES * 4) / 3) + 8),
  })
  .strict();

export const vivaOrderCodeSchema = z.string().regex(/^[0-9]{8,24}$/);
