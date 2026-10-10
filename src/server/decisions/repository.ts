import {
  type DecisionCondition,
  type DecisionEvent,
  type DecisionEventDraft,
  type DecisionEventType,
  type DecisionOutcome,
} from "@/src/domain/decisions/model";

export type DecisionDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean }>;
    };
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results: T[] }>;
    run(): Promise<{ success: boolean }>;
  };
  exec(query: string): Promise<unknown>;
};

const schema = [
  `CREATE TABLE IF NOT EXISTS decision_events (
  tenant_id TEXT NOT NULL, event_id TEXT NOT NULL, event_version INTEGER NOT NULL,
  event_type TEXT NOT NULL, decision_id TEXT NOT NULL, operation_id TEXT NOT NULL,
  entity_refs_json TEXT NOT NULL, decision_type TEXT NOT NULL, requested_action TEXT NOT NULL,
  actor_id TEXT NOT NULL, actor_role TEXT NOT NULL, authority_id TEXT,
  policy_id TEXT NOT NULL, policy_version TEXT NOT NULL, input_snapshot_id TEXT NOT NULL,
  input_snapshot_hash TEXT NOT NULL, computed_metrics_json TEXT NOT NULL, reason_codes_json TEXT NOT NULL,
  human_rationale TEXT, supporting_evidence_refs_json TEXT NOT NULL, prior_decision_refs_json TEXT NOT NULL,
  outcome TEXT NOT NULL, conditions_json TEXT NOT NULL, valid_from TEXT NOT NULL, valid_until TEXT,
  created_at TEXT NOT NULL, correlation_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, event_id), UNIQUE (tenant_id, decision_id, event_version)
)`,
  "CREATE INDEX IF NOT EXISTS decision_events_tenant_decision_idx ON decision_events (tenant_id, decision_id, event_version)",
  "CREATE INDEX IF NOT EXISTS decision_events_tenant_operation_idx ON decision_events (tenant_id, operation_id, created_at)",
  "CREATE TRIGGER IF NOT EXISTS decision_events_prevent_update BEFORE UPDATE ON decision_events BEGIN SELECT RAISE(ABORT, 'decision_events is append-only'); END",
  "CREATE TRIGGER IF NOT EXISTS decision_events_prevent_delete BEFORE DELETE ON decision_events BEGIN SELECT RAISE(ABORT, 'decision_events is append-only'); END",
];

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

export async function ensureDecisionSchema(db: DecisionDatabase) {
  for (const statement of schema) await db.prepare(statement).run();
}

export async function listDecisionEvents(db: DecisionDatabase, tenantId: string, decisionId: string) {
  await ensureDecisionSchema(db);
  const result = await db
    .prepare("SELECT * FROM decision_events WHERE tenant_id = ? AND decision_id = ? ORDER BY event_version ASC")
    .bind(tenantId, decisionId)
    .all<DecisionRow>();
  return result.results.map(eventFromRow);
}

export async function appendDecisionEvent(
  db: DecisionDatabase,
  scope: { tenantId: string; actorId: string; actorRole: string },
  draft: DecisionEventDraft,
) {
  await ensureDecisionSchema(db);
  const createdAt = new Date().toISOString();
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await db
      .prepare(
        "SELECT COALESCE(MAX(event_version), 0) AS version FROM decision_events WHERE tenant_id = ? AND decision_id = ?",
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
      await db
        .prepare(
          `INSERT INTO decision_events (
            tenant_id, event_id, event_version, event_type, decision_id, operation_id,
            entity_refs_json, decision_type, requested_action, actor_id, actor_role, authority_id,
            policy_id, policy_version, input_snapshot_id, input_snapshot_hash, computed_metrics_json,
            reason_codes_json, human_rationale, supporting_evidence_refs_json, prior_decision_refs_json,
            outcome, conditions_json, valid_from, valid_until, created_at, correlation_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          event.tenantId,
          event.eventId,
          event.eventVersion,
          event.eventType,
          event.decisionId,
          event.operationId,
          JSON.stringify(event.entityRefs),
          event.decisionType,
          event.requestedAction,
          event.actorId,
          event.actorRole,
          event.authorityId ?? null,
          event.policyId,
          event.policyVersion,
          event.inputSnapshotId,
          event.inputSnapshotHash,
          JSON.stringify(event.computedMetrics),
          JSON.stringify(event.reasonCodes),
          event.humanRationale ?? null,
          JSON.stringify(event.supportingEvidenceRefs),
          JSON.stringify(event.priorDecisionRefs),
          event.outcome,
          JSON.stringify(event.conditions),
          event.validFrom,
          event.validUntil ?? null,
          event.createdAt,
          event.correlationId,
        )
        .run();
      return event;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("event_id") || message.includes("PRIMARY KEY")) throw new Error("Evento já registrado.");
      if (attempt === 2 || !message.includes("UNIQUE")) throw error;
    }
  }
  throw new Error("Não foi possível ordenar o evento de decisão.");
}
