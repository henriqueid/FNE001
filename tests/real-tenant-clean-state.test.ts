import { buildAttentionItems } from "@/src/domain/copilot/attention-center";
import { demoAdminUser } from "@/src/domain/copilot/daily-briefing";
import { emptyEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { emptyIntegrationState } from "@/src/domain/integrations/model";
import { emptyIntelligenceState } from "@/src/domain/intelligence/model";
import { emptyOperationalDefaults } from "@/src/domain/registry/operational-profile";
import { describe, expect, it } from "vitest";

describe("organização real recém-criada", () => {
  it("não herda carteira, PDD nem notificações da demonstração", () => {
    const titles = portfolioTitles([], false);
    const notifications = buildAttentionItems({
      operations: [],
      titles,
      user: demoAdminUser,
      referenceDate: "2026-10-12",
    });

    expect(titles).toEqual([]);
    expect(notifications).toEqual([]);
  });

  it("nasce sem políticas, integrações, IA ou metas fictícias", () => {
    expect(emptyEligibilityPolicies().policies).toEqual([]);
    expect(emptyIntegrationState().providers.every(provider => provider.mode === "NAO_CONFIGURADA")).toBe(true);
    expect(emptyIntelligenceState()).toMatchObject({
      contracted: false,
      enabled: false,
      status: "AI_DISABLED",
      monthlyTokenBudget: 0,
    });
    expect(emptyOperationalDefaults().revenueGoals.consolidated).toEqual({ dia: 0, semana: 0, mes: 0 });
  });
});
