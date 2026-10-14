import type { Operation } from "@/src/domain/core/types";
import { operationPayload } from "@/src/domain/operations/persistence";
import { hydrateOperationReceivables } from "@/src/domain/receivables/model";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { hydrateOperationsFromReceivables, syncOperationReceivables } from "@/src/server/receivables/repository";

type OperationRow = { payload: Operation; aggregate_version: number };

const materialEvent = `case
  when saved.aggregate_version = 1 then 'OPERATION_CREATED'
  when previous.stage is distinct from saved.stage then 'OPERATION_STAGE_CHANGED'
  when previous.status is distinct from saved.status then 'OPERATION_STATUS_CHANGED'
  else 'OPERATION_UPDATED'
end`;

export async function loadOperations(db: DecisionDatabase, tenantId: string): Promise<Operation[]> {
  const result = await db
    .prepare(
      `select payload, aggregate_version
       from private.operations
       where tenant_id = ?
       order by updated_at desc, operation_id`,
    )
    .bind(tenantId)
    .all<OperationRow>();
  const operations = result.results.map(row => ({ ...row.payload, persistenceVersion: row.aggregate_version }));
  return hydrateOperationsFromReceivables(db, tenantId, operations);
}

export async function loadOperationSnapshot(db: DecisionDatabase, tenantId: string, operationId: string) {
  const row = await db
    .prepare("select payload, aggregate_version from private.operations where tenant_id = ? and operation_id = ?")
    .bind(tenantId, operationId)
    .first<OperationRow>();
  if (!row) return null;
  const [operation] = await hydrateOperationsFromReceivables(db, tenantId, [
    { ...row.payload, persistenceVersion: row.aggregate_version },
  ]);
  return operation;
}

async function saveOperationRecord(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  operation: Operation,
  expectedVersion: number,
): Promise<Operation | null> {
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();
  const payload = operationPayload(operation);
  const row = await db
    .prepare(
      `with previous as materialized (
         select stage, status
         from private.operations
         where tenant_id = ? and operation_id = ?
       ), saved as (
         insert into private.operations
           (tenant_id, operation_id, vehicle, institution, cedent_document, status, stage, amount,
            title_count, aggregate_version, payload, created_by, updated_by)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?::jsonb, ?, ?)
         on conflict (tenant_id, operation_id) do update set
           vehicle = excluded.vehicle,
           institution = excluded.institution,
           cedent_document = excluded.cedent_document,
           status = excluded.status,
           stage = excluded.stage,
           amount = excluded.amount,
           title_count = excluded.title_count,
           aggregate_version = private.operations.aggregate_version + 1,
           payload = excluded.payload,
           updated_by = excluded.updated_by,
           updated_at = now()
         where private.operations.aggregate_version = ?
         returning payload, aggregate_version, stage, status
       ), recorded as (
         insert into private.domain_events
           (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload)
         select ?, ?, 'Operation', ?, saved.aggregate_version, ${materialEvent}, ?,
           jsonb_build_object('stage', saved.stage, 'status', saved.status)
         from saved left join previous on true
         returning event_id, aggregate_version, event_type
       ), enqueued as (
         insert into private.domain_outbox
           (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id, aggregate_version, payload)
         select ?, ?, recorded.event_id, 'strato.operations', 'Operation', ?, recorded.aggregate_version,
           jsonb_build_object(
             'eventId', recorded.event_id,
             'eventType', recorded.event_type,
             'operationId', ?::text,
             'aggregateVersion', recorded.aggregate_version
           )
         from recorded
       )
       select payload, aggregate_version from saved`,
    )
    .bind(
      tenantId,
      operation.id,
      tenantId,
      operation.id,
      operation.vehicle.trim(),
      operation.institution,
      operation.document.replace(/\D/g, ""),
      operation.status,
      operation.stage,
      operation.amount,
      operation.titleCount,
      jsonParameter(payload),
      actorId,
      actorId,
      expectedVersion,
      tenantId,
      eventId,
      operation.id,
      actorId,
      tenantId,
      outboxId,
      operation.id,
      operation.id,
    )
    .first<OperationRow>();
  return row ? { ...row.payload, persistenceVersion: row.aggregate_version } : null;
}

export async function saveOperation(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  operation: Operation,
  expectedVersion: number,
): Promise<Operation | null> {
  const work = async (transaction: DecisionDatabase) => {
    const saved = await saveOperationRecord(transaction, tenantId, actorId, operation, expectedVersion);
    if (!saved) return null;
    const receivables = await syncOperationReceivables(transaction, tenantId, actorId, operation);
    return hydrateOperationReceivables(saved, receivables);
  };
  return db.transaction ? db.transaction(work) : work(db);
}
