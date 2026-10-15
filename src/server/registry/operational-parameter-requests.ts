import {
  emptyOperationalDefaults,
  operationalDefaultsSnapshot,
  validateOperationalDefaults,
  type OperationalDefaultsState,
  type OperationalParameterChangeRequest,
} from "@/src/domain/registry/operational-profile";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import type { ServerPrincipal } from "@/src/server/access/repository";

type StateRow = { payload: OperationalDefaultsState; aggregate_version: number };
type CommandRow = {
  request_hash: string;
  result_version: number;
  result_payload: OperationalDefaultsState;
};
type RequestRow = {
  change_id: string;
  request_hash: string;
  expected_version: number;
  previous_payload: OperationalDefaultsState;
  proposed_payload: OperationalDefaultsState;
  reason: string;
  status: OperationalParameterChangeRequest["status"];
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  applied_version: number | null;
};

export class OperationalParameterConflictError extends Error {}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key, item]) => key !== "persistenceVersion" && item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
};

const same = (left: unknown, right: unknown) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export async function operationalParameterRequestHash(input: {
  tenantId: string;
  actorId: string;
  expectedVersion: number;
  proposed: OperationalDefaultsState;
  reason: string;
}) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable(input))));
  return hex(new Uint8Array(digest));
}

export async function operationalParameterSaveHash(input: {
  tenantId: string;
  actorId: string;
  expectedVersion: number;
  state: OperationalDefaultsState;
}) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable(input))));
  return hex(new Uint8Array(digest));
}

const mapped = (row: RequestRow): OperationalParameterChangeRequest => ({
  id: row.change_id,
  expectedVersion: row.expected_version,
  previous: { ...row.previous_payload, persistenceVersion: row.expected_version },
  proposed: { ...row.proposed_payload, persistenceVersion: row.expected_version },
  reason: row.reason,
  status: row.status,
  requestedById: row.requested_by,
  requestedBy: row.requested_by_name,
  requestedAt: row.requested_at,
  decidedById: row.decided_by ?? undefined,
  decidedBy: row.decided_by_name ?? undefined,
  decidedAt: row.decided_at ?? undefined,
  decisionReason: row.decision_reason ?? undefined,
  appliedVersion: row.applied_version ?? undefined,
});

export async function loadOperationalParameterState(db: DecisionDatabase, tenantId: string) {
  const row = await db
    .prepare(`select payload, aggregate_version from private.operational_parameter_states where tenant_id = ?`)
    .bind(tenantId)
    .first<StateRow>();
  return row ? { ...row.payload, persistenceVersion: row.aggregate_version } : null;
}

export async function saveOperationalParameterState(
  db: DecisionDatabase,
  tenantId: string,
  actor: Pick<ServerPrincipal, "id">,
  state: OperationalDefaultsState,
  expectedVersion: number,
  commandId: string,
  requestHash: string,
) {
  const validationError = validateOperationalDefaults(state);
  if (validationError) throw new OperationalParameterConflictError(validationError);
  const candidate = operationalDefaultsSnapshot(state);
  const work = async (transaction: DecisionDatabase) => {
    const replay = await transaction
      .prepare(
        `select request_hash, result_version, result_payload
         from private.operational_parameter_commands
         where tenant_id = ? and command_id = ?`,
      )
      .bind(tenantId, commandId)
      .first<CommandRow>();
    if (replay) {
      if (replay.request_hash !== requestHash)
        throw new OperationalParameterConflictError("A chave deste comando já foi usada com outro conteúdo.");
      return { ...replay.result_payload, persistenceVersion: replay.result_version };
    }
    const current = await loadOperationalParameterState(transaction, tenantId);
    if ((current?.persistenceVersion ?? 0) !== expectedVersion)
      throw new OperationalParameterConflictError("Os parâmetros mudaram. Recarregue a versão atual antes de salvar.");
    if (same(operationalDefaultsSnapshot(current ?? emptyOperationalDefaults()), candidate))
      throw new OperationalParameterConflictError("Nenhuma alteração de parâmetro foi informada.");

    const eventId = crypto.randomUUID();
    const outboxId = crypto.randomUUID();
    const saved = await transaction
      .prepare(
        `with saved as (
           insert into private.operational_parameter_states
             (tenant_id, aggregate_version, payload, created_by, updated_by)
           values (?, 1, ?::jsonb, ?, ?)
           on conflict (tenant_id) do update set
             aggregate_version = private.operational_parameter_states.aggregate_version + 1,
             payload = excluded.payload, updated_by = excluded.updated_by, updated_at = now()
           where private.operational_parameter_states.aggregate_version = ?
           returning aggregate_version, payload
         ), recorded as (
           insert into private.domain_events
             (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
              event_type, actor_id, correlation_id, payload)
           select ?, ?, 'OperationalParameterState', ?, aggregate_version,
             'OPERATIONAL_PARAMETERS_SAVED', ?, ?,
             jsonb_build_object('expectedVersion', ?::integer)
           from saved returning event_id, aggregate_version
         ), enqueued as (
           insert into private.domain_outbox
             (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id,
              aggregate_version, payload)
           select ?, ?, event_id, 'strato.operational-parameters', 'OperationalParameterState', ?,
             aggregate_version, jsonb_build_object('eventId', event_id,
               'eventType', 'OPERATIONAL_PARAMETERS_SAVED', 'tenantId', ?::text,
               'aggregateVersion', aggregate_version)
           from recorded
         ), commanded as (
           insert into private.operational_parameter_commands
             (tenant_id, command_id, request_hash, expected_version, result_version,
              result_payload, event_id, actor_id)
           select ?, ?, ?, ?::integer, aggregate_version, payload, ?, ?
           from saved
           returning result_version, result_payload
         )
         select result_version, result_payload from commanded`,
      )
      .bind(
        tenantId,
        jsonParameter(candidate),
        actor.id,
        actor.id,
        expectedVersion,
        tenantId,
        eventId,
        tenantId,
        actor.id,
        commandId,
        expectedVersion,
        tenantId,
        outboxId,
        tenantId,
        tenantId,
        tenantId,
        commandId,
        requestHash,
        expectedVersion,
        eventId,
        actor.id,
      )
      .first<{ result_version: number; result_payload: OperationalDefaultsState }>();
    if (!saved) throw new OperationalParameterConflictError("Os parâmetros mudaram durante a gravação.");
    return { ...saved.result_payload, persistenceVersion: saved.result_version };
  };
  return db.transaction ? db.transaction(work) : work(db);
}

export async function listOperationalParameterChanges(db: DecisionDatabase, tenantId: string) {
  const rows = await db
    .prepare(
      `select change_id, request_hash, expected_version, previous_payload, proposed_payload,
              reason, status, requested_by, requested_by_name, requested_at,
              decided_by, decided_by_name, decided_at, decision_reason, applied_version
       from private.operational_parameter_change_requests
       where tenant_id = ?
       order by (status = 'PENDING') desc, requested_at desc
       limit 20`,
    )
    .bind(tenantId)
    .all<RequestRow>();
  return rows.results.map(mapped);
}

export async function requestOperationalParameterChange(
  db: DecisionDatabase,
  tenantId: string,
  actor: Pick<ServerPrincipal, "id" | "name">,
  proposed: OperationalDefaultsState,
  expectedVersion: number,
  reason: string,
  commandId: string,
  requestHash: string,
) {
  const validationError = validateOperationalDefaults(proposed);
  if (validationError) throw new OperationalParameterConflictError(validationError);
  if (reason.trim().length < 10)
    throw new OperationalParameterConflictError("Informe um motivo com pelo menos 10 caracteres.");
  const work = async (transaction: DecisionDatabase) => {
    const replay = await transaction
      .prepare(
        `select change_id, request_hash, expected_version, previous_payload, proposed_payload,
                reason, status, requested_by, requested_by_name, requested_at,
                decided_by, decided_by_name, decided_at, decision_reason, applied_version
         from private.operational_parameter_change_requests
         where tenant_id = ? and command_id = ?`,
      )
      .bind(tenantId, commandId)
      .first<RequestRow>();
    if (replay) {
      if (replay.request_hash !== requestHash)
        throw new OperationalParameterConflictError("A chave deste comando já foi usada com outro conteúdo.");
      return mapped(replay);
    }
    const current = await loadOperationalParameterState(transaction, tenantId);
    if ((current?.persistenceVersion ?? 0) !== expectedVersion)
      throw new OperationalParameterConflictError("Os parâmetros mudaram. Recarregue a versão atual antes de propor.");
    const previous = operationalDefaultsSnapshot(current ?? emptyOperationalDefaults());
    const candidate = operationalDefaultsSnapshot(proposed);
    if (same(previous, candidate))
      throw new OperationalParameterConflictError("Nenhuma alteração de parâmetro foi informada.");
    const changeId = `operational-parameters-${crypto.randomUUID()}`;
    const eventId = crypto.randomUUID();
    const outboxId = crypto.randomUUID();
    const inserted = await transaction
      .prepare(
        `with requested as (
           insert into private.operational_parameter_change_requests
             (tenant_id, change_id, command_id, request_hash, expected_version,
              previous_payload, proposed_payload, reason, requested_by, requested_by_name)
           values (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)
           returning change_id, request_hash, expected_version, previous_payload, proposed_payload,
             reason, status, requested_by, requested_by_name, requested_at,
             decided_by, decided_by_name, decided_at, decision_reason, applied_version
         ), recorded as (
           insert into private.domain_events
             (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
              event_type, actor_id, correlation_id, payload)
           values (?, ?, 'OperationalParameterChangeRequest', ?, 1,
             'OPERATIONAL_PARAMETERS_CHANGE_REQUESTED', ?, ?,
             jsonb_build_object('expectedVersion', ?::integer, 'reason', ?::text))
           returning event_id
         ), enqueued as (
           insert into private.domain_outbox
             (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id,
              aggregate_version, payload)
           select ?, ?, event_id, 'strato.operational-parameters',
             'OperationalParameterChangeRequest', ?, 1,
             jsonb_build_object('eventId', event_id, 'eventType',
               'OPERATIONAL_PARAMETERS_CHANGE_REQUESTED', 'tenantId', ?::text, 'changeId', ?::text)
           from recorded
         )
         select * from requested`,
      )
      .bind(
        tenantId,
        changeId,
        commandId,
        requestHash,
        expectedVersion,
        jsonParameter(previous),
        jsonParameter(candidate),
        reason.trim(),
        actor.id,
        actor.name,
        tenantId,
        eventId,
        changeId,
        actor.id,
        commandId,
        expectedVersion,
        reason.trim(),
        tenantId,
        outboxId,
        changeId,
        tenantId,
        changeId,
      )
      .first<RequestRow>();
    if (!inserted) throw new OperationalParameterConflictError("Não foi possível registrar a proposta.");
    return mapped(inserted);
  };
  return db.transaction ? db.transaction(work) : work(db);
}

export async function decideOperationalParameterChange(
  db: DecisionDatabase,
  tenantId: string,
  actor: Pick<ServerPrincipal, "id" | "name">,
  changeId: string,
  decision: "APPROVED" | "REJECTED",
  decisionReason: string,
) {
  if (decisionReason.trim().length < 5)
    throw new OperationalParameterConflictError("Informe uma justificativa de decisão com pelo menos 5 caracteres.");
  const work = async (transaction: DecisionDatabase) => {
    const row = await transaction
      .prepare(
        `select change_id, request_hash, expected_version, previous_payload, proposed_payload,
                reason, status, requested_by, requested_by_name, requested_at,
                decided_by, decided_by_name, decided_at, decision_reason, applied_version
         from private.operational_parameter_change_requests
         where tenant_id = ? and change_id = ? for update`,
      )
      .bind(tenantId, changeId)
      .first<RequestRow>();
    if (!row || row.status !== "PENDING")
      throw new OperationalParameterConflictError("A proposta não está mais pendente.");
    if (row.requested_by === actor.id)
      throw new OperationalParameterConflictError("O solicitante não pode decidir a própria proposta.");
    const current = await loadOperationalParameterState(transaction, tenantId);
    if ((current?.persistenceVersion ?? 0) !== row.expected_version)
      throw new OperationalParameterConflictError(
        "A versão efetiva mudou durante a espera. Rejeite e refaça a proposta.",
      );
    if (!same(operationalDefaultsSnapshot(current ?? row.previous_payload), row.previous_payload))
      throw new OperationalParameterConflictError("O conteúdo efetivo mudou durante a espera.");
    const now = new Date().toISOString();
    let appliedVersion: number | null = null;
    if (decision === "APPROVED") {
      const stateEventId = crypto.randomUUID();
      const stateOutboxId = crypto.randomUUID();
      const saved = await transaction
        .prepare(
          `with saved as (
             insert into private.operational_parameter_states
               (tenant_id, aggregate_version, payload, created_by, updated_by)
             values (?, 1, ?::jsonb, ?, ?)
             on conflict (tenant_id) do update set
               aggregate_version = private.operational_parameter_states.aggregate_version + 1,
               payload = excluded.payload, updated_by = excluded.updated_by, updated_at = now()
             where private.operational_parameter_states.aggregate_version = ?
             returning aggregate_version
           ), recorded as (
             insert into private.domain_events
               (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                event_type, actor_id, correlation_id, payload)
             select ?, ?, 'OperationalParameterState', ?, aggregate_version,
               'OPERATIONAL_PARAMETERS_APPROVED', ?, ?,
               jsonb_build_object('changeId', ?::text, 'reason', ?::text)
             from saved returning event_id, aggregate_version
           ), enqueued as (
             insert into private.domain_outbox
               (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id,
                aggregate_version, payload)
             select ?, ?, event_id, 'strato.operational-parameters', 'OperationalParameterState', ?,
               aggregate_version, jsonb_build_object('eventId', event_id,
                 'eventType', 'OPERATIONAL_PARAMETERS_APPROVED', 'tenantId', ?::text,
                 'aggregateVersion', aggregate_version, 'changeId', ?::text)
             from recorded
           )
           select aggregate_version from saved`,
        )
        .bind(
          tenantId,
          jsonParameter(row.proposed_payload),
          actor.id,
          actor.id,
          row.expected_version,
          tenantId,
          stateEventId,
          tenantId,
          actor.id,
          changeId,
          changeId,
          decisionReason.trim(),
          tenantId,
          stateOutboxId,
          tenantId,
          tenantId,
          changeId,
        )
        .first<{ aggregate_version: number }>();
      if (!saved) throw new OperationalParameterConflictError("A versão efetiva mudou durante a aprovação.");
      appliedVersion = saved.aggregate_version;
    }
    const decisionEventId = crypto.randomUUID();
    const decisionOutboxId = crypto.randomUUID();
    await transaction
      .prepare(
        `with decided as (
           update private.operational_parameter_change_requests set
             status = ?, decided_by = ?, decided_by_name = ?, decided_at = ?,
             decision_reason = ?, applied_version = ?
           where tenant_id = ? and change_id = ? and status = 'PENDING'
           returning change_id
         ), recorded as (
           insert into private.domain_events
             (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
              event_type, actor_id, correlation_id, payload)
           select ?, ?, 'OperationalParameterChangeRequest', change_id, 2,
             ?::text, ?, change_id,
             jsonb_build_object('decisionReason', ?::text, 'appliedVersion', ?::integer)
           from decided returning event_id
         )
         insert into private.domain_outbox
           (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id,
            aggregate_version, payload)
         select ?, ?, event_id, 'strato.operational-parameters',
           'OperationalParameterChangeRequest', ?, 2,
           jsonb_build_object('eventId', event_id, 'eventType', ?::text,
             'tenantId', ?::text, 'changeId', ?::text)
         from recorded`,
      )
      .bind(
        decision,
        actor.id,
        actor.name,
        now,
        decisionReason.trim(),
        appliedVersion,
        tenantId,
        changeId,
        tenantId,
        decisionEventId,
        decision === "APPROVED" ? "OPERATIONAL_PARAMETERS_CHANGE_APPROVED" : "OPERATIONAL_PARAMETERS_CHANGE_REJECTED",
        actor.id,
        decisionReason.trim(),
        appliedVersion,
        tenantId,
        decisionOutboxId,
        changeId,
        decision === "APPROVED" ? "OPERATIONAL_PARAMETERS_CHANGE_APPROVED" : "OPERATIONAL_PARAMETERS_CHANGE_REJECTED",
        tenantId,
        changeId,
      )
      .run();
    return loadOperationalParameterState(transaction, tenantId);
  };
  return db.transaction ? db.transaction(work) : work(db);
}
