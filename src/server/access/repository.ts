import { seedAccessState, type AccessState, type AccessUser, type Permission } from "@/src/domain/access/model";
import { type DecisionDatabase } from "@/src/server/decisions/repository";

const schema = [
  `CREATE TABLE IF NOT EXISTS access_users (
    user_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL,
    department TEXT NOT NULL, access_level TEXT NOT NULL, status TEXT NOT NULL,
    manager_user_id TEXT, commercial_rep_id TEXT, account_manager_id TEXT, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tenant_memberships (
    tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, company_scopes_json TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id), FOREIGN KEY (user_id) REFERENCES access_users(user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS access_permissions (
    tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, permission TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, permission),
    FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS authority_assignments (
    tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, authority_id TEXT NOT NULL,
    valid_from TEXT NOT NULL, valid_until TEXT, created_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, authority_id),
    FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL, revoked_at TEXT, FOREIGN KEY (user_id) REFERENCES access_users(user_id)
  )`,
  "CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id, expires_at)",
  "CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx ON tenant_memberships (user_id, tenant_id)",
  `CREATE TABLE IF NOT EXISTS access_events (
    event_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, actor_id TEXT NOT NULL,
    subject_user_id TEXT NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  "CREATE TRIGGER IF NOT EXISTS access_events_prevent_update BEFORE UPDATE ON access_events BEGIN SELECT RAISE(ABORT, 'access_events is append-only'); END",
  "CREATE TRIGGER IF NOT EXISTS access_events_prevent_delete BEFORE DELETE ON access_events BEGIN SELECT RAISE(ABORT, 'access_events is append-only'); END",
];

export type ServerPrincipal = {
  id: string;
  name: string;
  role: string;
  department: AccessUser["department"];
  access: AccessUser["access"];
  status: "active" | "suspended";
  tenantId: string;
  permissions: Permission[];
  authorityIds: string[];
};

export async function ensureAccessSchema(db: DecisionDatabase) {
  for (const statement of schema) await db.prepare(statement).run();
}

export async function seedAccessDirectory(db: DecisionDatabase) {
  await ensureAccessSchema(db);
  const existing = await db.prepare("SELECT user_id FROM access_users LIMIT 1").first<{ user_id: string }>();
  if (existing) return;
  const now = new Date().toISOString();
  for (const user of seedAccessState().users) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO access_users (
          user_id, email, name, role, department, access_level, status,
          manager_user_id, commercial_rep_id, account_manager_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        user.id,
        user.email,
        user.name,
        user.role,
        user.department,
        user.access,
        user.status,
        user.managerUserId ?? null,
        user.commercialRepId ?? null,
        user.accountManagerId ?? null,
        now,
      )
      .run();
    for (const tenantId of user.tenantIds) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO tenant_memberships (tenant_id, user_id, company_scopes_json, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(tenantId, user.id, JSON.stringify(user.companyScopes), now)
        .run();
      for (const permission of user.permissions)
        await db
          .prepare(
            "INSERT OR IGNORE INTO access_permissions (tenant_id, user_id, permission, created_at) VALUES (?, ?, ?, ?)",
          )
          .bind(tenantId, user.id, permission, now)
          .run();
    }
  }

  for (const user of seedAccessState().users)
    for (const tenantId of user.tenantIds)
      for (const authorityId of user.authorityIds ?? [])
        await db
          .prepare(
            `INSERT OR IGNORE INTO authority_assignments
              (tenant_id, user_id, authority_id, valid_from, valid_until, created_at)
             VALUES (?, ?, ?, ?, NULL, ?)`,
          )
          .bind(tenantId, user.id, authorityId, now, now)
          .run();
}

type PrincipalRow = {
  user_id: string;
  name: string;
  role: string;
  department: AccessUser["department"];
  access_level: AccessUser["access"];
  status: "active" | "suspended";
  tenant_id: string;
};

export async function principalForSession(
  db: DecisionDatabase,
  tokenHash: string,
  tenantId: string,
  at = new Date().toISOString(),
): Promise<ServerPrincipal | null> {
  await seedAccessDirectory(db);
  const user = await db
    .prepare(
      `SELECT u.user_id, u.name, u.role, u.department, u.access_level, u.status, m.tenant_id
       FROM auth_sessions s
       JOIN access_users u ON u.user_id = s.user_id
       JOIN tenant_memberships m ON m.user_id = u.user_id AND m.tenant_id = ?
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active'`,
    )
    .bind(tenantId, tokenHash, at)
    .first<PrincipalRow>();
  if (!user) return null;
  const permissions = await db
    .prepare("SELECT permission FROM access_permissions WHERE tenant_id = ? AND user_id = ?")
    .bind(tenantId, user.user_id)
    .all<{ permission: Permission }>();
  const authorities = await db
    .prepare(
      `SELECT authority_id FROM authority_assignments
       WHERE tenant_id = ? AND user_id = ? AND valid_from <= ? AND (valid_until IS NULL OR valid_until >= ?)`,
    )
    .bind(tenantId, user.user_id, at, at)
    .all<{ authority_id: string }>();
  return {
    id: user.user_id,
    name: user.name,
    role: user.role,
    department: user.department,
    access: user.access_level,
    status: user.status,
    tenantId: user.tenant_id,
    permissions: permissions.results.map(item => item.permission),
    authorityIds: authorities.results.map(item => item.authority_id),
  };
}

export async function createSession(db: DecisionDatabase, userId: string, tokenHash: string, expiresAt: string) {
  await seedAccessDirectory(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, NULL)",
    )
    .bind(tokenHash, userId, now, expiresAt)
    .run();
}

type AccessUserRow = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  department: AccessUser["department"];
  access_level: AccessUser["access"];
  status: AccessUser["status"];
  manager_user_id: string | null;
  commercial_rep_id: string | null;
  account_manager_id: string | null;
  company_scopes_json: string;
};

export async function loadAccessDirectory(
  db: DecisionDatabase,
  tenantId: string,
  authenticatedUserId: string,
): Promise<AccessState> {
  await seedAccessDirectory(db);
  const result = await db
    .prepare(
      `SELECT u.*, m.company_scopes_json
       FROM access_users u
       JOIN tenant_memberships m ON m.user_id = u.user_id
       WHERE m.tenant_id = ?
       ORDER BY u.name`,
    )
    .bind(tenantId)
    .all<AccessUserRow>();
  const seeded = new Map(seedAccessState().users.map(user => [user.id, user]));
  const users: AccessUser[] = [];
  for (const row of result.results) {
    const permissions = await db
      .prepare("SELECT permission FROM access_permissions WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, row.user_id)
      .all<{ permission: Permission }>();
    const authorities = await db
      .prepare("SELECT authority_id FROM authority_assignments WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, row.user_id)
      .all<{ authority_id: string }>();
    const base = seeded.get(row.user_id);
    users.push({
      ...(base ?? {
        id: row.user_id,
        responsibilities: [],
      }),
      id: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
      department: row.department,
      access: row.access_level,
      status: row.status,
      tenantIds: [tenantId],
      authorityIds: authorities.results.map(item => item.authority_id),
      companyScopes: JSON.parse(row.company_scopes_json) as string[],
      managerUserId: row.manager_user_id ?? undefined,
      commercialRepId: row.commercial_rep_id ?? undefined,
      accountManagerId: row.account_manager_id ?? undefined,
      permissions: permissions.results.map(item => item.permission),
    });
  }
  return { version: 2, authenticatedUserId, users };
}

export async function saveAccessDirectory(db: DecisionDatabase, tenantId: string, actorId: string, state: AccessState) {
  await seedAccessDirectory(db);
  const now = new Date().toISOString();
  for (const user of state.users.filter(candidate => candidate.tenantIds.includes(tenantId))) {
    await db
      .prepare(
        `INSERT INTO access_users (
          user_id, email, name, role, department, access_level, status,
          manager_user_id, commercial_rep_id, account_manager_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          email = excluded.email, name = excluded.name, role = excluded.role,
          department = excluded.department, access_level = excluded.access_level, status = excluded.status,
          manager_user_id = excluded.manager_user_id, commercial_rep_id = excluded.commercial_rep_id,
          account_manager_id = excluded.account_manager_id, updated_at = excluded.updated_at`,
      )
      .bind(
        user.id,
        user.email,
        user.name,
        user.role,
        user.department,
        user.access,
        user.status,
        user.managerUserId ?? null,
        user.commercialRepId ?? null,
        user.accountManagerId ?? null,
        now,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO tenant_memberships (tenant_id, user_id, company_scopes_json, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tenant_id, user_id) DO UPDATE SET company_scopes_json = excluded.company_scopes_json`,
      )
      .bind(tenantId, user.id, JSON.stringify(user.companyScopes), now)
      .run();
    await db
      .prepare("DELETE FROM access_permissions WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, user.id)
      .run();
    for (const permission of user.permissions)
      await db
        .prepare("INSERT INTO access_permissions (tenant_id, user_id, permission, created_at) VALUES (?, ?, ?, ?)")
        .bind(tenantId, user.id, permission, now)
        .run();
    await db
      .prepare("DELETE FROM authority_assignments WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, user.id)
      .run();
    for (const authorityId of user.authorityIds ?? [])
      await db
        .prepare(
          `INSERT INTO authority_assignments
            (tenant_id, user_id, authority_id, valid_from, valid_until, created_at)
           VALUES (?, ?, ?, ?, NULL, ?)`,
        )
        .bind(tenantId, user.id, authorityId, now, now)
        .run();
    await db
      .prepare(
        `INSERT INTO access_events
          (event_id, tenant_id, actor_id, subject_user_id, event_type, payload_json, created_at)
         VALUES (?, ?, ?, ?, 'ACCESS_PROFILE_SAVED', ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        tenantId,
        actorId,
        user.id,
        JSON.stringify({
          role: user.role,
          department: user.department,
          access: user.access,
          status: user.status,
          companyScopes: user.companyScopes,
          permissions: user.permissions,
          authorityIds: user.authorityIds ?? [],
        }),
        now,
      )
      .run();
  }
}
