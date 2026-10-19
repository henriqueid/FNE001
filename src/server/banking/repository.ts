/** Persistência append-only dos comandos/arquivos/eventos bancários na transação financeira. */
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { jsonParameter } from "@/src/server/database/postgres";
export async function bankingHash(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, "0")).join("");
}
export async function bankEvent<T>(
  db: DecisionDatabase,
  tenantId: string,
  type: string,
  id: string,
): Promise<T | null> {
  const row = await db
    .prepare(
      "select payload from private.domain_events where tenant_id = ? and aggregate_type = ? and aggregate_id = ?",
    )
    .bind(tenantId, type, id)
    .first<{ payload: T }>();
  return row?.payload ?? null;
}
export async function bankAccountEvents<T>(
  db: DecisionDatabase,
  tenantId: string,
  type: string,
  accountId: string,
): Promise<T[]> {
  const rows = await db
    .prepare(
      "select payload from private.domain_events where tenant_id = ? and aggregate_type = ? and payload->>'accountId' = ? order by created_at, event_id",
    )
    .bind(tenantId, type, accountId)
    .all<{ payload: T }>();
  return rows.results.map(row => row.payload);
}
export async function appendBankEvent(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  type: string,
  id: string,
  payload: Record<string, unknown>,
) {
  await db
    .prepare(
      `insert into private.domain_events
 (tenant_id,event_id,aggregate_type,aggregate_id,aggregate_version,event_type,actor_id,payload)
 values (?, ?, ?, ?, 1, ?, ?, ?::jsonb)`,
    )
    .bind(tenantId, crypto.randomUUID(), type, id, type.toUpperCase(), actorId, jsonParameter(payload))
    .run();
}
