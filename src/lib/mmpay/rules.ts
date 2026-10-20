/**
 * MMpay — regras de validação para links de pagamento.
 * Módulo puro: seguro para importar no cliente e no servidor.
 */
import { z } from "zod";

/** Paddle exige um mínimo de 0,70 € por transação; usamos 1 € com margem. */
export const MIN_CUSTOM_AMOUNT_CENTS = 100;
/** Teto de segurança para um link de valor personalizado: 50 000 €. */
export const MAX_CUSTOM_AMOUNT_CENTS = 5_000_000;

export const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE_LENGTH = 8;

export type MmpayLinkInput = {
  title: string;
  priceId: string | null;
  customAmountCents: number | null;
  customDescription: string | null;
};

/**
 * Um link aponta para um preço do catálogo OU para um valor personalizado —
 * nunca os dois, nunca nenhum. Valor personalizado exige descrição.
 */
export function validateMmpayLinkInput(input: MmpayLinkInput): string | null {
  const hasPrice = Boolean(input.priceId);
  const hasCustom = input.customAmountCents != null;
  if (hasPrice === hasCustom) {
    return "Escolhe um produto do catálogo ou um valor personalizado.";
  }
  if (!input.title.trim() || input.title.trim().length > 120) {
    return "O título é obrigatório (máx. 120 caracteres).";
  }
  if (hasCustom) {
    const amount = input.customAmountCents!;
    if (!Number.isInteger(amount) || amount < MIN_CUSTOM_AMOUNT_CENTS) {
      return "O valor mínimo é 1,00 €.";
    }
    if (amount > MAX_CUSTOM_AMOUNT_CENTS) {
      return "O valor máximo é 50 000 €.";
    }
    const desc = input.customDescription?.trim() ?? "";
    if (desc.length < 3 || desc.length > 140) {
      return "Descreve o que está a ser cobrado (3 a 140 caracteres).";
    }
  }
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
    priceId: z.string().uuid().nullish(),
    customAmountCents: z.number().int().nullish(),
    customDescription: z.string().max(140).nullish(),
  })
  .strict();

export const startMmpayCheckoutSchema = z
  .object({
    code: z
      .string()
      .min(CODE_LENGTH)
      .max(CODE_LENGTH)
      .regex(/^[a-z2-9]+$/),
    email: z.string().email().max(200),
    name: z.string().max(120).nullish(),
    origin: z.string().url(),
  })
  .strict();
