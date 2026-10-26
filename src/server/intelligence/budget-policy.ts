/** Política e uso por ator no ledger privado; chamadas não liquidadas mantêm a reserva integral. */
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { validateBudgetInput, type AIBudgetPolicy } from "@/src/domain/intelligence/budget";
export class AIBudgetConfigurationError extends Error {}
export class AIBudgetConflictError extends AIBudgetConfigurationError {}

export async function readBudgetPolicy(
  db: DecisionDatabase,
  tenantId: string,
  monthlyTokenBudget: number,
): Promise<AIBudgetPolicy> {
  const row = await db
    .prepare(
      "select aggregate_version, payload from private.domain_events where tenant_id = ? and aggregate_type = 'IntelligenceBudgetPolicy' and aggregate_id = 'monthly' order by aggregate_version desc limit 1",
    )
    .bind(tenantId)
    .first<{ aggregate_version: number; payload: object }>();
  if (!row) return { mode: "shared", allocations: [], version: 0 };
  const result = validateBudgetInput({ ...row.payload, monthlyTokenBudget, version: Number(row.aggregate_version) });
  if (!result.ok)
    throw new AIBudgetConfigurationError(
      "Política de consumo de IA inconsistente. Revise os limites em Configurações.",
    );
  return result.input;
}

export async function readUserTokenUsage(db: DecisionDatabase, tenantId: string, period: string) {
  const rows = await db
    .prepare(
      `select actor_id as user_id, sum(case when event_type = 'AI_TOKENS_SETTLED' then (payload->>'actualTokens')::bigint else (payload->>'reservedTokens')::bigint end)::text as used_tokens
    from (select distinct on (aggregate_id) actor_id, event_type, payload from private.domain_events
      where tenant_id = ? and aggregate_type = 'IntelligenceBudgetReservation' and payload->>'period' = ?
      order by aggregate_id, aggregate_version desc) as reservations group by actor_id`,
    )
    .bind(tenantId, period)
    .all<{ user_id: string; used_tokens: string | number }>();
  return rows.results.map(row => {
    const usedTokens = Number(row.used_tokens);
    if (!Number.isSafeInteger(usedTokens) || usedTokens < 0)
      throw new AIBudgetConfigurationError("Consumo individual de IA inconsistente.");
    return { userId: row.user_id, usedTokens };
  });
}
