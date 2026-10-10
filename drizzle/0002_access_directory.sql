PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS access_users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  access_level TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
  manager_user_id TEXT,
  commercial_rep_id TEXT,
  account_manager_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  company_scopes_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id),
  FOREIGN KEY (user_id) REFERENCES access_users(user_id)
);

CREATE TABLE IF NOT EXISTS access_permissions (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id, permission),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS authority_assignments (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  authority_id TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id, authority_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES access_users(user_id)
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id, expires_at);
CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx ON tenant_memberships (user_id, tenant_id);

CREATE TABLE IF NOT EXISTS access_events (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  subject_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS access_events_prevent_update
BEFORE UPDATE ON access_events
BEGIN
  SELECT RAISE(ABORT, 'access_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS access_events_prevent_delete
BEFORE DELETE ON access_events
BEGIN
  SELECT RAISE(ABORT, 'access_events is append-only');
END;
