/** Configuração de IA e ledger mensal UTC: reserva/consumo imutáveis por chamada, em transações curtas. */
import { randomUUID } from "node:crypto";
import type { IntelligenceState } from "@/src/domain/intelligence/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { jsonParameter } from "@/src/server/database/postgres";
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
type BudgetEvent = {
  aggregate_version: number;
  event_type: string;
  actor_id: string;
  payload: { period: string; reservedTokens?: number; actualTokens?: number };
};
const fields =
  "tenant_id, contracted, enabled, status, monthly_token_budget, used_tokens, aggregate_version, updated_at";
export class IntelligenceBudgetError extends Error {}
function stateFromRow(row: IntelligenceStateRow, budgetPeriod?: string): IntelligenceState {
  return {
    version: 1,
    tenantId: row.tenant_id,
    contracted: row.contracted,
    enabled: row.enabled,
    status: row.status,
    monthlyTokenBudget: Number(row.monthly_token_budget),
    usedTokens: Number(row.used_tokens),
    persistenceVersion: Number(row.aggregate_version),
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(budgetPeriod ? { budgetPeriod } : {}),
  };
}
function requireTransaction(db: DecisionDatabase) {
  if (!db.transaction) throw new IntelligenceBudgetError("O orçamento de IA exige uma transação persistente.");
  return db.transaction.bind(db);
}
function requireActor(actorId: string) {
  if (!actorId?.trim()) throw new IntelligenceBudgetError("O consumo de IA exige autoria da sessão.");
}
async function event(
  db: DecisionDatabase,
  tenantId: string,
  eventId: string,
  type: string,
  aggregateId: string,
  version: number,
  eventType: string,
  actorId: string,
  payload: object,
) {
  await db
    .prepare(
      `insert into private.domain_events (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(tenantId, eventId, type, aggregateId, version, eventType, actorId, jsonParameter(payload))
    .run();
}
async function updateUsage(db: DecisionDatabase, tenantId: string, actorId: string, used: number) {
  if (!Number.isSafeInteger(used) || used < 0)
    throw new IntelligenceBudgetError("Consumo de IA fora dos limites válidos.");
  const row = await db
    .prepare(
      `update private.intelligence_states set used_tokens = ?, aggregate_version = aggregate_version + 1, updated_by = ?, updated_at = now() where tenant_id = ? returning ${fields}`,
    )
    .bind(used, actorId, tenantId)
    .first<IntelligenceStateRow>();
  if (!row) throw new IntelligenceBudgetError("Configuração de IA não encontrada.");
  return row;
}
/** Usa o contador legado conservadoramente no primeiro mês; nunca zera sem marcador auditável. */
async function lockedMonth(db: DecisionDatabase, tenantId: string, actorId: string) {
  let row = await db
    .prepare(`select ${fields} from private.intelligence_states where tenant_id = ? for update`)
    .bind(tenantId)
    .first<IntelligenceStateRow>();
  if (!row) return null;
  const current = await db
    .prepare(
      `select aggregate_version, payload from private.domain_events where tenant_id = ? and aggregate_type = 'IntelligenceBudgetPeriod' and aggregate_id = 'UTC' order by aggregate_version desc limit 1`,
    )
    .bind(tenantId)
    .first<BudgetEvent>();
  const period = new Date().toISOString().slice(0, 7);
  if (current && (!/^\d{4}-\d{2}$/.test(current.payload.period) || current.payload.period > period))
    throw new IntelligenceBudgetError("Competência UTC inconsistente. Verifique o relógio do servidor.");
  if (!current || current.payload.period < period) {
    const previousUsedTokens = Number(row.used_tokens),
      carriedTokens = current ? 0 : previousUsedTokens;
    row = await updateUsage(db, tenantId, actorId, carriedTokens);
    await event(
      db,
      tenantId,
      `ai-month:${randomUUID()}`,
      "IntelligenceBudgetPeriod",
      "UTC",
      Number(current?.aggregate_version ?? 0) + 1,
      "AI_BUDGET_MONTH_OPENED",
      actorId,
      { period, previousPeriod: current?.payload.period ?? null, previousUsedTokens, carriedTokens, timeZone: "UTC" },
    );
  }
  return { row, period };
}
export async function loadIntelligenceState(db: DecisionDatabase, tenantId: string, actorId: string) {
  requireActor(actorId);
  return requireTransaction(db)(async transaction => {
    const month = await lockedMonth(transaction, tenantId, actorId);
    return month ? stateFromRow(month.row, month.period) : null;
  });
}
export async function saveIntelligenceState(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  state: IntelligenceState,
) {
  const row = await db
    .prepare(
      `insert into private.intelligence_states (tenant_id, contracted, enabled, status, monthly_token_budget, used_tokens, updated_by) values (?, ?, ?, ?, ?, ?, ?) on conflict (tenant_id) do update set contracted = excluded.contracted, enabled = excluded.enabled, status = excluded.status, monthly_token_budget = excluded.monthly_token_budget, used_tokens = private.intelligence_states.used_tokens, aggregate_version = private.intelligence_states.aggregate_version + 1, updated_by = excluded.updated_by, updated_at = now() returning ${fields}`,
    )
    .bind(tenantId, state.contracted, state.enabled, state.status, state.monthlyTokenBudget, 0, actorId)
    .first<IntelligenceStateRow>();
  if (!row) throw new Error("A configuração de IA não foi gravada.");
  return stateFromRow(row);
}
/** Consulta a decisão persistida: reinício do processo ou resposta de commit perdida não duplica ajuste. */
export async function settleIntelligenceReservation(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  reservationId: string,
  actualTokens: number,
) {
  requireActor(actorId);
  if (!Number.isSafeInteger(actualTokens) || actualTokens <= 0) return;
  await requireTransaction(db)(async transaction => {
    const month = await lockedMonth(transaction, tenantId, actorId);
    if (!month) throw new IntelligenceBudgetError("Configuração de IA não encontrada.");
    const reserved = await transaction
      .prepare(
        `select aggregate_version, event_type, actor_id, payload from private.domain_events where tenant_id = ? and aggregate_type = 'IntelligenceBudgetReservation' and aggregate_id = ? order by aggregate_version desc limit 1`,
      )
      .bind(tenantId, reservationId)
      .first<BudgetEvent>();
    if (!reserved || reserved.actor_id !== actorId)
      throw new IntelligenceBudgetError("Reserva de IA não encontrada para esta sessão.");
    if (reserved.event_type === "AI_TOKENS_SETTLED") {
      if (reserved.payload.actualTokens !== actualTokens)
        throw new IntelligenceBudgetError("A reserva já foi liquidada com outro consumo.");
      return;
    }
    if (reserved.event_type !== "AI_TOKENS_RESERVED" || !Number.isSafeInteger(reserved.payload.reservedTokens))
      throw new IntelligenceBudgetError("Reserva de IA inválida.");
    const currentPeriod = reserved.payload.period === month.period;
    if (currentPeriod)
      await updateUsage(
        transaction,
        tenantId,
        actorId,
        Number(month.row.used_tokens) - Number(reserved.payload.reservedTokens) + actualTokens,
      );
    await event(
      transaction,
      tenantId,
      `ai-settled:${reservationId}`,
      "IntelligenceBudgetReservation",
      reservationId,
      2,
      "AI_TOKENS_SETTLED",
      actorId,
      { ...reserved.payload, actualTokens, adjustedCurrentPeriod: currentPeriod, settledInPeriod: month.period },
    );
  });
}
/** Reserva confirmada antes do provedor; falha ambígua ou uso inválido mantém integralmente o débito. */
export async function reserveIntelligenceTokens(
  db: DecisionDatabase,
  tenantId: string,
  tokens: number,
  actorId: string,
) {
  requireActor(actorId);
  if (!Number.isSafeInteger(tokens) || tokens <= 0) throw new IntelligenceBudgetError("Reserva de IA inválida.");
  const reservationId = randomUUID();
  const period = await requireTransaction(db)(async transaction => {
    const month = await lockedMonth(transaction, tenantId, actorId);
    const budget = Number(month?.row.monthly_token_budget),
      used = Number(month?.row.used_tokens);
    if (
      !month ||
      !month.row.contracted ||
      !month.row.enabled ||
      !Number.isSafeInteger(budget) ||
      !Number.isSafeInteger(used) ||
      used > budget - tokens
    )
      throw new IntelligenceBudgetError("IA sem licença, desativada ou sem saldo para esta solicitação.");
    await updateUsage(transaction, tenantId, actorId, used + tokens);
    await event(
      transaction,
      tenantId,
      `ai-reserved:${reservationId}`,
      "IntelligenceBudgetReservation",
      reservationId,
      1,
      "AI_TOKENS_RESERVED",
      actorId,
      { period: month.period, reservedTokens: tokens },
    );
    return month.period;
  });
  return {
    reservationId,
    period,
    reservedTokens: tokens,
    settle: (actualTokens: number) => settleIntelligenceReservation(db, tenantId, actorId, reservationId, actualTokens),
  };
}
