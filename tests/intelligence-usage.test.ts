import { describe, expect, it } from "vitest";
import { emptyIntelligenceState } from "@/src/domain/intelligence/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { recordIntelligenceUsage, saveIntelligenceState } from "@/src/server/intelligence/repository";

/** Banco em memória com a semântica das duas instruções usadas pelo repositório de IA. */
function fakeDatabase(initialUsed: number) {
  const row = {
    tenant_id: "strato-demo",
    contracted: true,
    enabled: true,
    status: "AI_AVAILABLE",
    monthly_token_budget: 1_000,
    used_tokens: initialUsed,
    aggregate_version: 1,
    updated_at: "2026-10-15T00:00:00Z",
  };
  const db = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              if (query.includes("insert into private.intelligence_states")) {
                expect(query).toContain("used_tokens = private.intelligence_states.used_tokens");
                const [, contracted, enabled, status, budget] = values;
                Object.assign(row, {
                  contracted,
                  enabled,
                  status,
                  monthly_token_budget: budget,
                  aggregate_version: row.aggregate_version + 1,
                });
              } else if (query.includes("set used_tokens = used_tokens + ?")) {
                row.used_tokens += Number(values[0]);
              }
              return { ...row };
            },
          };
        },
      };
    },
  } as unknown as DecisionDatabase;
  return { db, row };
}

describe("consumo de IA contabilizado no servidor", () => {
  it("soma o consumo de forma atômica, sem depender do perfil de quem perguntou", async () => {
    const { db, row } = fakeDatabase(100);
    const state = await recordIntelligenceUsage(db, "strato-demo", 250);
    expect(state?.usedTokens).toBe(350);
    expect(row.used_tokens).toBe(350);
  });

  it("ignora consumo inválido ou zerado", async () => {
    const { db, row } = fakeDatabase(100);
    await recordIntelligenceUsage(db, "strato-demo", 0);
    await recordIntelligenceUsage(db, "strato-demo", -10);
    expect(row.used_tokens).toBe(100);
  });

  it("a gravação da configuração não reduz o contador do servidor", async () => {
    const { db, row } = fakeDatabase(900);
    const stale = { ...emptyIntelligenceState(), contracted: true, enabled: true, monthlyTokenBudget: 5_000 };
    const saved = await saveIntelligenceState(db, "strato-demo", "gestor", { ...stale, usedTokens: 0 });
    expect(saved.usedTokens).toBe(900);
    expect(saved.monthlyTokenBudget).toBe(5_000);
    expect(row.used_tokens).toBe(900);
  });
});
