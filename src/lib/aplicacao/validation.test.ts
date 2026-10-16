import { describe, expect, it } from "vitest";
import { leadSchema, REQUIRED_APPLICATION_FIELDS } from "./validation";

const complete = Object.fromEntries(REQUIRED_APPLICATION_FIELDS.map((key) => [key, key === "email" ? "teste@example.com" : "Resposta"]));
describe("respostas obrigatórias", () => {
  it("aceita uma aplicação completa", () => expect(leadSchema.safeParse({ ...complete, final: true }).success).toBe(true));
  for (const key of REQUIRED_APPLICATION_FIELDS) {
    it(`não permite enviar sem ${key}`, () => {
      const { [key]: removed, ...rest } = complete;
      expect(leadSchema.safeParse({ ...rest, final: true }).success).toBe(false);
      expect(leadSchema.safeParse({ ...complete, [key]: "   ", final: true }).success).toBe(false);
    });
  }
  it("continua a guardar aplicações a meio", () => expect(leadSchema.safeParse({ whatsapp: "+351912345678", final: false }).success).toBe(true));
});