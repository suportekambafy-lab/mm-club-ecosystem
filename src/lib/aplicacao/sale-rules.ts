import { z } from "zod";

export const leadUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["novo", "incompleto", "em_contato", "call_marcada", "fechou", "perdido"]).optional(),
  assumir: z.boolean().optional(),
  saleAmountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  callScheduledAt: z.string().datetime().optional(),
  closerId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.status === "call_marcada" && !value.callScheduledAt)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["callScheduledAt"], message: "Indica a data e hora da call." });
  if (value.status === "call_marcada" && !value.closerId)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["closerId"], message: "Escolhe o closer da call." });
  if (value.status !== "call_marcada" && value.closerId !== undefined)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["closerId"], message: "O closer só é escolhido ao marcar a call." });
  if (value.status !== "call_marcada" && value.callScheduledAt !== undefined)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["callScheduledAt"], message: "A data só pode ser registada ao marcar a call." });
  if (value.status === "fechou" && value.saleAmountCents === undefined)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["saleAmountCents"], message: "Indica o valor da venda." });
  if (value.status !== "fechou" && value.saleAmountCents !== undefined)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["saleAmountCents"], message: "O valor só pode ser registado ao fechar a venda." });
});

export function parseSaleAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export const formatSaleAmount = (cents: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);