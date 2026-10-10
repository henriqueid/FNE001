import { describe, expect, it } from "vitest";
import { buildRevenuePace } from "@/src/domain/home/revenue-pace";
import { type Operation } from "@/src/domain/core/types";

const operation = (id: string, date: string): Operation =>
  ({
    id,
    aditivoNumber: date.replaceAll("-", ""),
    status: "Em análise",
    amount: 100_000,
    cedent: "Cliente",
  }) as unknown as Operation;

describe("ritmo de receita", () => {
  it("distribui a meta mensal apenas entre dias úteis", () => {
    const pace = buildRevenuePace({
      operations: [],
      financials: {},
      period: "mes",
      referenceDate: "2026-10-10",
      target: 220_000,
    });
    expect(pace.days.filter(day => day.target > 0)).toHaveLength(22);
    expect(pace.dailyTarget).toBe(10_000);
    expect(pace.remainingDays).toBe(15);
  });

  it("separa dias atingidos e dias abaixo da meta", () => {
    const pace = buildRevenuePace({
      operations: [operation("a", "2026-10-01"), operation("b", "2026-10-02")],
      financials: {
        a: { face: 100_000, discount: 12_000, fees: 0, revenue: 12_000, rate: 2, net: 88_000 },
        b: { face: 100_000, discount: 4_000, fees: 0, revenue: 4_000, rate: 2, net: 96_000 },
      },
      period: "mes",
      referenceDate: "2026-10-03",
      target: 220_000,
    });
    expect(pace.metDays).toBe(1);
    expect(pace.missedDays).toBe(1);
    expect(pace.revenue).toBe(16_000);
  });
});
