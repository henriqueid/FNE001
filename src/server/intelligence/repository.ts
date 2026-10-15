import type { IntelligenceState } from "@/src/domain/intelligence/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

type IntelligenceStateRow = {
  tenant_id: string;
  contracted: boolean;
  enabled: boolean;
  status: IntelligenceState["status"];
  monthly_token_budget: number | string;
  used_tokens: number | string;
  aggregate_version: number | string;
  updated_at: string | Date;
};

const number = (value: number | string) => Number(value);

function stateFromRow(row: IntelligenceStateRow): IntelligenceState {
  return {
    version: 1,
    tenantId: row.tenant_id,
    contracted: row.contracted,
    enabled: row.enabled,
    status: row.status,
    monthlyTokenBudget: number(row.monthly_token_budget),
    usedTokens: number(row.used_tokens),
    persistenceVersion: number(row.aggregate_version),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function loadIntelligenceState(db: DecisionDatabase, tenantId: string) {
  const row = await db
    .prepare(
      `select tenant_id, contracted, enabled, status, monthly_token_budget, used_tokens,
              aggregate_version, updated_at
         from private.intelligence_states
        where tenant_id = ?`,
    )
    .bind(tenantId)
    .first<IntelligenceStateRow>();
  return row ? stateFromRow(row) : null;
}

export async function saveIntelligenceState(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  state: IntelligenceState,
) {
  const row = await db
    .prepare(
      `insert into private.intelligence_states
         (tenant_id, contracted, enabled, status, monthly_token_budget, used_tokens, updated_by)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict (tenant_id) do update set
         contracted = excluded.contracted,
         enabled = excluded.enabled,
         status = excluded.status,
         monthly_token_budget = excluded.monthly_token_budget,
         used_tokens = excluded.used_tokens,
         aggregate_version = private.intelligence_states.aggregate_version + 1,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning tenant_id, contracted, enabled, status, monthly_token_budget, used_tokens,
                 aggregate_version, updated_at`,
    )
    .bind(tenantId, state.contracted, state.enabled, state.status, state.monthlyTokenBudget, state.usedTokens, actorId)
    .first<IntelligenceStateRow>();
  if (!row) throw new Error("A configuração de IA não foi gravada.");
  return stateFromRow(row);
}
