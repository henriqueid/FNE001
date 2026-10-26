/** Administração transacional dos limites; usuários e consumo vêm exclusivamente do servidor. */
import { randomUUID } from "node:crypto";
import { emptyIntelligenceState } from "@/src/domain/intelligence/model";
import { validateBudgetInput, type AIBudgetSnapshot, type AIBudgetUser } from "@/src/domain/intelligence/budget";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { jsonParameter } from "@/src/server/database/postgres";
import { lockedIntelligenceMonth, ensureIntelligenceState } from "./repository";
import {
  AIBudgetConfigurationError,
  AIBudgetConflictError,
  readBudgetPolicy,
  readUserTokenUsage,
} from "./budget-policy";

type Member = { user_id: string; name: string; status: string };
async function members(db: DecisionDatabase, tenantId: string) {
  return (
    await db
      .prepare(
        "select u.user_id, u.name, u.status from private.access_users u join private.tenant_memberships m on m.user_id = u.user_id where m.tenant_id = ? order by u.name",
      )
      .bind(tenantId)
      .all<Member>()
  ).results;
}
function transactionFor(db: DecisionDatabase, actorId: string) {
  if (!actorId?.trim() || !db.transaction)
    throw new AIBudgetConfigurationError("A configuração exige sessão e transação persistente.");
  return db.transaction.bind(db);
}
async function snapshot(
  db: DecisionDatabase,
  tenantId: string,
  period: string,
  monthlyTokenBudget: number,
  usedTokens: number,
): Promise<AIBudgetSnapshot> {
  const policy = await readBudgetPolicy(db, tenantId, monthlyTokenBudget);
  const usage = await readUserTokenUsage(db, tenantId, period);
  const users: AIBudgetUser[] = (await members(db, tenantId)).map(user => ({
    userId: user.user_id,
    name: user.name,
    status: user.status,
    usedTokens: usage.find(item => item.userId === user.user_id)?.usedTokens ?? 0,
  }));
  for (const item of [
    ...usage,
    ...policy.allocations.map(allocation => ({
      userId: allocation.userId,
      usedTokens: usage.find(entry => entry.userId === allocation.userId)?.usedTokens ?? 0,
    })),
  ])
    if (!users.some(user => user.userId === item.userId))
      users.push({ ...item, name: "Usuário sem vínculo atual", status: "removed" });
  return { policy: { ...policy, monthlyTokenBudget }, period, usedTokens, users };
}
export async function loadIntelligenceBudget(db: DecisionDatabase, tenantId: string, actorId: string) {
  return transactionFor(
    db,
    actorId,
  )(async transaction => {
    const month = await lockedIntelligenceMonth(transaction, tenantId, actorId);
    return snapshot(
      transaction,
      tenantId,
      month?.period ?? new Date().toISOString().slice(0, 7),
      Number(month?.row.monthly_token_budget ?? 0),
      Number(month?.row.used_tokens ?? 0),
    );
  });
}
export async function saveIntelligenceBudget(db: DecisionDatabase, tenantId: string, actorId: string, value: unknown) {
  const validation = validateBudgetInput(value);
  if (!validation.ok) throw new AIBudgetConfigurationError(validation.error);
  const input = validation.input;
  return transactionFor(
    db,
    actorId,
  )(async transaction => {
    let month = await lockedIntelligenceMonth(transaction, tenantId, actorId);
    if (!month) {
      await ensureIntelligenceState(transaction, tenantId, actorId, emptyIntelligenceState(tenantId));
      month = await lockedIntelligenceMonth(transaction, tenantId, actorId);
    }
    if (!month) throw new AIBudgetConfigurationError("Configuração de IA indisponível.");
    const current = await readBudgetPolicy(transaction, tenantId, Number(month.row.monthly_token_budget));
    if (current.version !== input.version)
      throw new AIBudgetConflictError("Os limites foram alterados por outra pessoa. Recarregue antes de salvar.");
    const directory = await members(transaction, tenantId);
    for (const item of input.allocations) {
      const user = directory.find(user => user.user_id === item.userId);
      if (!user || (item.monthlyTokenBudget > 0 && user.status !== "active"))
        throw new AIBudgetConfigurationError("Cota só pode ser atribuída a usuário ativo desta organização.");
    }
    await transaction
      .prepare(
        "update private.intelligence_states set monthly_token_budget = ?, aggregate_version = aggregate_version + 1, updated_by = ?, updated_at = now() where tenant_id = ?",
      )
      .bind(input.monthlyTokenBudget, actorId, tenantId)
      .run();
    await transaction
      .prepare(
        "insert into private.domain_events (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload) values (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        tenantId,
        `ai-policy:${randomUUID()}`,
        "IntelligenceBudgetPolicy",
        "monthly",
        current.version + 1,
        "AI_BUDGET_CONFIGURED",
        actorId,
        jsonParameter({
          mode: input.mode,
          allocations: input.allocations,
          monthlyTokenBudget: input.monthlyTokenBudget,
          previous: current,
        }),
      )
      .run();
    return snapshot(transaction, tenantId, month.period, input.monthlyTokenBudget, Number(month.row.used_tokens));
  });
}
