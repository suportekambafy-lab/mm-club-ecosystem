import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  generateMmpayCode,
  MAX_CUSTOM_AMOUNT_CENTS,
  MIN_CUSTOM_AMOUNT_CENTS,
  validateMmpayLinkInput,
} from "./rules";

const base = {
  title: "Pagamento MM Club",
  priceId: null as string | null,
  customAmountCents: null as number | null,
  customDescription: null as string | null,
};

describe("validateMmpayLinkInput", () => {
  it("aceita um link para preço do catálogo", () => {
    expect(
      validateMmpayLinkInput({ ...base, priceId: crypto.randomUUID() }),
    ).toBeNull();
  });

  it("aceita um valor personalizado com descrição", () => {
    expect(
      validateMmpayLinkInput({
        ...base,
        customAmountCents: 4900,
        customDescription: "Sessão de mentoria",
      }),
    ).toBeNull();
  });

  it("rejeita link sem preço nem valor", () => {
    expect(validateMmpayLinkInput(base)).toMatch(/catálogo ou um valor/);
  });

  it("rejeita link com preço e valor ao mesmo tempo", () => {
    expect(
      validateMmpayLinkInput({
        ...base,
        priceId: crypto.randomUUID(),
        customAmountCents: 4900,
        customDescription: "Sessão",
      }),
    ).toMatch(/catálogo ou um valor/);
  });

  it("rejeita valor abaixo do mínimo e acima do máximo", () => {
    expect(
      validateMmpayLinkInput({
        ...base,
        customAmountCents: MIN_CUSTOM_AMOUNT_CENTS - 1,
        customDescription: "Sessão",
      }),
    ).toMatch(/mínimo/);
    expect(
      validateMmpayLinkInput({
        ...base,
        customAmountCents: MAX_CUSTOM_AMOUNT_CENTS + 1,
        customDescription: "Sessão",
      }),
    ).toMatch(/máximo/);
  });

  it("rejeita valor personalizado sem descrição", () => {
    expect(
      validateMmpayLinkInput({ ...base, customAmountCents: 4900 }),
    ).toMatch(/Descreve/);
  });

  it("rejeita título vazio", () => {
    expect(
      validateMmpayLinkInput({ ...base, title: "  ", priceId: crypto.randomUUID() }),
    ).toMatch(/título/);
  });
});

describe("generateMmpayCode", () => {
  it("gera códigos de 8 caracteres do alfabeto sem ambiguidades", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateMmpayCode();
      expect(code).toHaveLength(CODE_LENGTH);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });
});
