import { describe, expect, it } from "vitest";
import { CODE_LENGTH, generateMmpayCode, validateMmpayLinkInput } from "./rules";

const base = { title: "Mentoria", description: null, amountCents: 49700, coverUrl: null };

describe("MMpay rules", () => {
  it("aceita uma venda válida", () => expect(validateMmpayLinkInput(base)).toBeNull());
  it("exige título", () => expect(validateMmpayLinkInput({ ...base, title: " " })).not.toBeNull());
  it("preço mínimo 1 €", () => expect(validateMmpayLinkInput({ ...base, amountCents: 99 })).not.toBeNull());
  it("preço máximo 50 000 €", () =>
    expect(validateMmpayLinkInput({ ...base, amountCents: 5_000_001 })).not.toBeNull());
  it("capa tem de ser https", () =>
    expect(validateMmpayLinkInput({ ...base, coverUrl: "http://x.pt/a.jpg" })).not.toBeNull());
  it("código com 8 caracteres sem ambiguidades", () => {
    const c = generateMmpayCode();
    expect(c).toHaveLength(CODE_LENGTH);
    expect(c).not.toMatch(/[lo01i]/);
  });
});
