import { describe, expect, it } from "vitest";
import {
  parseDurationToSeconds,
  parseDurationToMinutes,
  formatMinutes,
  computeCourseDurationSeconds,
  computeCourseDuration,
  computeLessonsCount,
  findLesson,
  bunnyThumbFromUrl,
  pandaThumbFromUrl,
} from "./course-duration";
import type { Course } from "@/data/types";

describe("parseDurationToSeconds", () => {
  it("lê mm:ss como minutos:segundos (nunca horas:minutos)", () => {
    expect(parseDurationToSeconds("4:12")).toBe(252);
    expect(parseDurationToSeconds("0:45")).toBe(45);
  });

  it("lê h:mm:ss", () => {
    expect(parseDurationToSeconds("1:20:00")).toBe(4800);
  });

  it("lê formatos escritos", () => {
    expect(parseDurationToSeconds("12m")).toBe(720);
    expect(parseDurationToSeconds("1h")).toBe(3600);
    expect(parseDurationToSeconds("1h 20m")).toBe(4800);
    expect(parseDurationToSeconds("90 min")).toBe(5400);
    expect(parseDurationToSeconds("45s")).toBe(45);
  });

  it("assume minutos num número simples e 0 em vazio/inválido", () => {
    expect(parseDurationToSeconds("12")).toBe(720);
    expect(parseDurationToSeconds("")).toBe(0);
    expect(parseDurationToSeconds(undefined)).toBe(0);
    expect(parseDurationToSeconds("   ")).toBe(0);
    expect(parseDurationToSeconds("abc")).toBe(0);
  });
});

describe("parseDurationToMinutes", () => {
  it("arredonda mas nunca desce a zero quando há vídeo", () => {
    expect(parseDurationToMinutes("0:20")).toBe(1);
    expect(parseDurationToMinutes("1:40")).toBe(2);
    expect(parseDurationToMinutes("")).toBe(0);
  });
});

describe("formatMinutes", () => {
  it("formata horas e minutos", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(-5)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(85)).toBe("1h 25m");
  });
});

const course = {
  id: "c1",
  title: "Curso",
  duration: "2h",
  lessonsCount: 99,
  modules: [
    {
      id: "m1",
      title: "M1",
      lessons: [
        { id: "l1", title: "A1", duration: "10:00" },
        { id: "l2", title: "A2", duration: "5:00" },
      ],
    },
    { id: "m2", title: "M2", lessons: [{ id: "l3", title: "A3", duration: "1h" }] },
  ],
} as unknown as Course;

describe("agregados do curso", () => {
  it("soma a duração real de todas as aulas", () => {
    expect(computeCourseDurationSeconds(course)).toBe(600 + 300 + 3600);
    expect(computeCourseDuration(course)).toBe("1h 15m");
  });

  it("usa a duração declarada quando não há aulas com vídeo", () => {
    const empty = { ...course, modules: [] } as unknown as Course;
    expect(computeCourseDuration(empty)).toBe("2h");
  });

  it("conta as aulas dos módulos em vez do valor declarado", () => {
    expect(computeLessonsCount(course)).toBe(3);
  });

  it("encontra aulas por id em qualquer módulo", () => {
    expect(findLesson(course, "l3")?.title).toBe("A3");
    expect(findLesson(course, "nope")).toBeNull();
    expect(findLesson(course, null)).toBeNull();
  });
});

describe("thumbnails de vídeo", () => {
  it("deriva thumbnail do CDN da Bunny", () => {
    expect(bunnyThumbFromUrl("https://vz-abc.b-cdn.net/guid-1/playlist.m3u8")).toBe(
      "https://vz-abc.b-cdn.net/guid-1/thumbnail.jpg",
    );
  });

  it("ignora URLs inválidos", () => {
    expect(bunnyThumbFromUrl("not a url")).toBeNull();
    expect(bunnyThumbFromUrl("")).toBeNull();
    expect(pandaThumbFromUrl("https://example.com/x")).toBeNull();
  });

  it("deriva thumbnail do Panda Video", () => {
    expect(
      pandaThumbFromUrl("https://player-vz-9.tv.pandavideo.com.br/embed/?v=abc12345"),
    ).toBe("https://b-vz-9.tv.pandavideo.com.br/abc12345/thumbnail.jpg");
  });
});
