import { describe, expect, it } from "vitest";
import { resolveCollectionCharges } from "@/src/domain/banking/charges";
describe("encargos de cobrança determinísticos", () => {
  it("converte 8% a.m. em centavos diários com mês comercial de 30 dias", () => {
    expect(resolveCollectionCharges({ monthlyInterestPercent: 8 }, 100000, "2026-11-01")).toEqual({
      dailyInterestCents: 267,
    });
    expect(resolveCollectionCharges({ monthlyInterestPercent: 8 }, 123456, "2026-11-01").dailyInterestCents).toBe(329);
  });
  it("mantém juros diários explícitos e juros zero", () => {
    expect(resolveCollectionCharges({ dailyInterestCents: 25 }, 100000, "2026-11-01").dailyInterestCents).toBe(25);
    expect(resolveCollectionCharges({ monthlyInterestPercent: 0 }, 100000, "2026-11-01").dailyInterestCents).toBe(0);
  });
  it("calcula início da multa por calendário sem depender do fuso do servidor", () => {
    expect(
      resolveCollectionCharges(
        { monthlyInterestPercent: 8, lateFinePercent: 2, lateFineDaysAfterDue: 1 },
        100000,
        "2026-12-31",
      ),
    ).toEqual({ dailyInterestCents: 267, lateFine: { percent: 2, from: "2027-01-01" } });
  });
  it.each([
    { monthlyInterestPercent: 8, dailyInterestCents: 0 },
    {},
    { monthlyInterestPercent: NaN },
    { monthlyInterestPercent: 8.001 },
    { dailyInterestCents: -1 },
    { dailyInterestCents: 0, lateFinePercent: 2 },
    { dailyInterestCents: 0, lateFinePercent: 100, lateFineDaysAfterDue: 1 },
  ])("recusa configuração ambígua ou incompleta: %j", config => {
    expect(() => resolveCollectionCharges(config, 100000, "2026-11-01")).toThrow();
  });
});
