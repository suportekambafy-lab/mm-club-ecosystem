import { describe, expect, it } from "vitest";
import { buildLiveReminders, type LiveLike } from "./live-reminders";

const NOW = Date.parse("2026-08-23T18:00:00Z");
const at = (minutesFromNow: number) => new Date(NOW + minutesFromNow * 60_000).toISOString();

function live(partial: Partial<LiveLike>): LiveLike {
  return { id: "L1", title: "Aula ao vivo", starts_at: at(60), status: "scheduled", ...partial };
}

describe("buildLiveReminders", () => {
  it("marca lives a decorrer com prioridade máxima", () => {
    const [r] = buildLiveReminders([live({ status: "live", starts_at: at(-10) })], NOW);
    expect(r.id).toBe("live:L1:now");
    expect(r.priority).toBe(20);
    expect(r.title).toMatch(/está a decorrer/);
  });

  it("escolhe o estágio mais próximo do início", () => {
    const stage = (min: number) =>
      buildLiveReminders([live({ starts_at: at(min) })], NOW)[0]?.id;
    expect(stage(3)).toBe("live:L1:5m");
    expect(stage(10)).toBe("live:L1:15m");
    expect(stage(20)).toBe("live:L1:30m");
    expect(stage(50)).toBe("live:L1:1h");
    expect(stage(150)).toBe("live:L1:3h");
    expect(stage(600)).toBe("live:L1:24h");
  });

  it("usa anúncio para lives distantes com plural correto", () => {
    const [r] = buildLiveReminders([live({ starts_at: at(60 * 24 * 3) })], NOW);
    expect(r.id).toBe("live:L1:announce");
    expect(r.subtitle).toMatch(/3 dias/);
    const [one] = buildLiveReminders([live({ starts_at: at(60 * 25) })], NOW);
    expect(one.subtitle).toMatch(/1 dia ·/);
  });

  it("mostra 'vai começar' até 1h depois da hora e depois desaparece", () => {
    expect(buildLiveReminders([live({ starts_at: at(-30) })], NOW)[0]?.id).toBe(
      "live:L1:starting",
    );
    expect(buildLiveReminders([live({ starts_at: at(-90) })], NOW)).toHaveLength(0);
  });

  it("ignora estados finais e datas inválidas", () => {
    expect(buildLiveReminders([live({ status: "ended" })], NOW)).toHaveLength(0);
    expect(buildLiveReminders([live({ starts_at: "não é data" })], NOW)).toHaveLength(0);
  });

  it("ordena por prioridade (a decorrer antes de agendadas)", () => {
    const list = buildLiveReminders(
      [
        live({ id: "far", starts_at: at(60 * 24 * 5) }),
        live({ id: "soon", starts_at: at(4) }),
        live({ id: "onair", status: "live", starts_at: at(-5) }),
      ],
      NOW,
    );
    expect(list.map((r) => r.liveId)).toEqual(["onair", "soon", "far"]);
  });

  it("gera ids estáveis (mesma entrada, mesmo id)", () => {
    const a = buildLiveReminders([live({ starts_at: at(10) })], NOW)[0]!.id;
    const b = buildLiveReminders([live({ starts_at: at(12) })], NOW)[0]!.id;
    expect(a).toBe(b);
  });
});
