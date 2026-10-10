import { demoAdminUser, buildDailyBriefing, operationsForUser } from "@/src/domain/copilot/daily-briefing";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { describe, expect, it } from "vitest";
import { managerOf, repAt } from "@/src/domain/commercial/rules";
import { seedCommercial } from "@/src/domain/commercial/seed";

const financials = Object.fromEntries(
  initialOperations.map(operation => [
    operation.id,
    { face: operation.amount, discount: 1000, fees: 100, revenue: 1100, rate: 2, net: operation.netAmount },
  ]),
);

describe("abertura diária do Copiloto", () => {
  const commercial = seedCommercial();
  const scope = {
    referenceDate: "2026-10-10",
    repOfCedent: (document: string, date: string) => repAt(commercial, document, date),
    managerOfCedent: (document: string) => managerOf(commercial, document),
  };
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

  it("entrega ao agente comercial somente os cedentes da sua carteira", () => {
    const scoped = operationsForUser(
      initialOperations,
      {
        id: "user-rep-1",
        name: "Rafael Menezes",
        role: "Executivo comercial",
        department: "Comercial",
        access: "operator",
        responsibilities: ["Originação", "Relacionamento"],
        commercialRepId: "rep-1",
      },
      scope,
    );

    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every(operation => repAt(commercial, operation.document, "2026-10-10") === "rep-1")).toBe(true);
  });

  it("entrega ao gerente da conta os cedentes sob sua responsabilidade de pós-venda", () => {
    const scoped = operationsForUser(
      initialOperations,
      {
        id: "user-manager-3",
        name: "Bruno Teixeira",
        role: "Gerente de conta",
        department: "Comercial",
        access: "manager",
        responsibilities: ["Operações recorrentes", "Pós-venda"],
        accountManagerId: "rep-3",
      },
      scope,
    );

    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every(operation => managerOf(commercial, operation.document) === "rep-3")).toBe(true);
  });

  it("prioriza um vínculo nominal de cedente mesmo fora da carteira comercial", () => {
    const cedent = initialOperations[0];
    const scoped = operationsForUser(initialOperations, {
      id: "user-specialist",
      name: "Especialista",
      role: "Especialista de conta",
      department: "Operações",
      access: "operator",
      responsibilities: ["Conta estratégica"],
      cedentDocuments: [cedent.document],
    });

    expect(scoped.map(operation => operation.document)).toContain(cedent.document);
  });
});
