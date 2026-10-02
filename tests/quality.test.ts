import { describe, expect, it } from "vitest";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { demoCedentHistories, lastMonths } from "@/src/domain/core/demo/quality-history";
import { collectionMonth, concentration, rollRates, vintages } from "@/src/domain/risk/portfolio-dynamics";
import {
  componentScore,
  qualityRankings,
  qualityTrend,
  reasonText,
  type QualityHistory,
  type QualityMonth,
} from "@/src/domain/risk/quality";
import { demoQualityPolicy, type QualityComponentRule } from "@/src/domain/risk/quality-policy";

const month = (m: string, over: Partial<QualityMonth> = {}): QualityMonth => ({
  month: m,
  acquired: 100_000,
  settled: 100_000,
  settledOnTime: 96_000,
  averageDelay: 3,
  repurchased: 1_000,
  extended: 2_000,
  openBalance: 200_000,
  overdue30: 1_000,
  buckets: [180_000, 10_000, 5_000, 3_000, 2_000],
  topDebtorShare: 15,
  protests: 0,
  limitUse: 50,
  bureauScore: 800,
  ...over,
});

describe("índice de qualidade", () => {
  it("nota do componente é linear entre ruim e bom, nos dois sentidos", () => {
    const delay = demoQualityPolicy.components.find(c => c.id === "averageDelay") as QualityComponentRule;
    expect(componentScore(delay, delay.good)).toBe(1);
    expect(componentScore(delay, delay.bad)).toBe(0);
    expect(componentScore(delay, (delay.good + delay.bad) / 2)).toBeCloseTo(0.5);
    const onTime = demoQualityPolicy.components.find(c => c.id === "onTimeRate") as QualityComponentRule;
    expect(componentScore(onTime, 100)).toBe(1);
    expect(componentScore(onTime, 50)).toBe(0);
  });

  it("detecta piora e explica com o componente que mais pesou", () => {
    const months = ["2026-04", "2026-05", "2026-06"].map(m => month(m));
    const worse = ["2026-07", "2026-08", "2026-09"].map(m => month(m, { averageDelay: 14, settledOnTime: 80_000 }));
    const h: QualityHistory = {
      id: "x",
      name: "X",
      document: "1",
      kind: "cedente",
      exposure: 1,
      months: [...months, ...worse],
    };
    const t = qualityTrend(h, demoQualityPolicy);
    expect(t.delta).toBeLessThan(-demoQualityPolicy.minDelta);
    expect(t.reasons[0].impact).toBeLessThan(0);
    expect(t.reasons.map(r => r.component)).toEqual(expect.arrayContaining(["onTimeRate", "averageDelay"]));
    expect(t.reasons.find(r => r.component === "averageDelay")?.text).toBe("Atraso médio subiu de 3 dias para 14 dias");
  });

  it("melhora abaixo do patamar saudável vira acompanhamento, não aumento de limite", () => {
    const bad = ["2026-04", "2026-05", "2026-06"].map(m => month(m, { averageDelay: 25, settledOnTime: 60_000 }));
    const less = ["2026-07", "2026-08", "2026-09"].map(m => month(m, { averageDelay: 15, settledOnTime: 70_000 }));
    const h: QualityHistory = { id: "y", name: "Y", document: "2", kind: "cedente", exposure: 1, months: [...bad, ...less] };
    const t = qualityTrend(h, demoQualityPolicy);
    expect(t.delta).toBeGreaterThan(0);
    expect(t.index).toBeLessThan(demoQualityPolicy.healthyIndex);
    expect(t.action).toMatch(/acompanhar/);
  });

  it("escreve motivos de contagem sem frações", () => {
    const rule = demoQualityPolicy.components.find(c => c.id === "protests") as QualityComponentRule;
    expect(reasonText(rule, 0, 2)).toBe("2 protestos e apontamentos a mais (2 na janela)");
  });

  it("rankings respeitam a variação mínima e o tamanho da política", () => {
    const histories = demoCedentHistories(initialCedents, "2026-10-02");
    const r = qualityRankings(histories, { ...demoQualityPolicy, rankingSize: 3 });
    expect(r.worsening.length).toBeGreaterThan(0);
    expect(r.improving.length).toBeGreaterThan(0);
    expect(r.worsening.length).toBeLessThanOrEqual(3);
    r.worsening.forEach(t => expect(t.delta).toBeLessThanOrEqual(-demoQualityPolicy.minDelta));
    r.improving.forEach(t => expect(t.delta).toBeGreaterThanOrEqual(demoQualityPolicy.minDelta));
    expect(r.worsening.every(t => t.reasons.length > 0)).toBe(true);
  });
});

describe("dinâmica da carteira", () => {
  const histories = demoCedentHistories(initialCedents, "2026-10-02");
  it("meses terminam no mês corrente", () => {
    expect(lastMonths("2026-01-15", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
  it("rolagem fica entre 0 e 100%", () => {
    const rr = rollRates(histories);
    expect(rr).toHaveLength(5);
    rr.forEach(r =>
      r.rates.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }),
    );
  });
  it("safra mais antiga tem a curva mais longa", () => {
    const v = vintages(histories);
    expect(v[0].curve).toHaveLength(5);
    expect(v[5].curve).toHaveLength(0);
  });
  it("HHI de carteira pulverizada é baixo e de carteira concentrada é alto", () => {
    expect(concentration(Array.from({ length: 50 }, (_, i) => ({ name: `${i}`, amount: 1 }))).hhi).toBeCloseTo(200);
    expect(
      concentration([
        { name: "a", amount: 9 },
        { name: "b", amount: 1 },
      ]).hhi,
    ).toBeCloseTo(8200);
  });
  it("cobrança do mês soma os clientes", () => {
    const c = collectionMonth(histories);
    expect(c.onTimeRate).toBeGreaterThan(0);
    expect(c.upTo5Rate).toBeGreaterThanOrEqual(c.onTimeRate);
  });
});
