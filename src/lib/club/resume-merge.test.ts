import { describe, expect, it } from "vitest";
import { resumeMatchesStep } from "@/lib/club/resume-merge";

const resume = { courseId: "marca-milionaria-legacy", lessonId: "psicologia-do-consumidor", seconds: 95 };

describe("resumeMatchesStep", () => {
  it("deduplica quando os dois cartões apontam para a mesma aula", () => {
    expect(resumeMatchesStep(resume, { courseId: resume.courseId, lessonId: resume.lessonId })).toBe(true);
  });

  it("mantém os dois cartões quando a aula é outra", () => {
    expect(resumeMatchesStep(resume, { courseId: resume.courseId, lessonId: "outra-aula" })).toBe(false);
  });

  it("mantém os dois cartões quando o curso é outro", () => {
    expect(resumeMatchesStep(resume, { courseId: "cash-on-delivery", lessonId: resume.lessonId })).toBe(false);
  });

  it("sem aula a retomar não há nada para esconder", () => {
    expect(resumeMatchesStep(null, { courseId: resume.courseId, lessonId: resume.lessonId })).toBe(false);
  });

  it("sem próximo passo carregado não esconde a retoma", () => {
    expect(resumeMatchesStep(resume, null)).toBe(false);
  });
});
