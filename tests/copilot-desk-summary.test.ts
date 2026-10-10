import { describe, expect, it } from "vitest";
import { deskDemoPolicy, deskDemoTitles } from "@/src/domain/copilot/desk-demo";
import { type DeskContext, firstScenario } from "@/src/domain/copilot/desk-engine";
import { buildDeskSummary } from "@/src/domain/copilot/desk-summary";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { portfolioTitles } from "@/src/domain/home/metrics";

const context: DeskContext = { titles: deskDemoTitles, policy: deskDemoPolicy, bureauChecked: true };
const scenario = firstScenario(context);
const cedent = initialCedents[0];
const portfolio = portfolioTitles(initialOperations);
const summary = buildDeskSummary(scenario, context, cedent, portfolio, "2026-10-09");

describe("Copiloto · resumo da operação", () => {
  it("a composição fecha no líquido do motor", () => {
    const [face, discount, fees, iof, net] = summary.waterfall.map(item => item.cents);
    expect(face - discount - fees - iof).toBe(net);
    expect(net).toBe(scenario.result.netCents);
  });

  it("sacados somam 100% da operação e cruzam com a carteira", () => {
    const total = summary.debtors.reduce((sum, item) => sum + item.operationShare, 0);
    expect(total).toBeCloseTo(100, 6);
    const known = summary.debtors.find(item => item.name === "Rede Mercantil Nacional S.A.");
    expect(known?.portfolioTitles).toBeGreaterThan(0);
    expect(summary.debtors.find(item => item.name === "Mercantil Boa Vista")?.flags).toContain("Sacado novo");
  });

  it("limite do cedente considera o já usado mais a operação", () => {
    expect(summary.limit?.availableAfterCents).toBe(
      Math.round(cedent.creditLimit * 100) - Math.round(cedent.usedLimit * 100) - scenario.result.faceCents,
    );
  });

  it("prazos cobrem todos os títulos e a checagem aponta duplicidade", () => {
    expect(summary.terms.reduce((sum, item) => sum + item.titles, 0)).toBe(scenario.result.count);
    expect(summary.checks.find(item => item.label === "Duplicidade na carteira")?.ok).toBe(false);
  });
});
