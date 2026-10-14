import { describe, expect, it } from "vitest";
import { buildNeeds, buildRiskAlerts } from "@/src/features/home/home-metrics-builders";
import type { Operation } from "@/src/domain/core/types";

describe("atalhos do painel geral para a carteira", () => {
  it("leva alerta de atraso/recompra à carteira filtrada, mesmo com operação ativa do cedente", () => {
    const operation = { id: "op-1", document: "12.345.678/0001-90" } as Operation;
    const alerts = buildRiskAlerts({
      cedExp: [
        {
          document: operation.document,
          name: "Cedente Teste",
          used: 10,
          limit: 1_000,
          usedLimit: 100,
          pipeline: 0,
          incidents: 0,
          score: 800,
        },
      ],
      debExp: [],
      titles: [
        {
          ownerDocument: operation.document,
          dueDate: "2026-08-01",
          amount: 500,
        },
      ],
      active: [operation],
      today: "2026-10-14",
    } as unknown as Parameters<typeof buildRiskAlerts>[0]);

    const alert = alerts.find(item => item.id.startsWith("late-"));
    expect(alert?.op).toBeUndefined();
    expect(alert?.portfolioFocus).toEqual({
      tab: "titulos",
      situation: "d30",
      query: operation.document,
    });
  });

  it("leva a pendência geral de vencidos à lista de títulos vencidos", () => {
    const needs = buildNeeds({
      active: [],
      fin: {},
      releasesToPay: [],
      overduePayables: [],
      overdueTitles: [{ dueDate: "2026-09-01" }],
      overdueTotal: 750,
      dueToday: { count: 0, amount: 0, titles: [] },
      pend: { pendingCount: 0, pendingAmount: 0, creditCount: 0, creditAmount: 0 },
      profile: "risco",
    } as unknown as Parameters<typeof buildNeeds>[0]);

    expect(needs.find(item => item.id === "tk-overdue")).toMatchObject({
      go: "portfolio",
      portfolioFocus: { tab: "titulos", situation: "vencidos" },
    });
  });
});
