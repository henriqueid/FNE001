PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS decision_notifications (
  tenant_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  source_outbox_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('decision', 'release', 'pace', 'collection')),
  tone TEXT NOT NULL CHECK (tone IN ('critical', 'warning', 'info', 'good')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT NOT NULL,
  impact TEXT NOT NULL,
  next_action TEXT NOT NULL,
  owner TEXT NOT NULL,
  department TEXT NOT NULL,
  timing TEXT NOT NULL,
  view TEXT NOT NULL,
  required_permission TEXT,
  authority_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  PRIMARY KEY (tenant_id, notification_id),
  UNIQUE (tenant_id, source_outbox_id),
  FOREIGN KEY (tenant_id, source_outbox_id) REFERENCES decision_outbox(tenant_id, outbox_id)
);

CREATE INDEX IF NOT EXISTS decision_notifications_open_idx
  ON decision_notifications (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS decision_notifications_decision_idx
  ON decision_notifications (tenant_id, decision_id, status);
