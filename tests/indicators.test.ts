import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { commercialIndicators } from "@/src/domain/indicators/commercial";
import { originationIndicators } from "@/src/domain/indicators/origination";
import { pipelineIndicators } from "@/src/domain/indicators/pipeline";
import { daysFrom, portfolioIndicators } from "@/src/domain/indicators/portfolio";
import { registryIndicators } from "@/src/domain/indicators/registry";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { demoQualityPolicy, provisionRate } from "@/src/domain/risk/quality-policy";

const P = demoQualityPolicy.indicators;

describe("provisão pelas faixas da política", () => {
  it("usa a maior faixa alcançada e zero para quem não venceu", () => {
    expect(provisionRate(0, P.provisionBands)).toBe(0);
    expect(provisionRate(15, P.provisionBands)).toBe(1);
    expect(provisionRate(45, P.provisionBands)).toBe(10);
    expect(provisionRate(400, P.provisionBands)).toBe(100);
  });
});

describe("indicadores da carteira", () => {
  const state = seedPortfolio(initialOperations);
  it("separa vencidos por faixa sem perder coerência", () => {
    const i = portfolioIndicators(state.titles, "2026-10-02", P.provisionBands);
    expect(i.total).toBeGreaterThan(0);
    expect(i.overdue30).toBeLessThanOrEqual(i.overdue);
    expect(i.overdue60).toBeLessThanOrEqual(i.overdue30);
    expect(i.overdue90).toBeLessThanOrEqual(i.overdue60);
    expect(i.provision).toBeLessThanOrEqual(i.overdue + 0.01);
    expect(i.top10DebtorShare).toBeLessThanOrEqual(100.0001);
  });
  it("conta dias corridos", () => {
    expect(daysFrom("2026-09-30", "2026-10-02")).toBe(2);
  });
});

describe("originação e esteira", () => {
  it("ticket, prazo e spread pela precificação da operação", () => {
    const o = originationIndicators(initialOperations.slice(0, 2), () => "2026-09-25");
    expect(o.ticket).toBeCloseTo((initialOperations[0].amount + initialOperations[1].amount) / 2);
    expect(o.rate).toBeGreaterThan(0);
    expect(o.fundingCost).toBeGreaterThan(0);
    expect(o.spread).toBeCloseTo(o.rate - o.fundingCost);
    expect(o.term).toBeGreaterThan(0);
  });
  it("funil soma as operações em andamento", () => {
    const p = pipelineIndicators(initialOperations);
    expect(p.funnel.reduce((s, f) => s + f.count, 0)).toBe(p.activeCount);
    expect(p.conversion).toBeGreaterThanOrEqual(0);
  });
});

describe("comercial e cadastro", () => {
  it("funil ponderado nunca passa do potencial bruto", () => {
    const c = commercialIndicators(seedCommercial("2026-09-30"), "2026-09-30", P);
    expect(c.weightedPipeline).toBeLessThanOrEqual(c.pipeline);
    expect(c.idle1.length + c.idle2.length + c.idle3.length).toBeLessThanOrEqual(c.activeClients);
  });
  it("revisão cadastral vencida e a vencer", () => {
    const r = registryIndicators(
      [
        { document: "1", name: "Antigo", updatedAt: "2025-01-01", isCedent: true, score: 450 },
        { document: "2", name: "Quase", updatedAt: "2025-10-20", isCedent: true, score: 820 },
        { document: "3", name: "Novo", updatedAt: "2026-09-01", isCedent: false },
      ],
      [],
      { "2": "2026-09-20" },
      "2026-10-02",
      P,
      { good: 800, bad: 500 },
    );
    expect(r.kycExpired.map(p => p.name)).toEqual(["Antigo"]);
    expect(r.kycSoon.map(p => p.name)).toEqual(["Quase"]);
    expect(r.limitExpired).toHaveLength(2);
    expect(r.idle.map(p => p.name)).toEqual(["Antigo"]);
    expect(r.score).toEqual({ good: 1, fair: 0, weak: 0, bad: 1 });
  });
});
