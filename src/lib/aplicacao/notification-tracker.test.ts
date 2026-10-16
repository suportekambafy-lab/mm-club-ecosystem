import { expect, it } from "vitest";
import { createApplicationTracker } from "./notification-tracker";

it("alerts once for each newly completed application, never historical or incomplete ones", () => {
  const scan = createApplicationTracker();
  const old = { id: "old", nome: "Antigo", classificacao: "A" };
  const draft = { id: "new", nome: "Novo", classificacao: null };
  expect(scan([old, draft])).toEqual([]);
  expect(scan([old, draft])).toEqual([]);
  const completed = { ...draft, classificacao: "B" };
  expect(scan([old, completed])).toEqual([completed]);
  expect(scan([old, completed])).toEqual([]);
});