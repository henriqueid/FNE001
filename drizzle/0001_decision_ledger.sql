PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS decision_events (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  entity_refs_json TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  requested_action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  authority_id TEXT,
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  input_snapshot_id TEXT NOT NULL,
  input_snapshot_hash TEXT NOT NULL,
  computed_metrics_json TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  human_rationale TEXT,
  supporting_evidence_refs_json TEXT NOT NULL,
  prior_decision_refs_json TEXT NOT NULL,
  outcome TEXT NOT NULL,
  conditions_json TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, event_id),
  UNIQUE (tenant_id, decision_id, event_version)
);

CREATE INDEX IF NOT EXISTS decision_events_tenant_decision_idx
  ON decision_events (tenant_id, decision_id, event_version);

CREATE INDEX IF NOT EXISTS decision_events_tenant_operation_idx
  ON decision_events (tenant_id, operation_id, created_at);

CREATE TRIGGER IF NOT EXISTS decision_events_prevent_update
BEFORE UPDATE ON decision_events
BEGIN
  SELECT RAISE(ABORT, 'decision_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS decision_events_prevent_delete
BEFORE DELETE ON decision_events
BEGIN
  SELECT RAISE(ABORT, 'decision_events is append-only');
END;
