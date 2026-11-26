import { describe, expect, it } from "vitest";
import { clubProduct, isProductUnlocked, productOfCourse } from "./products";

describe("produtos MM Club", () => {
  it("cursos atuais de e-commerce ficam no E-commerce", () => {
    expect(productOfCourse({ id: "marca-milionaria-legacy" })).toBe("ecommerce");
  });
  it("afiliados vai para Infoprodutos, incluindo cópias founder", () => {
    expect(productOfCourse({ id: "founder--marca-milionaria--lncamentos-4-em-1" })).toBe("infoprodutos");
  });
  it("Marca Milionária fica no Cash on Delivery", () => {
    expect(productOfCourse({ id: "marca-milionaria" })).toBe("cod");
  });
  it("todos os clubes abertos a quem tem acesso", () => {
    for (const id of ["ecommerce", "infoprodutos", "ia", "cod"] as const) expect(isProductUnlocked(id, new Set(), false)).toBe(true);
  });
});
