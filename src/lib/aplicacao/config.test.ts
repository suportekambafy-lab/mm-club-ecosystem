import { describe, it, expect } from "vitest";
import { classificar, validarTelefone, lisbonToUtc } from "./config";

const quente = {
  pais: "Portugal", idade: "25 a 34", ocupacao: "Trabalho por conta de outrem",
  experiencia: "Já vendi, mas parei", o_que_travou: "Faltou-me acompanhamento e estratégia de anúncios",
  tempo_dia: "2 a 4h", verba_anuncios: "1.000 € a 3.000 €",
  investimento: "Sim, tenho o valor disponível", decisao: "Sim",
};

describe("classificação de leads", () => {
  it("A com perfil forte", () => expect(classificar(quente)).toBe("A"));
  it("C se menor de 18", () => expect(classificar({ ...quente, idade: "Menos de 18" })).toBe("C"));
  it("até 300 € sozinho não torna C", () => expect(classificar({ ...quente, verba_anuncios: "Até 300 €" })).not.toBe("C"));
  it("falar com marido sozinho não torna C", () =>
    expect(classificar({ ...quente, decisao: "Preciso de falar com marido, esposa ou sócio" })).toBe("A"));
  it("prestações com 300 € e falta de acompanhamento é B", () =>
    expect(classificar({ ...quente, verba_anuncios: "Até 300 €", investimento: "Sim, se for em prestações",
      experiencia: "Já tentei montar loja, mas nunca vendi", tempo_dia: "1 a 2h", o_que_travou: "Falta de acompanhamento" })).toBe("B"));
  it("estudante sem condições e resposta evasiva é C", () =>
    expect(classificar({ ...quente, ocupacao: "Sou estudante", idade: "18 a 24", experiencia: "Nunca vendi nada online",
      investimento: "Não tenho condições agora", verba_anuncios: "Até 300 €", o_que_travou: "Nada" })).toBe("C"));
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
