import { describe, expect, it } from "vitest";
import { certificateCurriculum } from "./certificate-curriculum";
import type { Course } from "@/data/types";
const base = [{ id: "legacy", title: "Legacy", modules: [{ id: "m", title: "M", lessons: [{ id: "l1", title: "A", duration: "4:12" }] }] }] as Course[];
describe("canonical certificates", () => {
  it("rejects unknown courses and empty curricula", () => {
    expect(() => certificateCurriculum(base, {}, "inventado")).toThrow();
    expect(() => certificateCurriculum(base, { modulesByCourse: { legacy: [] } }, "legacy")).toThrow();
  });
  it("uses module replacement, title and legacy lesson overrides without mutation", () => {
    const snapshot = JSON.stringify(base);
    const result = certificateCurriculum(base, { courses: { legacy: { title: "Novo título" } }, modulesByCourse: { legacy: [{ lessons: [{ id: "new", duration: "4:12" }] }] }, lessons: { new: { duration: "1:20:00" } } }, "legacy");
    expect(result).toMatchObject({ title: "Novo título", lessonIds: ["new"], hours: 1.3 });
    expect(JSON.stringify(base)).toBe(snapshot);
  });
  it("does not trust submitted certificate hours or totals", () => {
    const result = certificateCurriculum(base, { courses: { legacy: { hours: 999, lessonsTotal: 1 } } }, "legacy");
    expect(result.hours).toBe(0.1);
    expect(result.lessonIds).toEqual(["l1"]);
  });
  it("rejects duplicate lesson identifiers", () => {
    expect(() => certificateCurriculum(base, { modulesByCourse: { legacy: [{ lessons: [{ id: "x", duration: "1:00" }, { id: "x", duration: "2:00" }] }] } }, "legacy")).toThrow();
  });
  it("rejects malformed catalogue data", () => {
    expect(() => certificateCurriculum(base, { modulesByCourse: "invalid" }, "legacy")).toThrow();
  });
});