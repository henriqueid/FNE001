import {
  type DecisionCondition,
  type DecisionEvent,
  type DecisionEventDraft,
  type DecisionEventType,
  type DecisionOutcome,
} from "@/src/domain/decisions/model";

export type DecisionStatement = {
  bind(...values: unknown[]): DecisionStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
};

export type DecisionDatabase = {
  prepare(query: string): DecisionStatement;
  batch<T = unknown>(statements: DecisionStatement[]): Promise<T[]>;
  exec(query: string): Promise<unknown>;
};

export class DecisionConflictError extends Error {}

type DecisionRow = {
  tenant_id: string;
  event_id: string;
  event_version: number;
  event_type: DecisionEventType;
  decision_id: string;
  operation_id: string;
  entity_refs_json: string;
  decision_type: string;
  requested_action: string;
  actor_id: string;
  actor_role: string;
  authority_id: string | null;
  policy_id: string;
  policy_version: string;
  input_snapshot_id: string;
  input_snapshot_hash: string;
  computed_metrics_json: string;
  reason_codes_json: string;
  human_rationale: string | null;
  supporting_evidence_refs_json: string;
  prior_decision_refs_json: string;
  outcome: DecisionOutcome;
  conditions_json: string;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  correlation_id: string;
};

const parse = <T>(value: string): T => JSON.parse(value) as T;

function eventFromRow(row: DecisionRow): DecisionEvent {
  return {
    eventId: row.event_id,
    eventVersion: row.event_version,
    eventType: row.event_type,
    decisionId: row.decision_id,
    tenantId: row.tenant_id,
    operationId: row.operation_id,
    entityRefs: parse<string[]>(row.entity_refs_json),
    decisionType: row.decision_type,
    requestedAction: row.requested_action,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    authorityId: row.authority_id ?? undefined,
    policyId: row.policy_id,
    policyVersion: row.policy_version,
    inputSnapshotId: row.input_snapshot_id,
    inputSnapshotHash: row.input_snapshot_hash,
    computedMetrics: parse<Record<string, number | string | boolean>>(row.computed_metrics_json),
    reasonCodes: parse<string[]>(row.reason_codes_json),
    humanRationale: row.human_rationale ?? undefined,
    supportingEvidenceRefs: parse<string[]>(row.supporting_evidence_refs_json),
    priorDecisionRefs: parse<string[]>(row.prior_decision_refs_json),
    outcome: row.outcome,
    conditions: parse<DecisionCondition[]>(row.conditions_json),
    validFrom: row.valid_from,
    validUntil: row.valid_until ?? undefined,
    createdAt: row.created_at,
    correlationId: row.correlation_id,
  };
}

export async function ensureDecisionSchema(_db: DecisionDatabase) {
  // The PostgreSQL schema is versioned exclusively through Supabase migrations.
}

const decisionColumns = `
  tenant_id, event_id, event_version, event_type, decision_id, operation_id,
  entity_refs::text AS entity_refs_json, decision_type, requested_action,
  actor_id, actor_role, authority_id, policy_id, policy_version, input_snapshot_id,
  input_snapshot_hash, computed_metrics::text AS computed_metrics_json,
  reason_codes::text AS reason_codes_json, human_rationale,
  supporting_evidence_refs::text AS supporting_evidence_refs_json,
  prior_decision_refs::text AS prior_decision_refs_json, outcome,
  conditions::text AS conditions_json, valid_from::text, valid_until::text,
  created_at::text, correlation_id`;

export async function listDecisionEvents(db: DecisionDatabase, tenantId: string, decisionId: string) {
  await ensureDecisionSchema(db);
  const result = await db
    .prepare(
      `SELECT ${decisionColumns} FROM private.decision_events
      WHERE tenant_id = ? AND decision_id = ? ORDER BY event_version ASC`,
    )
    .bind(tenantId, decisionId)
    .all<DecisionRow>();
  return result.results.map(eventFromRow);
}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
};

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export async function decisionRequestHash(scope: { tenantId: string; actorId: string }, draft: DecisionEventDraft) {
  const body = JSON.stringify(stable({ tenantId: scope.tenantId, actorId: scope.actorId, draft }));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return hex(new Uint8Array(digest));
}

type IdempotencyRow = { event_id: string; request_hash: string };

async function replayedEvent(db: DecisionDatabase, tenantId: string, idempotencyKey: string, requestHash: string) {
  const claim = await db
    .prepare(
      "SELECT event_id, request_hash FROM private.decision_idempotency WHERE tenant_id = ? AND idempotency_key = ?",
    )
    .bind(tenantId, idempotencyKey)
    .first<IdempotencyRow>();
  if (!claim) return null;
  if (claim.request_hash !== requestHash)
    throw new DecisionConflictError("A chave de idempotência já foi usada com outro conteúdo.");
  const row = await db
    .prepare(`SELECT ${decisionColumns} FROM private.decision_events WHERE tenant_id = ? AND event_id = ?`)
    .bind(tenantId, claim.event_id)
    .first<DecisionRow>();
  if (!row) throw new Error("A chave de idempotência não possui evento associado.");
  return eventFromRow(row);
}

export async function appendDecisionEvent(
  db: DecisionDatabase,
  scope: { tenantId: string; actorId: string; actorRole: string },
  draft: DecisionEventDraft,
  idempotencyKey: string,
) {
  await ensureDecisionSchema(db);
  const requestHash = await decisionRequestHash(scope, draft);
  const replay = await replayedEvent(db, scope.tenantId, idempotencyKey, requestHash);
  if (replay) return { event: replay, replayed: true } as const;
  const createdAt = new Date().toISOString();
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await db
      .prepare(
        "SELECT COALESCE(MAX(event_version), 0) AS version FROM private.decision_events WHERE tenant_id = ? AND decision_id = ?",
      )
      .bind(scope.tenantId, draft.decisionId)
      .first<{ version: number }>();
    const event: DecisionEvent = {
      ...draft,
      tenantId: scope.tenantId,
      actorId: scope.actorId,
      actorRole: scope.actorRole,
      createdAt,
      eventVersion: Number(latest?.version ?? 0) + 1,
    };
    try {
      const eventInsert = db
        .prepare(
          `INSERT INTO private.decision_events (
            tenant_id, event_id, event_version, event_type, decision_id, operation_id,
            entity_refs, decision_type, requested_action, actor_id, actor_role, authority_id,
            policy_id, policy_version, input_snapshot_id, input_snapshot_hash, computed_metrics,
            reason_codes, human_rationale, supporting_evidence_refs, prior_decision_refs,
            outcome, conditions, valid_from, valid_until, created_at, correlation_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          event.tenantId,
          event.eventId,
          event.eventVersion,
          event.eventType,
          event.decisionId,
          event.operationId,
          event.entityRefs,
          event.decisionType,
          event.requestedAction,
          event.actorId,
          event.actorRole,
          event.authorityId ?? null,
          event.policyId,
          event.policyVersion,
          event.inputSnapshotId,
          event.inputSnapshotHash,
          event.computedMetrics,
          event.reasonCodes,
          event.humanRationale ?? null,
          event.supportingEvidenceRefs,
          event.priorDecisionRefs,
          event.outcome,
          event.conditions,
          event.validFrom,
          event.validUntil ?? null,
          event.createdAt,
          event.correlationId,
        );
      const idempotencyInsert = db
        .prepare(
          `INSERT INTO private.decision_idempotency
            (tenant_id, idempotency_key, event_id, request_hash, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(scope.tenantId, idempotencyKey, event.eventId, requestHash, createdAt);
      const outboxInsert = db
        .prepare(
          `INSERT INTO private.decision_outbox (
            tenant_id, outbox_id, topic, aggregate_id, event_id, payload,
            status, attempts, available_at, created_at, published_at, last_error
          ) VALUES (?, ?, 'decision.event.recorded', ?, ?, ?, 'PENDING', 0, ?, ?, NULL, NULL)`,
        )
        .bind(
          scope.tenantId,
          crypto.randomUUID(),
          event.decisionId,
          event.eventId,
          event,
          createdAt,
          createdAt,
        );
      await db.batch([eventInsert, idempotencyInsert, outboxInsert]);
      return { event, replayed: false } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const databaseCode =
        error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
      const uniqueConflict = databaseCode === "23505" || /unique constraint/i.test(message);
      const concurrentReplay = await replayedEvent(db, scope.tenantId, idempotencyKey, requestHash);
      if (concurrentReplay) return { event: concurrentReplay, replayed: true } as const;
      if (uniqueConflict && (message.includes("event_id") || /primary key/i.test(message)))
        throw new DecisionConflictError("Evento já registrado.");
      if (attempt === 2 || !uniqueConflict) throw error;
    }
  }
  throw new Error("Não foi possível ordenar o evento de decisão.");
}
