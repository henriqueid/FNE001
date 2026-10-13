import type { Operation } from "@/src/domain/core/types";
import {
  hydrateOperationReceivables,
  receivablesFromOperation,
  validateReceivable,
  type ReceivableRecord,
} from "@/src/domain/receivables/model";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

type ReceivableRow = { payload: ReceivableRecord; aggregate_version: number };

export class ReceivableDuplicateError extends Error {
  constructor(
    readonly canonicalKey: string,
    readonly existingOperationId: string,
  ) {
    super("Recebível já vinculado a outra operação.");
  }
}

const recordPayload = (receivable: ReceivableRecord) => {
  const { persistenceVersion: _version, ...payload } = receivable;
  void _version;
  return payload;
};

export async function loadReceivables(
  db: DecisionDatabase,
  tenantId: string,
  operationId?: string,
): Promise<ReceivableRecord[]> {
  const result = await db
    .prepare(
      `select payload, aggregate_version
       from private.receivables
       where tenant_id = ?
         and (?::text is null or operation_id = ?::text)
       order by operation_id, source_entry_id`,
    )
    .bind(tenantId, operationId ?? null, operationId ?? null)
    .all<ReceivableRow>();
  return result.results.map(row => ({ ...row.payload, persistenceVersion: row.aggregate_version }));
}

export async function hydrateOperationsFromReceivables(
  db: DecisionDatabase,
  tenantId: string,
  operations: Operation[],
) {
  const receivables = await loadReceivables(db, tenantId);
  return operations.map(operation => hydrateOperationReceivables(operation, receivables));
}

async function recordReceivableEvent(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  receivable: ReceivableRecord,
  aggregateVersion: number,
  eventType: string,
) {
  const eventId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `insert into private.domain_events
          (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload)
         values (?, ?, 'Receivable', ?, ?, ?, ?, ?::jsonb)`,
      )
      .bind(
        tenantId,
        eventId,
        receivable.id,
        aggregateVersion,
        eventType,
        actorId,
        jsonParameter({
          operationId: receivable.operationId,
          canonicalKey: receivable.canonicalKey,
          lifecycleStatus: receivable.lifecycleStatus,
          amount: receivable.entry.amount,
          dueDate: receivable.entry.dueDate,
        }),
      ),
    db
      .prepare(
        `insert into private.domain_outbox
          (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id, aggregate_version, payload)
         values (?, ?, ?, 'strato.receivables', 'Receivable', ?, ?, ?::jsonb)`,
      )
      .bind(
        tenantId,
        crypto.randomUUID(),
        eventId,
        receivable.id,
        aggregateVersion,
        jsonParameter({
          eventId,
          eventType,
          receivableId: receivable.id,
          operationId: receivable.operationId,
          aggregateVersion,
        }),
      ),
  ]);
}

function eventTypeFor(previous: ReceivableRecord | undefined, current: ReceivableRecord) {
  if (!previous) return "RECEIVABLE_INCLUDED";
  if (current.lifecycleStatus === "REMOVED" && previous.lifecycleStatus !== "REMOVED") return "RECEIVABLE_REMOVED";
  if (current.lifecycleStatus === "ASSIGNED" && previous.lifecycleStatus !== "ASSIGNED") return "RECEIVABLE_ASSIGNED";
  if (current.lifecycleStatus !== previous.lifecycleStatus) return "RECEIVABLE_STATUS_CHANGED";
  return "RECEIVABLE_UPDATED";
}

async function saveFiscalLink(db: DecisionDatabase, tenantId: string, actorId: string, receivable: ReceivableRecord) {
  const accessKey = (receivable.entry.nfeKey ?? "").replace(/\D/g, "");
  if (accessKey.length !== 44) return;
  const fiscalDocumentId = `nfe:${accessKey}`;
  await db.batch([
    db
      .prepare(
        `insert into private.fiscal_documents
          (tenant_id, fiscal_document_id, document_type, access_key, issuer_document, recipient_document,
           issue_date, payload, created_by, updated_by)
         values (?, ?, 'NFE', ?, ?, ?, nullif(?, '')::date, ?::jsonb, ?, ?)
         on conflict (tenant_id, document_type, access_key) do update set
           issuer_document = excluded.issuer_document,
           recipient_document = excluded.recipient_document,
           issue_date = excluded.issue_date,
           payload = excluded.payload,
           updated_by = excluded.updated_by,
           updated_at = now()`,
      )
      .bind(
        tenantId,
        fiscalDocumentId,
        accessKey,
        receivable.ownerDocument.replace(/\D/g, ""),
        receivable.entry.debtorDocument.replace(/\D/g, ""),
        receivable.entry.issueDate ?? "",
        jsonParameter({ accessKey, cfop: receivable.entry.cfop, observation: receivable.entry.observation }),
        actorId,
        actorId,
      ),
    db
      .prepare(
        `insert into private.receivable_fiscal_documents
          (tenant_id, receivable_id, fiscal_document_id, relationship_type)
         values (?, ?, ?, 'ORIGIN')
         on conflict do nothing`,
      )
      .bind(tenantId, receivable.id, fiscalDocumentId),
  ]);
}

async function upsertReceivable(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  receivable: ReceivableRecord,
  previous?: ReceivableRecord,
) {
  const conflict = await db
    .prepare(
      `select operation_id
       from private.receivables
       where tenant_id = ? and canonical_key = ? and receivable_id <> ?`,
    )
    .bind(tenantId, receivable.canonicalKey, receivable.id)
    .first<{ operation_id: string }>();
  if (conflict) throw new ReceivableDuplicateError(receivable.canonicalKey, conflict.operation_id);

  const row = await db
    .prepare(
      `insert into private.receivables
        (tenant_id, receivable_id, operation_id, source_entry_id, canonical_key, receivable_type,
         lifecycle_status, owner_document, debtor_document, document_number, issue_date, due_date,
         original_amount, aggregate_version, payload, created_by, updated_by)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, nullif(?, '')::date, ?::date, ?, 1, ?::jsonb, ?, ?)
       on conflict (tenant_id, receivable_id) do update set
         canonical_key = excluded.canonical_key,
         receivable_type = excluded.receivable_type,
         lifecycle_status = excluded.lifecycle_status,
         owner_document = excluded.owner_document,
         debtor_document = excluded.debtor_document,
         document_number = excluded.document_number,
         issue_date = excluded.issue_date,
         due_date = excluded.due_date,
         original_amount = excluded.original_amount,
         aggregate_version = private.receivables.aggregate_version + 1,
         payload = excluded.payload,
         updated_by = excluded.updated_by,
         updated_at = now()
       where private.receivables.operation_id = excluded.operation_id
         and (private.receivables.payload is distinct from excluded.payload
           or private.receivables.lifecycle_status is distinct from excluded.lifecycle_status)
       returning aggregate_version`,
    )
    .bind(
      tenantId,
      receivable.id,
      receivable.operationId,
      receivable.sourceEntryId,
      receivable.canonicalKey,
      receivable.receivableType,
      receivable.lifecycleStatus,
      receivable.ownerDocument.replace(/\D/g, ""),
      receivable.entry.debtorDocument.replace(/\D/g, ""),
      receivable.entry.documentNumber.trim(),
      receivable.entry.issueDate ?? "",
      receivable.entry.dueDate,
      receivable.entry.amount,
      jsonParameter(recordPayload(receivable)),
      actorId,
      actorId,
    )
    .first<{ aggregate_version: number }>();
  if (row)
    await recordReceivableEvent(
      db,
      tenantId,
      actorId,
      receivable,
      row.aggregate_version,
      eventTypeFor(previous, receivable),
    );
  await saveFiscalLink(db, tenantId, actorId, receivable);
}

export async function syncOperationReceivables(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  operation: Operation,
) {
  const incoming = receivablesFromOperation(operation);
  const invalid = incoming.map(validateReceivable).find(Boolean);
  if (invalid) throw new Error(invalid);
  const previous = await loadReceivables(db, tenantId, operation.id);
  const previousById = new Map(previous.map(receivable => [receivable.id, receivable]));
  for (const receivable of incoming)
    await upsertReceivable(db, tenantId, actorId, receivable, previousById.get(receivable.id));

  const incomingIds = new Set(incoming.map(receivable => receivable.id));
  for (const missing of previous.filter(
    receivable => !incomingIds.has(receivable.id) && receivable.lifecycleStatus !== "REMOVED",
  )) {
    const removed: ReceivableRecord = { ...missing, lifecycleStatus: "REMOVED" };
    await upsertReceivable(db, tenantId, actorId, removed, missing);
  }
  return loadReceivables(db, tenantId, operation.id);
}
