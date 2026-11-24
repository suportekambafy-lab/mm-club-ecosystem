import { describe, expect, it } from "vitest";
import { memberTenureLabel, onboardingSteps } from "./member-tenure";

const now = new Date("2026-11-24T12:00:00Z");
describe("memberTenureLabel", () => {
  it("no badge before one month", () => expect(memberTenureLabel("2026-11-01T00:00:00Z", now)).toBeNull());
  it("counts months", () => expect(memberTenureLabel("2026-05-10T00:00:00Z", now)).toBe("Membro há 6 meses"));
  it("counts years", () => expect(memberTenureLabel("2024-10-01T00:00:00Z", now)).toBe("Membro há 2 anos"));
});
describe("onboardingSteps", () => {
  it("has four steps in order", () => {
    const s = onboardingSteps({ watchedLesson: true, profileDone: false, posted: false, askedAi: false });
    expect(s.map((x) => x.key)).toEqual(["aula", "perfil", "comunidade", "ia"]);
    expect(s.filter((x) => x.done)).toHaveLength(1);
  });
});
