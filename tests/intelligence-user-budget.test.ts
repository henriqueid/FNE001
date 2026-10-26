/** Limites individuais compartilham transação e ledger do teto geral. */
import { afterEach, expect, it, vi } from "vitest";
import { reserveIntelligenceTokens, loadIntelligenceState } from "@/src/server/intelligence/repository";
import { IntelligenceDatabase } from "./helpers/intelligence-database";

function allocated() {
  const db = new IntelligenceDatabase();
  db.events.push({
    tenant_id: "tenant-a",
    event_id: "policy-1",
    aggregate_type: "IntelligenceBudgetPolicy",
    aggregate_id: "monthly",
    aggregate_version: 1,
    event_type: "AI_BUDGET_CONFIGURED",
    actor_id: "admin",
    payload: {
      mode: "allocated",
      allocations: [
        { userId: "actor-a", monthlyTokenBudget: 60 },
        { userId: "actor-b", monthlyTokenBudget: 40 },
      ],
    },
  });
  return db;
}
afterEach(() => vi.useRealTimers());
it("não empresta saldo de outro usuário quando a cota individual acaba", async () => {
  const db = allocated();
  await reserveIntelligenceTokens(db, "tenant-a", 60, "actor-a");
  await expect(reserveIntelligenceTokens(db, "tenant-a", 1, "actor-a")).rejects.toThrow(/cota/);
  expect(db.row.used_tokens).toBe(60);
  await reserveIntelligenceTokens(db, "tenant-a", 40, "actor-b");
});
it("usuário sem cota é bloqueado inclusive quando existe saldo global", async () => {
  const db = allocated();
  await expect(reserveIntelligenceTokens(db, "tenant-a", 1, "admin")).rejects.toThrow(/cota/);
  expect(db.row.used_tokens).toBe(0);
});
it("duas chamadas simultâneas do mesmo usuário respeitam sua cota", async () => {
  const db = allocated();
  const results = await Promise.allSettled([
    reserveIntelligenceTokens(db, "tenant-a", 40, "actor-a"),
    reserveIntelligenceTokens(db, "tenant-a", 40, "actor-a"),
  ]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(db.row.used_tokens).toBe(40);
});
it("liquidação reduz uso individual uma única vez e libera somente saldo correto", async () => {
  const db = allocated();
  const call = await reserveIntelligenceTokens(db, "tenant-a", 60, "actor-a");
  await call.settle(20);
  await call.settle(20);
  await expect(reserveIntelligenceTokens(db, "tenant-a", 41, "actor-a")).rejects.toThrow(/cota/);
  await reserveIntelligenceTokens(db, "tenant-a", 40, "actor-a");
  expect(db.row.used_tokens).toBe(60);
});
it("renova cota UTC sem creditar liquidação antiga ao mês novo", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T23:59:59Z"));
  const db = allocated();
  const old = await reserveIntelligenceTokens(db, "tenant-a", 60, "actor-a");
  vi.setSystemTime(new Date("2026-11-01T00:00:01Z"));
  await reserveIntelligenceTokens(db, "tenant-a", 60, "actor-a");
  await old.settle(20);
  await expect(reserveIntelligenceTokens(db, "tenant-a", 1, "actor-a")).rejects.toThrow(/cota/);
  expect((await loadIntelligenceState(db, "tenant-a", "actor-a"))?.usedTokens).toBe(60);
});
