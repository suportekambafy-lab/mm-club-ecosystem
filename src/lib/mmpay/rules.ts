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

export const createMmpayLinkSchema = z
  .object({
    title: z.string().max(120),
    description: z.string().max(MAX_DESCRIPTION_LENGTH).nullish(),
    amountCents: z.number().int(),
    coverUrl: z.string().url().max(500).nullish(),
  })
  .strict();

const codeSchema = z.string().min(CODE_LENGTH).max(CODE_LENGTH).regex(/^[a-z2-9]+$/);

export const startMmpayCheckoutSchema = z
  .object({
    code: codeSchema,
    email: z.string().email().max(200),
    name: z.string().max(120).nullish(),
    origin: z.string().url(),
  })
  .strict();

export const confirmMmpayPaymentSchema = z
  .object({ code: codeSchema, sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/).max(200) })
  .strict();

export const uploadMmpayCoverSchema = z
  .object({
    mime: z.enum(COVER_MIME_TYPES),
    base64: z.string().max(Math.ceil((MAX_COVER_BYTES * 4) / 3) + 8),
  })
  .strict();
