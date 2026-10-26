/** Política auditável, distribuição e proteção contra gravações antigas. */
import { expect, it } from "vitest";
import { distributeBudgetEqually, validateBudgetInput } from "@/src/domain/intelligence/budget";
import { loadIntelligenceBudget, saveIntelligenceBudget } from "@/src/server/intelligence/budget-configuration";
import { saveIntelligenceState } from "@/src/server/intelligence/repository";
import { seedIntelligenceState } from "@/src/domain/intelligence/model";
import { IntelligenceDatabase } from "./helpers/intelligence-database";
const input = {
  mode: "allocated" as const,
  version: 0,
  monthlyTokenBudget: 100,
  allocations: [
    { userId: "actor-a", monthlyTokenBudget: 60 },
    { userId: "actor-b", monthlyTokenBudget: 40 },
  ],
};
it("divide 10 mil entre dez usuários e conserva restos sem perder tokens", () => {
  expect(
    distributeBudgetEqually(
      10000,
      Array.from({ length: 10 }, (_, i) => `u${i}`),
    ).every(item => item.monthlyTokenBudget === 1000),
  ).toBe(true);
  expect(distributeBudgetEqually(10, ["b", "a", "c"])).toEqual([
    { userId: "a", monthlyTokenBudget: 4 },
    { userId: "b", monthlyTokenBudget: 3 },
    { userId: "c", monthlyTokenBudget: 3 },
  ]);
});
it.each([
  { ...input, monthlyTokenBudget: 99 },
  { ...input, monthlyTokenBudget: NaN },
  { ...input, allocations: [{ userId: "a", monthlyTokenBudget: 1.5 }] },
  {
    ...input,
    allocations: [
      { userId: "a", monthlyTokenBudget: 1 },
      { userId: "a", monthlyTokenBudget: 1 },
    ],
  },
])("recusa cotas inválidas: %j", candidate => {
  expect(validateBudgetInput(candidate).ok).toBe(false);
});
it("grava teto e política juntos sem apagar uso anterior", async () => {
  const db = new IntelligenceDatabase();
  db.row.used_tokens = 30;
  const result = await saveIntelligenceBudget(db, "tenant-a", "admin", input);
  expect(result).toMatchObject({ policy: { version: 1, mode: "allocated" }, usedTokens: 30 });
  expect(db.events.find(e => e.event_type === "AI_BUDGET_CONFIGURED")).toMatchObject({
    actor_id: "admin",
    payload: { monthlyTokenBudget: 100 },
  });
});
it("recusa usuário de outro tenant e usuário suspenso com cota positiva", async () => {
  const db = new IntelligenceDatabase();
  await expect(
    saveIntelligenceBudget(db, "tenant-a", "admin", {
      ...input,
      allocations: [{ userId: "foreign", monthlyTokenBudget: 10 }],
    }),
  ).rejects.toThrow(/usuário/i);
  await expect(
    saveIntelligenceBudget(db, "tenant-a", "admin", {
      ...input,
      allocations: [{ userId: "suspended", monthlyTokenBudget: 10 }],
    }),
  ).rejects.toThrow(/usuário/i);
  expect(db.events).toHaveLength(0);
});
it("edição concorrente não sobrescreve configuração mais recente", async () => {
  const db = new IntelligenceDatabase();
  await saveIntelligenceBudget(db, "tenant-a", "admin", input);
  await expect(saveIntelligenceBudget(db, "tenant-a", "admin", { ...input, monthlyTokenBudget: 200 })).rejects.toThrow(
    /alterad|atualiz/i,
  );
  expect(db.row.monthly_token_budget).toBe(100);
});
it("falha no evento de política desfaz teto e preserva consumo", async () => {
  const db = new IntelligenceDatabase();
  db.failEvent = true;
  await expect(
    saveIntelligenceBudget(db, "tenant-a", "admin", { ...input, monthlyTokenBudget: 200 }),
  ).rejects.toThrow();
  expect(db.row.monthly_token_budget).toBe(100);
  expect(db.events).toHaveLength(0);
});
it("salvar licença antiga não restabelece o teto nem apaga cotas", async () => {
  const db = new IntelligenceDatabase();
  await saveIntelligenceBudget(db, "tenant-a", "admin", input);
  await saveIntelligenceState(db, "tenant-a", "admin", {
    ...seedIntelligenceState(),
    monthlyTokenBudget: 999,
    persistenceVersion: db.row.aggregate_version,
  });
  expect((await loadIntelligenceBudget(db, "tenant-a", "admin")).policy).toMatchObject({
    monthlyTokenBudget: 100,
    version: 1,
    mode: "allocated",
  });
});

it("save legado aguarda primeira distribuição em andamento antes de decidir o teto", async () => {
  const db = new IntelligenceDatabase();
  let entered!: () => void, release!: () => void;
  const ready = new Promise<void>(resolve => {
    entered = resolve;
  });
  const hold = new Promise<void>(resolve => {
    release = resolve;
  });
  const configuration = db.transaction(async () => {
    entered();
    await hold;
    db.row.monthly_token_budget = 60;
    db.events.push({
      tenant_id: "tenant-a",
      event_id: "concurrent-policy",
      aggregate_type: "IntelligenceBudgetPolicy",
      aggregate_id: "monthly",
      aggregate_version: 1,
      event_type: "AI_BUDGET_CONFIGURED",
      actor_id: "admin",
      payload: { mode: "allocated", allocations: [{ userId: "actor-a", monthlyTokenBudget: 60 }] },
    });
  });
  await ready;
  let completed = false;
  const legacy = saveIntelligenceState(db, "tenant-a", "admin", {
    ...seedIntelligenceState(),
    monthlyTokenBudget: 999,
    persistenceVersion: db.row.aggregate_version,
  }).then(() => {
    completed = true;
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(completed).toBe(false);
  } finally {
    release();
    await configuration;
    await legacy;
  }
  expect(db.row.monthly_token_budget).toBe(60);
});
