import { it, expect } from "vitest";
import { courses, coursesById } from "@/data/courses";
it("oculto", () => { expect(courses.some(c=>c.id==="marca-milionaria")).toBe(false); expect(coursesById["marca-milionaria"]).toBeUndefined(); });
