import { beforeEach, describe, expect, it, vi } from "vitest";
import { rememberIntendedPlan, readIntendedPlan, clearIntendedPlan } from "./intended-plan";

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return store;
}

describe("intended plan", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = stubStorage();
  });

  it("faz round-trip do plano escolhido", () => {
    rememberIntendedPlan("mm-club-plus", "checkout");
    expect(readIntendedPlan()).toMatchObject({ slug: "mm-club-plus", from: "checkout" });
  });

  it("guarda a origem vip", () => {
    rememberIntendedPlan("vip", "vip");
    expect(readIntendedPlan()?.from).toBe("vip");
  });

  it("ignora slug vazio", () => {
    rememberIntendedPlan("");
    expect(readIntendedPlan()).toBeNull();
  });

  it("esquece intenções com mais de 30 dias", () => {
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    store.set("mm:intended_plan", JSON.stringify({ slug: "x", from: "checkout", at: old }));
    expect(readIntendedPlan()).toBeNull();
    expect(store.has("mm:intended_plan")).toBe(false);
  });

  it("recupera de dados corrompidos", () => {
    store.set("mm:intended_plan", "{nao json");
    expect(readIntendedPlan()).toBeNull();
  });

  it("limpa a intenção", () => {
    rememberIntendedPlan("mm-club-elite");
    clearIntendedPlan();
    expect(readIntendedPlan()).toBeNull();
  });
});
