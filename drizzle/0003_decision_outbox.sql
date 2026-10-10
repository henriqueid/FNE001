PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS decision_idempotency (
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, event_id) REFERENCES decision_events(tenant_id, event_id)
);

CREATE TABLE IF NOT EXISTS decision_outbox (
  tenant_id TEXT NOT NULL,
  outbox_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  last_error TEXT,
  PRIMARY KEY (tenant_id, outbox_id),
  UNIQUE (tenant_id, event_id, topic),
  FOREIGN KEY (tenant_id, event_id) REFERENCES decision_events(tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS decision_outbox_pending_idx
  ON decision_outbox (status, available_at, tenant_id);
