import { describe, it, expect } from "vitest";
import { duplicateIds, normPhone } from "./duplicate-rules";

describe("leads duplicados", () => {
  it("mesmo telemóvel com e sem indicativo é duplicado", () => expect(normPhone("+351 912 345 678")).toBe(normPhone("912345678")));
  it("marca só o mais recente com o mesmo email", () => {
    const ids = duplicateIds([
      { id: "b", email: "Ana@x.pt", created_at: "2026-11-02" },
      { id: "a", email: "ana@x.pt", created_at: "2026-11-01" },
    ]);
    expect([...ids]).toEqual(["b"]);
  });
  it("ignora aplicações incompletas", () => {
    expect(duplicateIds([
      { id: "a", whatsapp: "912345678", created_at: "1" },
      { id: "b", whatsapp: "912345678", created_at: "2", status: "incompleto" },
    ]).size).toBe(0);
  });
});
