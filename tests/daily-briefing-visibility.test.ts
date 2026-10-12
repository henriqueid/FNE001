import { dailyBriefingStorageKey, shouldAutoOpenDailyBriefing } from "@/src/features/shell/daily-briefing-visibility";
import { describe, expect, it } from "vitest";

describe("abertura do resumo do dia", () => {
  it("abre em todo login enquanto o usuário não pedir para ocultar no dia", () => {
    expect(shouldAutoOpenDailyBriefing(null, "2026-10-12")).toBe(true);
    expect(shouldAutoOpenDailyBriefing("2026-10-11", "2026-10-12")).toBe(true);
  });

  it("fica oculto apenas na data escolhida e volta no dia seguinte", () => {
    expect(shouldAutoOpenDailyBriefing("2026-10-12", "2026-10-12")).toBe(false);
    expect(shouldAutoOpenDailyBriefing("2026-10-12", "2026-10-13")).toBe(true);
  });

  it("mantém a preferência separada por usuário", () => {
    expect(dailyBriefingStorageKey("admin")).not.toBe(dailyBriefingStorageKey("operador"));
  });
});
