import { describe, it, expect } from "vitest";
import { classificar, validarTelefone, lisbonToUtc } from "./config";

const quente = {
  pais: "Portugal", idade: "25 a 34", tempo_dia: "2 a 4h",
  verba_anuncios: "1.000 € a 3.000 €", investimento: "Sim, tenho o valor disponível",
};

describe("classificação de leads", () => {
  it("A quando cumpre todos os cortes", () => expect(classificar(quente)).toBe("A"));
  it("C se menor de 18", () => expect(classificar({ ...quente, idade: "Menos de 18" })).toBe("C"));
  it("C se verba até 300 €", () => expect(classificar({ ...quente, verba_anuncios: "Até 300 €" })).toBe("C"));
  it("C sem condições", () => expect(classificar({ ...quente, investimento: "Não tenho condições agora" })).toBe("C"));
  it("B se mora no Brasil", () => expect(classificar({ ...quente, pais: "Brasil" })).toBe("B"));
  it("B com menos de 1h por dia", () => expect(classificar({ ...quente, tempo_dia: "Menos de 1h" })).toBe("B"));
});

describe("telefone", () => {
  it("Portugal exige 9 dígitos", () => {
    expect(validarTelefone("PT", "912345678")).toBeNull();
    expect(validarTelefone("PT", "91234567")).not.toBeNull();
  });
  it("Brasil aceita 10 ou 11", () => {
    expect(validarTelefone("BR", "1123456789")).toBeNull();
    expect(validarTelefone("BR", "11923456789")).toBeNull();
    expect(validarTelefone("BR", "112345678")).not.toBeNull();
  });
});

it("10:00 de Lisboa no verão é 09:00 UTC", () => {
  expect(lisbonToUtc("2026-07-01", "10:00")).toBe("2026-07-01T09:00:00.000Z");
});
