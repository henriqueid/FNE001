import type { TaskState } from "@/src/domain/tasks/model";
import { validateTaskTransition } from "@/src/domain/tasks/persistence";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";

type TaskStateRow = { payload: TaskState; aggregate_version: number; event_id?: string };
type TaskCommandRow = { request_hash: string; result_payload: TaskState; result_version: number };

export class TaskCommandConflictError extends Error {}
export class TaskTransitionError extends Error {}

const snapshot = (state: TaskState): TaskState => {
  const { persistenceVersion: _persistenceVersion, ...payload } = state;
  return payload;
};

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "persistenceVersion")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
};

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export async function taskRequestHash(input: {
  tenantId: string;
  actorId: string;
  expectedVersion: number;
  state: TaskState;
}) {
  const body = JSON.stringify(stable(input));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return hex(new Uint8Array(digest));
}

async function replayedTaskCommand(db: DecisionDatabase, tenantId: string, commandId: string, requestHash: string) {
  const row = await db
    .prepare(
      `select request_hash, result_payload, result_version
       from private.task_commands where tenant_id = ? and command_id = ?`,
    )
    .bind(tenantId, commandId)
    .first<TaskCommandRow>();
  if (!row) return null;
  if (row.request_hash !== requestHash)
    throw new TaskCommandConflictError("A chave deste comando de tarefa já foi usada com outro conteúdo.");
  return { ...row.result_payload, persistenceVersion: row.result_version };
}

export async function loadTaskState(db: DecisionDatabase, tenantId: string): Promise<TaskState | null> {
  const row = await db
    .prepare(`select payload, aggregate_version from private.task_states where tenant_id = ?`)
    .bind(tenantId)
    .first<TaskStateRow>();
  return row ? { ...row.payload, persistenceVersion: row.aggregate_version } : null;
}

async function saveEnvelope(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  state: TaskState,
  expectedVersion: number,
) {
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();
  return db
    .prepare(
      `with saved as (
         insert into private.task_states
           (tenant_id, aggregate_version, payload, created_by, updated_by)
         values (?, 1, ?::jsonb, ?, ?)
         on conflict (tenant_id) do update set
           aggregate_version = private.task_states.aggregate_version + 1,
           payload = excluded.payload,
           updated_by = excluded.updated_by,
           updated_at = now()
         where private.task_states.aggregate_version = ?
         returning payload, aggregate_version
       ), recorded as (
         insert into private.domain_events
           (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload)
         select ?, ?, 'TaskState', ?, saved.aggregate_version,
           case when saved.aggregate_version = 1 then 'TASK_STATE_CREATED' else 'TASK_STATE_UPDATED' end,
           ?, jsonb_build_object(
             'tasks', ?::integer,
             'open', ?::integer,
             'completed', ?::integer
           )
         from saved
         returning event_id, aggregate_version, event_type
       ), enqueued as (
         insert into private.domain_outbox
           (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id, aggregate_version, payload)
         select ?, ?, event_id, 'strato.tasks', 'TaskState', ?, aggregate_version,
           jsonb_build_object(
             'eventId', event_id,
             'eventType', event_type,
             'tenantId', ?::text,
             'aggregateVersion', aggregate_version
           )
         from recorded
       )
       select saved.payload, saved.aggregate_version, recorded.event_id
       from saved join recorded on recorded.aggregate_version = saved.aggregate_version`,
    )
    .bind(
      tenantId,
      jsonParameter(snapshot(state)),
      actorId,
      actorId,
      expectedVersion,
      tenantId,
      eventId,
      tenantId,
      actorId,
      state.tasks.length,
      state.tasks.filter(task => task.status !== "completed").length,
      state.tasks.filter(task => task.status === "completed").length,
      tenantId,
      outboxId,
      tenantId,
      tenantId,
    )
    .first<TaskStateRow>();
}

function projectionStatements(db: DecisionDatabase, tenantId: string, state: TaskState) {
  const statements: DecisionStatement[] = [];
  for (const task of state.tasks) {
    statements.push(
      db
        .prepare(
          `insert into private.tasks
             (tenant_id, task_id, source, status, owner_user_id, owner_name, department,
              due_at, snoozed_until, operation_id, snapshot, task_version, created_at, updated_at, completed_at)
           values (
             ?, ?, ?, ?,
             coalesce(?, (select u.user_id from private.access_users u
              join private.tenant_memberships m on m.user_id = u.user_id and m.tenant_id = ?
              where lower(u.name) = lower(?) limit 1)),
             ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?
           )
           on conflict (tenant_id, task_id) do update set
             status = excluded.status,
             owner_user_id = excluded.owner_user_id,
             owner_name = excluded.owner_name,
             department = excluded.department,
             due_at = excluded.due_at,
             snoozed_until = excluded.snoozed_until,
             operation_id = excluded.operation_id,
             snapshot = excluded.snapshot,
             task_version = excluded.task_version,
             updated_at = excluded.updated_at,
             completed_at = excluded.completed_at`,
        )
        .bind(
          tenantId,
          task.id,
          task.source,
          task.status,
          task.ownerUserId ?? null,
          tenantId,
          task.owner,
          task.owner,
          task.department,
          task.dueAt,
          task.snoozedUntil ?? null,
          task.snapshot.operationId ?? null,
          jsonParameter(task.snapshot),
          task.history.length,
          task.createdAt,
          task.updatedAt,
          task.completedAt ?? null,
        ),
    );
    for (const entry of task.history)
      statements.push(
        db
          .prepare(
            `insert into private.task_history
               (tenant_id, history_id, task_id, occurred_at, actor_user_id, actor_name,
                action, detail, task_version)
             values (
               ?, ?, ?, ?,
               (select u.user_id from private.access_users u
                join private.tenant_memberships m on m.user_id = u.user_id and m.tenant_id = ?
                where lower(u.name) = lower(?) limit 1),
               ?, ?, ?, ?
             )
             on conflict (tenant_id, history_id) do nothing`,
          )
          .bind(
            tenantId,
            entry.id,
            task.id,
            entry.at,
            tenantId,
            entry.by,
            entry.by,
            entry.action,
            entry.detail,
            task.history.findIndex(candidate => candidate.id === entry.id) + 1,
          ),
      );
  }
  return statements;
}

export async function saveTaskState(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  actorName: string,
  state: TaskState,
  expectedVersion: number,
  commandId: string,
  requestHash: string,
): Promise<TaskState | null> {
  const replay = await replayedTaskCommand(db, tenantId, commandId, requestHash);
  if (replay) return replay;

  const work = async (transaction: DecisionDatabase) => {
    const repeated = await replayedTaskCommand(transaction, tenantId, commandId, requestHash);
    if (repeated) return repeated;
    const previous = await loadTaskState(transaction, tenantId);
    if ((previous?.persistenceVersion ?? 0) !== expectedVersion) return null;
    const transitionError = validateTaskTransition(previous, state, actorName);
    if (transitionError) throw new TaskTransitionError(transitionError);
    const saved = await saveEnvelope(transaction, tenantId, actorId, state, expectedVersion);
    if (!saved) {
      const concurrentReplay = await replayedTaskCommand(transaction, tenantId, commandId, requestHash);
      return concurrentReplay;
    }
    const projections = projectionStatements(transaction, tenantId, state);
    if (projections.length) await transaction.batch(projections);
    await transaction
      .prepare(
        `insert into private.task_commands
           (tenant_id, command_id, request_hash, expected_version, result_version,
            result_payload, event_id, actor_id)
         values (?, ?, ?, ?, ?, ?::jsonb, ?, ?)`,
      )
      .bind(
        tenantId,
        commandId,
        requestHash,
        expectedVersion,
        saved.aggregate_version,
        jsonParameter(saved.payload),
        saved.event_id,
        actorId,
      )
      .run();
    return { ...saved.payload, persistenceVersion: saved.aggregate_version };
  };
  return db.transaction ? db.transaction(work) : work(db);
}
