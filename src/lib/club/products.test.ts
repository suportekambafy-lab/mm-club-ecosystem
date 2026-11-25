import { describe, expect, it } from "vitest";
import { clubProduct, isProductUnlocked, productOfCourse } from "./products";

describe("produtos MM Club", () => {
  it("cursos atuais de e-commerce ficam no E-commerce", () => {
    expect(productOfCourse({ id: "marca-milionaria-legacy" })).toBe("ecommerce");
  });
  it("afiliados vai para Infoprodutos, incluindo cópias founder", () => {
    expect(productOfCourse({ id: "founder--marca-milionaria--lncamentos-4-em-1" })).toBe("infoprodutos");
  });
  it("extras custam 97 €", () => {
    expect(clubProduct("infoprodutos").priceEur).toBe(97);
    expect(clubProduct("ia").priceEur).toBe(97);
  });
  it("extra trancado sem compra, aberto com compra", () => {
    expect(isProductUnlocked("ia", new Set(), false)).toBe(false);
    expect(isProductUnlocked("ia", new Set(["product.ia"]), false)).toBe(true);
    expect(isProductUnlocked("ecommerce", new Set(), false)).toBe(true);
  });
});
