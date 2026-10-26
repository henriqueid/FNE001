import { describe, expect, it } from "vitest";
import { emptyIntelligenceState } from "@/src/domain/intelligence/model";
import { saveIntelligenceState } from "@/src/server/intelligence/repository";

import { IntelligenceDatabase } from "./helpers/intelligence-database";
function fakeDatabase(initialUsed: number) {
  const db = new IntelligenceDatabase();
  db.row.tenant_id = "strato-demo";
  db.row.used_tokens = initialUsed;
  return { db, row: db.row };
}

describe("consumo de IA contabilizado no servidor", () => {
  it("a gravação da configuração não reduz o contador do servidor", async () => {
    const { db, row } = fakeDatabase(900);
    const stale = {
      ...emptyIntelligenceState(),
      contracted: true,
      enabled: true,
      monthlyTokenBudget: 5_000,
      persistenceVersion: row.aggregate_version,
    };
    const saved = await saveIntelligenceState(db, "strato-demo", "gestor", { ...stale, usedTokens: 0 });
    expect(saved.usedTokens).toBe(900);
    expect(saved.monthlyTokenBudget).toBe(5_000);
    expect(row.used_tokens).toBe(900);
  });
});
