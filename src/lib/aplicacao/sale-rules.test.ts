import { describe, expect, it } from "vitest";
import { contactOutcomeStatusPatch, leadUpdateSchema, parseSaleAmount } from "./sale-rules";
const id = "a5c4a520-daa8-4a32-b639-783c5ca0bc67";
describe("contact outcome", () => {
  it("accepts each outcome on its own", () => {
    for (const contactOutcome of ["contactei", "atendeu", "nao_atendeu"] as const)
      expect(leadUpdateSchema.safeParse({ id, contactOutcome }).success).toBe(true);
  });
  it("rejects an outcome combined with a status or sale change", () => {
    expect(leadUpdateSchema.safeParse({ id, contactOutcome: "atendeu", status: "em_contato" }).success).toBe(false);
    expect(leadUpdateSchema.safeParse({ id, contactOutcome: "atendeu", saleAmountCents: 14990 }).success).toBe(false);
  });
  it("promotes only new leads to in contact", () => {
    expect(contactOutcomeStatusPatch("novo", "contactei")).toBe("em_contato");
    expect(contactOutcomeStatusPatch(null, "atendeu")).toBe("em_contato");
    expect(contactOutcomeStatusPatch("call_marcada", "nao_atendeu")).toBeUndefined();
    expect(contactOutcomeStatusPatch("novo", undefined)).toBeUndefined();
  });
});
describe("sale closure", () => {
  it("requires a value when marking a lead closed", () => {
    expect(leadUpdateSchema.safeParse({ id, status: "fechou" }).success).toBe(false);
    expect(leadUpdateSchema.safeParse({ id, status: "fechou", saleAmountCents: 14990 }).success).toBe(true);
  });
  it("rejects zero, negative and fractional cents", () => {
    for (const saleAmountCents of [0, -1, 12.5]) expect(leadUpdateSchema.safeParse({ id, status: "fechou", saleAmountCents }).success).toBe(false);
  });
  it("stores exact EUR cents from Portuguese amounts", () => {
    expect(parseSaleAmount("149,90")).toBe(14990);
    expect(parseSaleAmount("1000")).toBe(100000);
    expect(parseSaleAmount("0,01")).toBe(1);
    for (const value of ["", "0", "-10", "1,234", "abc"]) expect(parseSaleAmount(value)).toBeNull();
  });
  it("does not require a sale value for other status updates", () => {
    expect(leadUpdateSchema.safeParse({ id, status: "em_contato" }).success).toBe(true);
    expect(leadUpdateSchema.safeParse({ id, status: "novo", saleAmountCents: 14990 }).success).toBe(false);
  });
});