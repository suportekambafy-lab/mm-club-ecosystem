import { describe, expect, it } from "vitest";
import {
  CODE_LENGTH,
  MMPAY_METHODS,
  createMmpayLinkSchema,
  effectiveMethods,
  generateMmpayCode,
  startMmpayCheckoutSchema,
  validateMmpayLinkInput,
} from "./rules";

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

describe("MMpay métodos de pagamento (só Viva.com)", () => {
  it("só há cartão e MB WAY", () => expect([...MMPAY_METHODS]).toEqual(["card", "mb_way"]));
  it("ignora Klarna guardado num link antigo", () =>
    expect(effectiveMethods(["card", "mb_way", "klarna"], false)).toEqual(["card", "mb_way"]));
  it("um link que só tinha Klarna volta a aceitar cartão", () =>
    expect(effectiveMethods(["klarna"], false)).toEqual(["card"]));
  it("o formulário rejeita Klarna como método ativo", () =>
    expect(createMmpayLinkSchema.safeParse({ ...base, paymentMethods: ["card", "klarna"] }).success).toBe(false));
  it("o checkout rejeita Klarna como método de pagamento", () =>
    expect(
      startMmpayCheckoutSchema.safeParse({
        code: "abcdefgh",
        email: "a@b.pt",
        name: "Ana",
        phone: "+351912345678",
        origin: "https://mmclub.pt",
        method: "klarna",
      }).success,
    ).toBe(false));
});
