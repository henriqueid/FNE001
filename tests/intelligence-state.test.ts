import { describe, expect, it } from "vitest";
import { emptyIntelligenceState, effectiveAIStatus, validateIntelligenceState } from "@/src/domain/intelligence/model";

describe("configuração persistente de inteligência", () => {
  it("vincula a configuração validada à empresa autenticada", () => {
    const state = {
      ...emptyIntelligenceState("tenant-injetado"),
      contracted: true,
      enabled: true,
      status: "AI_AVAILABLE" as const,
      monthlyTokenBudget: 250_000,
    };

    expect(validateIntelligenceState(state, "tenant-autenticado")).toMatchObject({
      ok: true,
      state: {
        tenantId: "tenant-autenticado",
        contracted: true,
        enabled: true,
        status: "AI_AVAILABLE",
        monthlyTokenBudget: 250_000,
      },
    });
  });

  it("rejeita ativação sem licença e valores de orçamento inválidos", () => {
    expect(
      validateIntelligenceState({ ...emptyIntelligenceState(), enabled: true, monthlyTokenBudget: 100 }, "strato-demo"),
    ).toMatchObject({ ok: false });
    expect(
      validateIntelligenceState({ ...emptyIntelligenceState(), monthlyTokenBudget: -1 }, "strato-demo"),
    ).toMatchObject({ ok: false });
  });

  it("mantém o limite de tokens como bloqueio efetivo", () => {
    const state = {
      ...emptyIntelligenceState(),
      contracted: true,
      enabled: true,
      status: "AI_AVAILABLE" as const,
      monthlyTokenBudget: 100,
      usedTokens: 100,
    };
    expect(effectiveAIStatus(state)).toBe("AI_UNAVAILABLE");
  });
});
