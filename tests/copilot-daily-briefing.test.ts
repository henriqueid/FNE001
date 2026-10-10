import { demoAdminUser, buildDailyBriefing, operationsForUser } from "@/src/domain/copilot/daily-briefing";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { describe, expect, it } from "vitest";

const financials = Object.fromEntries(
  initialOperations.map(operation => [
    operation.id,
    { face: operation.amount, discount: 1000, fees: 100, revenue: 1100, rate: 2, net: operation.netAmount },
  ]),
);

describe("abertura diária do Copiloto", () => {
  it("entrega visão consolidada ao administrador", () => {
    const briefing = buildDailyBriefing({
      user: demoAdminUser,
      operations: initialOperations,
      financials,
      titles: portfolioTitles(initialOperations),
      referenceDate: "2026-10-10",
      revenueTarget: 600_000,
    });

    expect(briefing.scopeLabel).toBe("Visão consolidada");
    expect(briefing.portfolioTotal).toBeGreaterThan(0);
    expect(briefing.priorities.some(priority => priority.id === "decisions")).toBe(true);
    expect(briefing.revenueRemaining).toBeGreaterThanOrEqual(0);
  });

  it("restringe operações ao departamento e vínculo do operador", () => {
    const owned = initialOperations[0];
    const scoped = operationsForUser(initialOperations, {
      id: "operador-1",
      name: "Ana",
      role: "Analista operacional",
      department: "Operações",
      access: "operator",
      responsibilities: ["Esteira"],
      operationOwner: owned.owner,
    });

    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every(operation => operation.owner === owned.owner)).toBe(true);
    expect(scoped.length).toBeLessThan(initialOperations.length);
  });
});
