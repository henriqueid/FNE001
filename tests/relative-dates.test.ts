import { describe, expect, it } from "vitest";
import { DEMO_SHIFT_DAYS, shiftDateText, shiftDemoDates } from "@/src/domain/core/demo/relative-dates";

describe("datas relativas da demonstração", () => {
  it("não desloca nada sob os testes", () => {
    expect(DEMO_SHIFT_DAYS).toBe(0);
  });
  it("desloca ISO, data brasileira e prefixo do aditivo, virando mês e ano", () => {
    expect(shiftDateText("2026-09-30", 3)).toBe("2026-10-03");
    expect(shiftDateText("vence 30/12/2026, 15:42", 2)).toBe("vence 01/01/2027, 15:42");
    // o aditivo anda 5 dias a mais (25/09 → 30/09): as operações em andamento entram "hoje"
    expect(shiftDateText("20260925004", 2)).toBe("20261002004");
  });
  it("não mexe em textos que só parecem datas", () => {
    expect(shiftDateText("LIQ-2026-10428", 5)).toBe("LIQ-2026-10428");
    expect(shiftDateText("41260952927676000129550010000983411002468102", 5)).toBe(
      "41260952927676000129550010000983411002468102",
    );
  });
  it("copia objetos profundamente", () => {
    const seed = { a: [{ dueDate: "2026-09-30" }], n: 1 };
    const out = shiftDemoDates(seed, 1);
    expect(out).toEqual({ a: [{ dueDate: "2026-10-01" }], n: 1 });
    expect(seed.a[0].dueDate).toBe("2026-09-30");
  });
});
